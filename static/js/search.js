// ============================================
// Braj Kavya Kosha — Search Feature
// Powered by Fuse.js (fuzzy search with Unicode/Hindi support)
// ============================================

(function () {
  // ── Only runs on the /search/ page ─────────────────────────────────────────
  const searchInput   = document.getElementById('search-input');
  const searchClear   = document.getElementById('search-clear');
  const resultsEl     = document.getElementById('search-results');
  const statsEl       = document.getElementById('search-stats');
  const emptyEl       = document.getElementById('search-empty');
  const noResultsEl   = document.getElementById('search-no-results');
  const noResultsText = document.getElementById('search-no-results-text');
  const filterBtns    = document.querySelectorAll('.filter-btn');

  if (!searchInput) return; // Not on the search page

  let fuse        = null;
  let allData     = [];
  let currentFilter = 'all';
  let debounceTimer = null;

  // ── Fuse.js config ──────────────────────────────────────────────────────────
  // Keys and their weights: higher weight = more relevant when matched
  const FUSE_OPTIONS = {
    includeScore:     true,
    includeMatches:   true,
    threshold:        0.35,   // 0 = exact match only, 1 = match anything
    ignoreLocation:   true,   // Important: Hindi words can be anywhere in the body
    minMatchCharLength: 2,
    keys: [
      { name: 'title',  weight: 4.0 },  // poem/poet name — highest priority
      { name: 'poet',   weight: 3.0 },  // poet name on a poem entry
      { name: 'themes', weight: 2.0 },  // theme tags
      { name: 'form',   weight: 1.5 },  // poetic form (दोहा, पद, etc.)
      { name: 'region', weight: 1.5 },  // poet's region
      { name: 'body',   weight: 1.0 },  // poem/bio text (truncated)
    ],
  };

  // ── Load the search index ───────────────────────────────────────────────────
  async function loadIndex() {
    try {
      const url = window.SEARCH_INDEX_URL || '/index.json';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load search index');
      allData = await res.json();
      fuse = new Fuse(allData, FUSE_OPTIONS);

      // If there's a query param already (e.g. from header search bar redirect)
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        searchInput.value = q;
        runSearch(q);
      }
    } catch (err) {
      console.error('Search index error:', err);
      statsEl.textContent = 'खोज अनुक्रमणिका लोड नहीं हो सकी / Could not load search index.';
    }
  }

  // ── Run search ──────────────────────────────────────────────────────────────
  function runSearch(query) {
    query = query.trim();

    // Clear button visibility
    searchClear.style.display = query.length > 0 ? 'flex' : 'none';

    if (!query) {
      showEmpty();
      updateURL('');
      return;
    }

    if (!fuse) {
      statsEl.textContent = 'लोड हो रहा है... / Loading...';
      return;
    }

    let results = fuse.search(query);

    // Apply filter
    if (currentFilter !== 'all') {
      results = results.filter(r => r.item.type === currentFilter);
    }

    updateURL(query);
    renderResults(results, query);
  }

  // ── Render results ──────────────────────────────────────────────────────────
  function renderResults(results, query) {
    emptyEl.classList.add('hidden');

    if (results.length === 0) {
      resultsEl.innerHTML = '';
      statsEl.innerHTML = '';
      noResultsText.textContent = `"${query}" के लिए कोई परिणाम नहीं मिला`;
      noResultsEl.classList.remove('hidden');
      return;
    }

    noResultsEl.classList.add('hidden');

    // Stats bar
    const poemCount = results.filter(r => r.item.type === 'poem').length;
    const poetCount = results.filter(r => r.item.type === 'poet').length;
    let statsText = `${results.length} परिणाम`;
    if (poemCount && poetCount) statsText += ` (${poemCount} कविताएँ, ${poetCount} कवि)`;
    else if (poemCount)         statsText += ` कविताएँ`;
    else if (poetCount)         statsText += ` कवि`;
    statsEl.innerHTML = `<span>${statsText}</span>`;

    // Render cards
    resultsEl.innerHTML = results.map(({ item, matches }) => {
      if (item.type === 'poem') return renderPoemResult(item, matches, query);
      if (item.type === 'poet') return renderPoetResult(item, matches, query);
      return '';
    }).join('');
  }

  function renderPoemResult(item, matches, query) {
    const themes = (item.themes || [])
      .slice(0, 3)
      .map(t => `<span class="theme-tag mini">${t}</span>`)
      .join('');

    // Try to find a highlighted snippet from the body
    const bodySnippet = getBodySnippet(item.body, query, matches);

    return `
      <a href="${item.url}" class="search-result-card search-result-poem">
        <div class="result-type-badge poem-badge">कविता</div>
        <h3 class="result-title">${highlight(item.title, query)}</h3>
        ${item.poet ? `<p class="result-poet">✍ ${highlight(item.poet, query)}</p>` : ''}
        ${item.form ? `<p class="result-form">📜 ${item.form}</p>` : ''}
        ${themes ? `<div class="result-themes">${themes}</div>` : ''}
        ${bodySnippet ? `<p class="result-snippet">${bodySnippet}</p>` : ''}
      </a>
    `;
  }

  function renderPoetResult(item, matches, query) {
    const bodySnippet = getBodySnippet(item.body, query, matches);

    return `
      <a href="${item.url}" class="search-result-card search-result-poet">
        <div class="result-type-badge poet-badge">कवि</div>
        <h3 class="result-title">${highlight(item.title, query)}</h3>
        ${item.dates  ? `<p class="result-meta">📅 ${item.dates}</p>` : ''}
        ${item.region ? `<p class="result-meta">📍 ${item.region}</p>` : ''}
        ${bodySnippet ? `<p class="result-snippet">${bodySnippet}</p>` : ''}
      </a>
    `;
  }

  // ── Highlight matched query in text ─────────────────────────────────────────
  function highlight(text, query) {
    if (!text || !query) return text;
    // Simple case-insensitive highlight — works for Hindi and English
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  // ── Get a relevant body snippet around the matched text ─────────────────────
  function getBodySnippet(body, query, matches) {
    if (!body) return '';

    // Try to find a body match from Fuse
    const bodyMatch = (matches || []).find(m => m.key === 'body');
    if (bodyMatch && bodyMatch.indices && bodyMatch.indices.length > 0) {
      const [start] = bodyMatch.indices[0];
      const snippetStart = Math.max(0, start - 40);
      const snippetEnd   = Math.min(body.length, start + 120);
      let snippet = body.slice(snippetStart, snippetEnd);
      if (snippetStart > 0) snippet = '…' + snippet;
      if (snippetEnd < body.length) snippet = snippet + '…';
      return highlight(snippet, query);
    }

    // Fallback: first 120 chars
    return body.slice(0, 120) + (body.length > 120 ? '…' : '');
  }

  // ── Show empty state ─────────────────────────────────────────────────────────
  function showEmpty() {
    resultsEl.innerHTML = '';
    statsEl.innerHTML   = '';
    noResultsEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  }

  // ── Update URL so search is shareable/bookmarkable ──────────────────────────
  function updateURL(query) {
    const url = query
      ? `${window.location.pathname}?q=${encodeURIComponent(query)}`
      : window.location.pathname;
    window.history.replaceState({}, '', url);
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(this.value), 150);
  });

  searchClear.addEventListener('click', function () {
    searchInput.value = '';
    searchInput.focus();
    showEmpty();
    updateURL('');
    this.style.display = 'none';
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      filterBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      runSearch(searchInput.value);
    });
  });

  // ── Init ─────────────────────────────────────────────────────────────────────
  loadIndex();

})();


// ============================================
// Header search bar (runs on ALL pages)
// ============================================
(function () {
  const headerForm = document.getElementById('header-search-form');
  if (!headerForm) return;

  headerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const q = document.getElementById('header-search-input').value.trim();
    if (q) {
      window.location.href = `/search/?q=${encodeURIComponent(q)}`;
    }
  });

  // Allow pressing Enter in the input
  const headerInput = document.getElementById('header-search-input');
  if (headerInput) {
    headerInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        headerForm.dispatchEvent(new Event('submit'));
      }
    });
  }
})();

