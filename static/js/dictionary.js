// ============================================
// Sanskrit Kavya Dictionary — Word Click Feature
// ============================================

const raw = window.SANSKRIT_DICTIONARY || '{}';
const dictionary = typeof raw === 'string' ? JSON.parse(raw) : raw;

// This function wraps each word in the poem in a clickable <span>
function makePoemWordsClickable() {
  const poemBody = document.getElementById('poem-text');
  if (!poemBody) return; // Not on a poem page — do nothing

  // Walk through all text nodes inside the poem
  const walker = document.createTreeWalker(
    poemBody,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach(node => {
    // Split text by spaces/punctuation, wrap each word
    const text = node.textContent;
    const parent = node.parentNode;
    
    // Don't process if inside a link or heading
    if (parent.tagName === 'A' || parent.tagName === 'H1' || 
        parent.tagName === 'H2' || parent.tagName === 'H3') return;

    const fragment = document.createDocumentFragment();
    // Split on spaces, keeping punctuation attached to words
    const parts = text.split(/(\s+)/);
    
    parts.forEach(part => {
      if (/^\s+$/.test(part)) {
        // Pure whitespace — keep as is
        fragment.appendChild(document.createTextNode(part));
      } else {
        // A word — wrap it
        const cleanWord = part.replace(/[।,;:!?""''।]/g, '').trim();
        const span = document.createElement('span');
        span.textContent = part;
        span.className = 'poem-word';
        span.dataset.word = cleanWord;
        span.addEventListener('click', onWordClick);
        fragment.appendChild(span);
      }
    });

    parent.replaceChild(fragment, node);
  });
}

// Called when a word is clicked
function onWordClick(event) {
  const word = event.target.dataset.word;
  if (!word) return;

  // Try direct match first
  let meaning = dictionary[word];

  // If not found, try without diacritics variations
  // (Handles cases like "नयनों" when dictionary has "नयन")
  if (!meaning) {
    // Try stripping common Hindi suffixes for lookup
    const stripped = stripSuffix(word);
    if (stripped !== word) meaning = dictionary[stripped];
  }

  if (meaning) {
    showTooltip(word, meaning);
  } else {
    showTooltip(word, '(अर्थ उपलब्ध नहीं / meaning not in dictionary)');
  }
}

// Show the tooltip
function showTooltip(word, meaning) {
  const tooltip = document.getElementById('word-tooltip');
  tooltip.querySelector('.tooltip-word').textContent = word;
  tooltip.querySelector('.tooltip-meaning').textContent = meaning;
  tooltip.classList.remove('hidden');
}

// Close the tooltip
function closeTooltip() {
  document.getElementById('word-tooltip').classList.add('hidden');
}

// Close tooltip when clicking outside the poem
document.addEventListener('click', function(e) {
  if (!e.target.classList.contains('poem-word') && 
      !e.target.closest('#word-tooltip')) {
    closeTooltip();
  }
});

// Close with Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeTooltip();
});

// Simple suffix stripper for Hindi words
// This helps find "राम" when the word is "रामने" etc.
function stripSuffix(word) {
  const suffixes = ['ने', 'को', 'से', 'में', 'पर', 'के', 'की', 'का', 'ों', 'ाँ', 'ी', 'ा', 'े'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 1) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

// Run when page loads
document.addEventListener('DOMContentLoaded', makePoemWordsClickable);

