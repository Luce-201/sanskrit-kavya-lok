// ============================================================
// Sanskrit Kavya Dictionary — Word Click Feature
// Now powered by SanskritAnalyzer for compound word breakdown
// ============================================================

(function () {

  /* ── Wait for analyzer to be ready ─────────────────────────── */
  const MAX_WAIT = 3000;
  let analyzer = null;

  function initAnalyzer() {
    const raw = window.SANSKRIT_DICTIONARY || {};
    const dict = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (window.SanskritAnalyzer) {
      analyzer = new window.SanskritAnalyzer(dict);
    }
  }

  /* ── Build the enhanced tooltip HTML ─────────────────────────
     result = { word, direct, splits }
     splits = [{ parts: [], meanings: [], rules: [] }, ...]
  ───────────────────────────────────────────────────────────── */
  function buildTooltipHTML(word, result) {
    if (!result) {
      return `
        <div class="wt-header">
          <span class="wt-word">${esc(word)}</span>
          <button class="wt-close" onclick="closeTooltip()">✕</button>
        </div>
        <div class="wt-not-found">
          अर्थ उपलब्ध नहीं / meaning not found in dictionary
        </div>`;
    }

    const { direct, splits } = result;
    let html = `
      <div class="wt-header">
        <span class="wt-word">${esc(result.word)}</span>
        <button class="wt-close" onclick="closeTooltip()">✕</button>
      </div>`;

    // Direct meaning
    if (direct) {
      html += `
        <div class="wt-direct">
          <span class="wt-direct-label">अर्थः / Meaning</span>
          ${esc(direct)}
        </div>`;
    }

    // Compound analysis
    if (splits && splits.length > 0) {
      const best  = splits[0];
      const extra = splits.slice(1, 4);

      html += `<div class="wt-analysis">`;
      html += `<div class="wt-analysis-label">
                 <span class="lang-hi">घटक विश्लेषण</span>
                 <span class="lang-en">Compound Analysis</span>
               </div>`;

      // Best split
      html += renderSplit(best, false);

      // Extra splits (collapsed)
      if (extra.length > 0) {
        html += `
          <div class="wt-splits-count" onclick="toggleExtraSplits(this)">
            + ${extra.length} alternative analysis${extra.length > 1 ? 'es' : ''} ▾
          </div>
          <div class="wt-extra-splits" style="display:none">`;
        for (const s of extra) {
          html += renderSplit(s, true);
        }
        html += `</div>`;
      }

      html += `</div>`;
    } else if (!direct) {
      html += `
        <div class="wt-not-found">
          अर्थ उपलब्ध नहीं / meaning not found in dictionary
        </div>`;
    }

    return html;
  }

  function renderSplit(split, isAlt) {
    const wrapClass = isAlt ? 'wt-split-alt' : '';
    let html = isAlt ? `<div class="${wrapClass}">` : '';

    html += `<div class="wt-parts">`;
    for (let i = 0; i < split.parts.length; i++) {
      if (i > 0) html += `<span class="wt-plus">+</span>`;
      html += `
        <div class="wt-part">
          <span class="wt-part-word">${esc(split.parts[i])}</span>
          <span class="wt-part-meaning">${esc(split.meanings[i] || '')}</span>
        </div>`;
    }
    html += `</div>`;

    // Sandhi notes
    const rules = (split.rules || []).filter(Boolean);
    if (rules.length > 0) {
      html += `<div class="wt-sandhi">संधि: ${rules.map(esc).join(' · ')}</div>`;
    }

    if (isAlt) html += `</div>`;
    return html;
  }

  /* ── Show tooltip ─────────────────────────────────────────── */
  function showTooltip(word, result) {
    const tooltip = document.getElementById('word-tooltip');
    if (!tooltip) return;
    tooltip.innerHTML = buildTooltipHTML(word, result);
    tooltip.classList.remove('hidden');
  }

  /* ── Close tooltip ────────────────────────────────────────── */
  window.closeTooltip = function () {
    const t = document.getElementById('word-tooltip');
    if (t) t.classList.add('hidden');
  };

  /* ── Toggle extra splits ──────────────────────────────────── */
  window.toggleExtraSplits = function (btn) {
    const container = btn.nextElementSibling;
    if (!container) return;
    const hidden = container.style.display === 'none';
    container.style.display = hidden ? 'block' : 'none';
    btn.textContent = hidden
      ? btn.textContent.replace('▾', '▴')
      : btn.textContent.replace('▴', '▾');
  };

  /* ── Word click handler ───────────────────────────────────── */
  function onWordClick(event) {
    const word = event.target.dataset.word;
    if (!word) return;

    if (analyzer) {
      // Use analyzer (supports compound breakdown)
      const result = analyzer.analyze(word);
      showTooltip(word, result);
    } else {
      // Fallback: plain dictionary lookup (original behavior)
      const raw = window.SANSKRIT_DICTIONARY || {};
      const dict = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const meaning = dict[word] || fallbackLookup(dict, word);
      const result = meaning
        ? { word, direct: meaning, splits: [] }
        : null;
      showTooltip(word, result);
    }
  }

  /* ── Simple suffix-stripping fallback ────────────────────── */
  function fallbackLookup(dict, word) {
    if (dict[word]) return dict[word];
    const suffixes = ['ने','को','से','में','पर','के','की','का','ों','ाँ','ी','ा','े'];
    for (const suf of suffixes) {
      if (word.endsWith(suf) && word.length > suf.length + 1) {
        const stem = word.slice(0, -suf.length);
        if (dict[stem]) return dict[stem];
      }
    }
    return null;
  }

  /* ── Wrap poem words with click handlers ─────────────────── */
  function makePoemWordsClickable() {
    const poemBody = document.getElementById('poem-text');
    if (!poemBody) return;

    const walker = document.createTreeWalker(
      poemBody, NodeFilter.SHOW_TEXT, null
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach(textNode => {
      const parent = textNode.parentNode;
      if (!parent) return;
      const tag = parent.tagName;
      if (tag === 'A' || tag === 'H1' || tag === 'H2' || tag === 'H3') return;

      const text     = textNode.textContent;
      const fragment = document.createDocumentFragment();
      // Split on whitespace and Devanagari punctuation
      const parts    = text.split(/(\s+|[।॥,;:!?])/);

      parts.forEach(part => {
        if (!part) return;
        if (/^[\s।॥,;:!?]+$/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
          return;
        }
        // It's a word-like chunk
        const cleanWord = part.replace(/[।,;:!?""''॥–—]/g, '').trim();
        const span = document.createElement('span');
        span.textContent = part;
        span.className   = 'poem-word';
        span.dataset.word = cleanWord;
        span.addEventListener('click', onWordClick);
        fragment.appendChild(span);
      });

      parent.replaceChild(fragment, textNode);
    });
  }

  /* ── Global close handlers ────────────────────────────────── */
  document.addEventListener('click', function (e) {
    if (!e.target.classList.contains('poem-word') &&
        !e.target.closest('#word-tooltip')) {
      closeTooltip();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeTooltip();
  });

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  /* ── Init on DOM ready ────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initAnalyzer();
    makePoemWordsClickable();
  });

})();
