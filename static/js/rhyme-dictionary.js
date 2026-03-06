FILE: ./static/js/rhyme-dictionary.js
================================================================

// ============================================
// Sanskrit Kavya Kosha — Rhyme Dictionary Engine v2
// Phonetic matching with:
//   • Homophone normalisation  (ण→न, ष→श)
//   • Word-final schwa deletion (राम→raam not raama)
//   • Reversed-key grouping    (Walker's Dictionary technique)
//   • Auto-depth detection     (longest suffix with ≥2 matches)
// ============================================

(function () {

  // ── DOM ──────────────────────────────────────────────────────────────────────
  const inputEl      = document.getElementById('rd-input');
  const clearBtn     = document.getElementById('rd-clear');
  const resultsEl    = document.getElementById('rd-results');
  const statsEl      = document.getElementById('rd-stats');
  const emptyEl      = document.getElementById('rd-empty');
  const noResultsEl  = document.getElementById('rd-no-results');
  const noResultsTxt = document.getElementById('rd-no-results-text');
  const depthBar     = document.getElementById('rd-depth-bar');
  const depthPills   = document.getElementById('rd-depth-pills');

  if (!inputEl) return;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — DEVANAGARI → PHONETIC CONVERSION
  //
  // Strategy: convert each Devanagari word into an array of phoneme tokens
  // (small Roman strings like 'k', 'aa', 'jh', 'n', …). This lets us:
  //   a) normalise homophones by mapping them to the same token
  //   b) delete the word-final implicit schwa correctly
  //   c) compare word endings purely on sound, not spelling
  // ═══════════════════════════════════════════════════════════════════════════

  // Consonants — KEY NORMALISATIONS:
  //   ण → 'n'  (same sound as न in Braj/Hindi)
  //   ष → 'sh' (same sound as श)
  const CONS = {
    'क':'k',  'ख':'kh', 'ग':'g',  'घ':'gh', 'ङ':'n',
    'च':'ch', 'छ':'chh','ज':'j',  'झ':'jh', 'ञ':'n',
    'ट':'t',  'ठ':'th', 'ड':'d',  'ढ':'dh', 'ण':'n',
    'त':'t',  'थ':'th', 'द':'d',  'ध':'dh', 'न':'n',
    'प':'p',  'फ':'ph', 'ब':'b',  'भ':'bh', 'म':'m',
    'य':'y',  'र':'r',  'ल':'l',  'व':'v',
    'श':'sh', 'ष':'sh',
    'स':'s',  'ह':'h',  'ळ':'l',
  };

  const MATRA = {
    'ा':'aa','ि':'i', 'ी':'ii','ु':'u', 'ू':'uu',
    'ृ':'ri','े':'e', 'ै':'ai','ो':'o', 'ौ':'au',
    'ॅ':'e', 'ॉ':'o',
  };

  const VOWEL = {
    'अ':'a', 'आ':'aa','इ':'i', 'ई':'ii','उ':'u',
    'ऊ':'uu','ऋ':'ri','ए':'e', 'ऐ':'ai','ओ':'o','औ':'au',
  };

  const VIRAMA       = '\u094D';
  const ANUSVARA     = '\u0902';
  const CHANDRABINDU = '\u0901';
  const VISARGA      = '\u0903';
  const NUKTA        = '\u093C';

  // ── Split word into Devanagari syllable clusters ─────────────────────────────
  // Each cluster groups a (possibly conjunct) consonant + its matra/diacritics.
  // e.g. ग्वारन → ["ग्वा", "र", "न"]
  //      मँझारन → ["मँ", "झा", "र", "न"]
  function splitIntoClusters(word) {
    const isMatra     = c => (c >= '\u093E' && c <= '\u094C') || c==='\u094E' || c==='\u094F';
    const isDiacritic = c => c===ANUSVARA || c===CHANDRABINDU || c===NUKTA;
    const chars = [...word];
    const clusters = [];
    let i = 0;
    while (i < chars.length) {
      let cluster = chars[i]; i++;
      while (i < chars.length && chars[i]===VIRAMA && i+1 < chars.length) {
        cluster += chars[i] + chars[i+1]; i += 2;
      }
      while (i < chars.length && (isMatra(chars[i]) || isDiacritic(chars[i]) || chars[i]===VISARGA)) {
        cluster += chars[i]; i++;
      }
      clusters.push(cluster);
    }
    return clusters;
  }

  // ── Convert one cluster → phoneme token array ─────────────────────────────────
  // SCHWA DELETION: a bare consonant (no matra) gets implicit 'a'
  // UNLESS it is the final cluster of the word.
  function processCluster(clusterStr, isWordFinal) {
    const chars = [...clusterStr];
    const consonants = [];
    let vowelSound = null;
    let hasNasal   = false;
    let hasVisarga = false;

    for (const c of chars) {
      if (c===VIRAMA || c===NUKTA) continue;
      if (CONS[c])                                  { consonants.push(CONS[c]); }
      else if (MATRA[c])                            { vowelSound = MATRA[c]; }
      else if (VOWEL[c])                            { vowelSound = VOWEL[c]; }
      else if (c===ANUSVARA || c===CHANDRABINDU)    { hasNasal   = true; }
      else if (c===VISARGA)                         { hasVisarga = true; }
    }

    const tokens = [...consonants];

    if (vowelSound) {
      tokens.push(vowelSound);
    } else if (consonants.length > 0 && !isWordFinal) {
      tokens.push('a'); // implicit schwa — present everywhere except word-final
    }
    // word-final bare consonant: schwa deleted (nothing pushed)

    if (hasNasal)   tokens.push('n');
    if (hasVisarga) tokens.push('h');

    return tokens;
  }

  // ── Convert full word → phoneme tokens + cluster mapping ─────────────────────
  function wordToPhonetic(word) {
    const clusters = splitIntoClusters(word);
    const allTokens = [];
    const clusterTokenCounts = [];
    for (let i = 0; i < clusters.length; i++) {
      const t = processCluster(clusters[i], i === clusters.length - 1);
      clusterTokenCounts.push(t.length);
      allTokens.push(...t);
    }
    return { tokens: allTokens, clusterTokenCounts, clusters };
  }

  // Memoisation cache
  const phoneticCache = new Map();
  function getPhonetics(word) {
    if (!phoneticCache.has(word)) phoneticCache.set(word, wordToPhonetic(word));
    return phoneticCache.get(word);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — PHONEMIC SUFFIX OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Last `depth` tokens joined → comparison string, e.g. "aaran"
  function getPhoneticSuffix(tokens, depth) {
    return tokens.slice(Math.max(0, tokens.length - depth)).join('');
  }

  // Which cluster index does the suffix start at?
  // (We include a cluster if even part of it falls within the suffix boundary,
  //  so highlighting is always correct even for conjuncts like ग्व.)
  function getSuffixStartCluster(clusterTokenCounts, depth) {
    let remaining = depth;
    for (let i = clusterTokenCounts.length - 1; i >= 0; i--) {
      remaining -= clusterTokenCounts[i];
      if (remaining <= 0) return i;
    }
    return 0;
  }

  // The Devanagari text corresponding to the phonetic suffix
  function getDevaSuffix(word, depth) {
    const { clusterTokenCounts, clusters } = getPhonetics(word);
    const startIdx = getSuffixStartCluster(clusterTokenCounts, depth);
    return clusters.slice(startIdx).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — CORPUS INDEX
  // ═══════════════════════════════════════════════════════════════════════════

  function cleanWord(word) {
    return word
      .replace(/[।,.!?;:""''॥–—\-\u200c\u200d\ufeff]/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  function tokenise(text) {
    return text
      .split(/[\s\n\r]+/)
      .map(cleanWord)
      .filter(w => w.length >= 2 && /[\u0900-\u097F]/.test(w));
  }

  const wordIndex = new Map(); // word → [{title, url, poet}]

  function buildIndex() {
    for (const poem of (window.SANSKRIT_CORPUS || [])) {
      const ref = { title: poem.title, url: poem.url, poet: poem.poet };
      for (const w of tokenise(poem.text + ' ' + poem.title)) {
        if (!wordIndex.has(w)) wordIndex.set(w, []);
        const refs = wordIndex.get(w);
        if (!refs.find(r => r.url === poem.url)) refs.push(ref);
      }
    }
  }

  buildIndex();

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — RHYME FINDING
  // ═══════════════════════════════════════════════════════════════════════════

  function findRhymes(queryWord, depth) {
    const qp = getPhonetics(queryWord);
    if (!qp || qp.tokens.length === 0) return [];
    const querySuffix = getPhoneticSuffix(qp.tokens, depth);

    const results = [];
    for (const [word, refs] of wordIndex.entries()) {
      if (word === queryWord) continue;
      const wp = getPhonetics(word);
      if (!wp || wp.tokens.length === 0) continue;
      if (getPhoneticSuffix(wp.tokens, depth) === querySuffix) {
        results.push({ word, refs });
      }
    }

    // Sort: words where the suffix is a larger proportion of the whole word
    // appear first (purer rhymes)
    results.sort((a, b) => {
      const aR = depth / (getPhonetics(a.word).tokens.length || 1);
      const bR = depth / (getPhonetics(b.word).tokens.length || 1);
      if (Math.abs(aR - bR) > 0.1) return bR - aR;
      return a.word.localeCompare(b.word);
    });

    return results;
  }

  const MIN_DEPTH   = 1;
  const MAX_DEPTH   = 8;
  const MIN_MATCHES = 2;

  function autoDetectDepth(queryWord) {
    const qp = getPhonetics(queryWord);
    if (!qp) return MIN_DEPTH;
    for (let d = Math.min(MAX_DEPTH, qp.tokens.length); d >= MIN_DEPTH; d--) {
      if (findRhymes(queryWord, d).length >= MIN_MATCHES) return d;
    }
    return MIN_DEPTH;
  }

  function getAvailableDepths(queryWord) {
    const qp = getPhonetics(queryWord);
    if (!qp) return [];
    const depths = [];
    for (let d = MIN_DEPTH; d <= Math.min(MAX_DEPTH, qp.tokens.length); d++) {
      const count = findRhymes(queryWord, d).length;
      if (count > 0) {
        depths.push({
          depth: d,
          phoneticSuffix: getPhoneticSuffix(qp.tokens, d),
          devaSuffix:     getDevaSuffix(queryWord, d),
          count,
        });
      }
    }
    return depths;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  // Render word with the rhyming suffix highlighted.
  // Split on Devanagari clusters to avoid breaking conjuncts.
  function renderWord(word, depth) {
    const { clusterTokenCounts, clusters } = getPhonetics(word);
    const startIdx = getSuffixStartCluster(clusterTokenCounts, depth);
    const stem   = clusters.slice(0, startIdx).join('');
    const suffix = clusters.slice(startIdx).join('');
    if (!stem) return `<span class="rhyme-suffix">${escapeHtml(suffix)}</span>`;
    return `${escapeHtml(stem)}<span class="rhyme-suffix">${escapeHtml(suffix)}</span>`;
  }

  let currentDepth    = null;
  let currentQuery    = '';
  let availableDepths = [];

  function renderDepthPills(queryWord) {
    availableDepths = getAvailableDepths(queryWord);
    depthPills.innerHTML = availableDepths.map(({ depth, devaSuffix, phoneticSuffix, count }) => `
      <button
        class="rd-depth-pill${depth === currentDepth ? ' active' : ''}"
        data-depth="${depth}"
        title="Phonetic: -${escapeHtml(phoneticSuffix)}"
      >
