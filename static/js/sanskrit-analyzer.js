// ============================================================
// Sanskrit Analyzer — Sandhi & Samāsa Engine  v2
// ============================================================

(function (global) {
  'use strict';

  const VIRAMA       = '\u094D';
  const ANUSVARA     = '\u0902';
  const VISARGA      = '\u0903';
  const CHANDRABINDU = '\u0901';

  const STANDALONE_VOWELS = new Set(['अ','आ','इ','ई','उ','ऊ','ऋ','ए','ऐ','ओ','औ']);
  const MATRAS = new Set(['ा','ि','ी','ु','ू','ृ','े','ै','ो','ौ']);

  const M2V = {'ा':'आ','ि':'इ','ी':'ई','ु':'उ','ू':'ऊ','ृ':'ऋ','े':'ए','ै':'ऐ','ो':'ओ','ौ':'औ'};
  const V2M = {'अ':'','आ':'ा','इ':'ि','ई':'ी','उ':'ु','ऊ':'ू','ऋ':'ृ','ए':'े','ऐ':'ै','ओ':'ो','औ':'ौ'};

  const VOWEL_SANDHI = {
    'आ': [['अ','अ'],['अ','आ'],['आ','अ'],['आ','आ']],
    'ए': [['अ','इ'],['अ','ई'],['आ','इ'],['आ','ई']],
    'ओ': [['अ','उ'],['अ','ऊ'],['आ','उ'],['आ','ऊ']],
    'ऐ': [['अ','ए'],['अ','ऐ'],['आ','ए'],['आ','ऐ']],
    'औ': [['अ','ओ'],['अ','औ'],['आ','ओ'],['आ','औ']],
  };

  const ENDINGS = [
    'म्','ः','स्','त्','न्','ण्','ं',
    'ाम्','ान','ेन','ाय','ात्','ायाः',
    'ाभ्याम्','ेभ्यः','ाभिः','ेषु','ासु',
    'ौ','ो','े','ी','ा','ैः','ानि','ाः','ान','ि','या','यः','येन','यि',
    'तये','त्तये','पत्तये','त्वे',
  ];

  function isDevanagari(s) { return /[\u0900-\u097F]/.test(s); }

  function graphemes(str) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return [...new Intl.Segmenter('sa',{granularity:'grapheme'}).segment(str)].map(s=>s.segment);
    }
    return [...str];
  }

  function lastCodePoint(str) { return str ? [...str].pop() : ''; }
  function stripMatra(g) { const c=[...g]; return c.length?c.slice(0,-1).join(''):''; }

  /* ─── Main Analyzer Class ─────────────────────────────────── */
  class SanskritAnalyzer {
    constructor(dictionary) {
      this.dict = {};
      for (const [k,v] of Object.entries(dictionary||{})) {
        this.dict[this._clean(k)] = v;
      }
    }

    _clean(w) { return(w||'').replace(/[।,;:!?।॥–—\s""'']/g,'').trim(); }

    lookup(word) {
      if (!word) return null;
      const w = this._clean(word);
      if (!w || !isDevanagari(w)) return null;
      if (this.dict[w]) return this.dict[w];
      for (const end of ENDINGS) {
        if (w.endsWith(end) && w.length > end.length+1) {
          const s = w.slice(0,-end.length);
          if (this.dict[s])       return this.dict[s];
          if (this.dict[s+'अ'])   return this.dict[s+'अ'];
        }
      }
      if (this.dict[w+'अ']) return this.dict[w+'अ'];
      const gl = graphemes(w);
      if (gl.length>1) {
        const last=gl[gl.length-1], lcp=lastCodePoint(last);
        if (MATRAS.has(lcp)) {
          const bare=gl.slice(0,-1).join('')+stripMatra(last);
          if (this.dict[bare])      return this.dict[bare];
          if (this.dict[bare+'अ']) return this.dict[bare+'अ'];
        }
      }
      return null;
    }

    analyze(word) {
      const clean = this._clean(word);
      if (!clean||clean.length<2||!isDevanagari(clean)) return null;
      const direct = this.lookup(clean);
      const splits = this._findAllSplits(clean);
      if (!direct && splits.length===0) return null;
      return { word:clean, direct, splits:splits.slice(0,6) };
    }

    _findAllSplits(word) {
      const seen=new Set(), results=[];

      const tryPush=(parts,rules)=>{
        if (parts.length<2) return;
        const key=parts.join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const meanings=parts.map(p=>this.lookup(p));
        if (meanings.every(Boolean)) results.push({parts,meanings,rules});
      };

      const chars = graphemes(word);

      // 2-way
      for (let i=1;i<chars.length;i++) {
        tryPush([chars.slice(0,i).join(''), chars.slice(i).join('')],[null]);
        for (const {p1,p2,rule} of this._sandhiCandidates(chars,i)) tryPush([p1,p2],[rule]);
      }

      // 3-way
      if (chars.length>=5) {
        for (let i=1;i<chars.length-1;i++) {
          for (let j=i+1;j<chars.length;j++) {
            const A=chars.slice(0,i).join(''),B=chars.slice(i,j).join(''),C=chars.slice(j).join('');
            if (!B||!C) continue;
            tryPush([A,B,C],[null,null]);
            // sandhi at i
            for (const {p1:a2,p2:rest,rule:r1} of this._sandhiCandidates(chars,i)) {
              const rg=graphemes(rest);
              for (let k=1;k<rg.length;k++) {
                const b=rg.slice(0,k).join(''),c=rg.slice(k).join('');
                if(!b||!c) continue;
                tryPush([a2,b,c],[r1,null]);
                for (const {p1:b2,p2:c2,rule:r2} of this._sandhiCandidates(rg,k))
                  tryPush([a2,b2,c2],[r1,r2]);
              }
            }
            // sandhi at j
            const bcG=graphemes(B+C), bLen=graphemes(B).length;
            for (const {p1:b3,p2:c3,rule:r2} of this._sandhiCandidates(bcG,bLen))
              tryPush([A,b3,c3],[null,r2]);
          }
        }
      }

      results.sort((a,b)=>
        Math.min(...b.parts.map(p=>graphemes(p).length))-
        Math.min(...a.parts.map(p=>graphemes(p).length))
      );
      return results;
    }

    _sandhiCandidates(chars, i) {
      const cands=[], L=chars.slice(0,i), R=chars.slice(i);
      if (!L.length||!R.length) return cands;

      // Find junction vowel: walk back from end of L
      let mIdx=L.length-1;
      while (mIdx>=0&&(L[mIdx]===ANUSVARA||L[mIdx]===VISARGA||L[mIdx]===CHANDRABINDU)) mIdx--;
      if (mIdx<0) return cands;

      const lastG  = L[mIdx];
      const lastCP = lastCodePoint(lastG);
      const isMatra= MATRAS.has(lastCP);
      const isSV   = STANDALONE_VOWELS.has(lastCP);

      // Visarga sandhi
      if (lastCP===VISARGA) {
        const wv = L.slice(0,mIdx).join('')+stripMatra(lastG);
        cands.push({p1:wv+'र्', p2:R.join(''), rule:'विसर्ग → र् संधि'});
        cands.push({p1:wv,      p2:R.join(''), rule:'विसर्ग लोप संधि'});
        return cands;
      }

      if (!isMatra&&!isSV) return cands;

      const junctionVow = isMatra ? M2V[lastCP] : lastCP;
      // KEY FIX: preserve consonant cluster of last grapheme
      const consPart    = isMatra ? stripMatra(lastG) : '';
      const stemParts   = [...L.slice(0,mIdx), ...(consPart?[consPart]:[])];
      const stem        = stemParts.join('');

      // (A) Vowel sandhi
      if (VOWEL_SANDHI[junctionVow]) {
        for (const [endV,startV] of VOWEL_SANDHI[junctionVow]) {
          const endMatra = V2M[endV];
          const p1 = stem + (endMatra!==undefined ? endMatra : endV);
          const p2 = (R.length&&STANDALONE_VOWELS.has(R[0]))
            ? startV+R.slice(1).join('')
            : startV+R.join('');
          if (p1&&p2) cands.push({p1,p2,rule:`${endV} + ${startV} → ${junctionVow} (स्वर संधि)`});
        }
      }

      // (B) यण् y-sandhi: last grapheme is bare य or ends in य+matra → इ/ई + vowel
      const consEnd = isMatra ? consPart : lastG;
      if (consEnd.endsWith('य')) {
        const stemNoY = stem.slice(0,-'य'.length);
        const rStart  = R[0];
        if (rStart&&STANDALONE_VOWELS.has(rStart)) {
          for (const v of ['इ','ई'])
            cands.push({p1:stemNoY+V2M[v], p2:R.join(''), rule:`${v} + स्वर → य् (यण् संधि)`});
        }
      }

      // (C) यण् v-sandhi: ends in व → उ/ऊ + vowel
      if (consEnd.endsWith('व')) {
        const stemNoV = stem.slice(0,-'व'.length);
        const rStart  = R[0];
        if (rStart&&STANDALONE_VOWELS.has(rStart)) {
          for (const v of ['उ','ऊ'])
            cands.push({p1:stemNoV+V2M[v], p2:R.join(''), rule:`${v} + स्वर → व् (यण् संधि)`});
        }
      }

      // (D) Au-sandhi: L ends in [cons+ā] and element before that is व
      // Pattern: ...X + [cons+ā] where X='व' → originally ...X_cons_with_au
      if (isMatra&&lastCP==='ा'&&mIdx>=1&&L[mIdx-1]==='व') {
        const stemPreV = L.slice(0,mIdx-1).join('');
        const p1Au     = stemPreV+(consPart?consPart:'')+'ौ'; // put औ on the consonant before
        const rStart   = R[0];
        if (rStart&&STANDALONE_VOWELS.has(rStart))
          cands.push({p1:p1Au, p2:R.join(''), rule:'औ + स्वर → आव् (औ-संधि)'});
      }


      // (D2) Au-sandhi: ā in L + R starting with व + vowel → औ + vowel
      // Detects: L ends in ā-matra AND R starts with 'वि'/'वु'/'वे'/'वा' etc.
      // e.g. अर्था | विव → अर्थौ + इव  (औ+इ → āvi)
      if (isMatra && lastCP === 'ा') {
        const rFirst = R[0]; // e.g. 'वि', 'वे', 'वा'
        if (rFirst && rFirst.startsWith('व') && [...rFirst].length >= 2) {
          // strip व from the first grapheme of R
          const rFirstWithout = [...rFirst].slice(1).join(''); // 'वि'→'ि', 'वे'→'े'
          const rRest = R.slice(1).join('');
          let word2vowel = '';
          if (MATRAS.has(rFirstWithout)) {
            word2vowel = M2V[rFirstWithout]; // ि→इ, ु→उ, etc.
          } else if (STANDALONE_VOWELS.has(rFirstWithout)) {
            word2vowel = rFirstWithout;
          }
          if (word2vowel) {
            const p1au = stem + 'ौ';
            const p2au = word2vowel + rRest;
            cands.push({ p1: p1au, p2: p2au, rule: 'औ + स्वर → आव् (औ-संधि)' });
          }
        }
      }

      // (F) Bare-consonant + vowel-initial word (inherent अ bridge & voicing sandhi)
      // Handles: वाक् + अर्थ → वागर्थ,  सत् + चित् → सच्चित् etc.
      if (!isMatra && !isSV && !MATRAS.has(lastCP) && lastCP !== VISARGA) {
        // Try adding implicit अ to start of R (the bare consonant carries inherent 'a')
        const p2withA = 'अ' + R.join('');
        cands.push({ p1: L.join(''), p2: p2withA, rule: 'व्यञ्जन + अ (अ-संधि)' });
        // Consonant voicing reverse (दे-voicing): ग→क्, ड→ट्, द→त्, ब→प् etc.
        const unvoice = {'ग':'क्','घ':'ख्','ज':'च्','झ':'छ्','ड':'ट्','ढ':'ठ्','द':'त्','ध':'थ्','ब':'प्','भ':'फ्'};
        if (unvoice[lastG]) {
          const p1u = L.slice(0,-1).join('') + unvoice[lastG];
          cands.push({ p1: p1u, p2: R.join(''),   rule: 'व्यञ्जन संधि (वर्ग तृतीय→प्रथम)' });
          cands.push({ p1: p1u, p2: p2withA,       rule: 'व्यञ्जन संधि + अ' });
        }
      }

      return cands;
    }
  }

  /* ── CSS ─────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('sa-analyzer-css')) return;
    const s = document.createElement('style');
    s.id = 'sa-analyzer-css';
    s.textContent = `
.word-tooltip{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
  background:#0d0420;color:var(--text,#f5e8f8);
  border:1px solid var(--border-light,#582878);border-radius:14px;
  box-shadow:0 8px 40px rgba(0,0,0,.85),0 0 0 1px rgba(232,184,122,.07);
  z-index:1000;width:min(560px,94vw);max-height:78vh;overflow-y:auto;
  font-size:.95rem;animation:saTooltip .17s ease;}
@keyframes saTooltip{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.word-tooltip.hidden{display:none!important}
.wt-header{display:flex;align-items:flex-start;justify-content:space-between;
  padding:1rem 1.25rem .75rem;border-bottom:1px solid var(--border,#3a1858);gap:.75rem}
.wt-word{font-family:var(--font-hi,serif);font-size:1.35rem;color:var(--gold,#f0c080);
  line-height:1.25;flex:1;word-break:break-word}
.wt-close{background:none;border:none;color:var(--text-dim,#8058a0);cursor:pointer;
  font-size:1.1rem;padding:.1rem .3rem;border-radius:5px;flex-shrink:0;margin-top:.1rem;
  transition:color .15s,background .15s}
.wt-close:hover{color:var(--text,#f5e8f8);background:rgba(255,255,255,.07)}
.wt-direct{padding:.7rem 1.25rem;border-bottom:1px solid var(--border,#3a1858)}
.wt-direct-label{font-style:normal;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--text-dim,#8058a0);display:block;margin-bottom:.2rem;font-family:var(--font-en,serif)}
.wt-direct-text{font-family:var(--font-en,serif);font-style:italic;color:var(--text-light,#c090c8);
  font-size:.88rem;line-height:1.5}
.wt-analysis{padding:.85rem 1.25rem 1rem}
.wt-analysis-label{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--text-dim,#8058a0);font-family:var(--font-en,serif);margin-bottom:.8rem;
  display:flex;align-items:center;gap:.5rem}
.wt-analysis-label::after{content:'';flex:1;height:1px;background:var(--border,#3a1858)}
.wt-parts{display:flex;flex-wrap:wrap;align-items:flex-start;gap:.4rem;margin-bottom:.5rem}
.wt-part{background:rgba(240,192,128,.05);border:1px solid var(--border-light,#582878);
  border-radius:8px;padding:.45rem .8rem;flex:1;min-width:64px;max-width:180px}
.wt-part-word{display:block;font-family:var(--font-hi,serif);font-size:1.05rem;
  color:var(--gold,#f0c080);margin-bottom:.18rem;line-height:1.3}
.wt-part-meaning{display:block;font-family:var(--font-en,serif);font-style:italic;
  font-size:.72rem;color:var(--text-light,#c090c8);line-height:1.4}
.wt-plus{color:var(--text-dim,#8058a0);font-size:.9rem;align-self:center;
  flex-shrink:0;padding-top:.4rem}
.wt-sandhi{font-size:.7rem;font-family:var(--font-en,serif);color:var(--text-dim,#8058a0);
  margin-top:.3rem;padding:.28rem .55rem;background:rgba(208,64,144,.06);border-radius:4px;
  border-left:2px solid rgba(208,64,144,.4);line-height:1.5;display:inline-block}
.wt-toggle-alts{font-size:.7rem;font-family:var(--font-en,serif);color:var(--text-dim,#8058a0);
  margin-top:.6rem;cursor:pointer;text-decoration:underline dotted;display:inline-block;
  transition:color .15s}
.wt-toggle-alts:hover{color:var(--gold-dim,#c898c0)}
.wt-extra-splits{margin-top:.6rem}
.wt-split-alt{border:1px dashed var(--border,#3a1858);border-radius:8px;
  padding:.55rem .8rem;margin-bottom:.45rem}
.wt-split-alt .wt-part{padding:.3rem .6rem}
.wt-split-alt .wt-part-word{font-size:.9rem}
.wt-split-alt .wt-part-meaning{font-size:.67rem}
.wt-not-found{padding:.75rem 1.25rem 1rem;font-family:var(--font-en,serif);
  font-size:.82rem;color:var(--text-dim,#8058a0);font-style:italic}
.poem-word{cursor:pointer;border-bottom:1px dashed transparent;border-radius:2px;
  padding:0 1px;transition:border-color .18s,color .18s,background .18s}
.poem-word:hover{border-bottom-color:var(--gold-dim,#c898c0);color:var(--gold,#f0c080);
  background:rgba(240,192,128,.06)}
`;
    document.head.appendChild(s);
  }

  global.SanskritAnalyzer = SanskritAnalyzer;
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',injectCSS);
  else injectCSS();

})(window);
