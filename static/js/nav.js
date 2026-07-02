FILE: ./static/js/nav.js
================================================================

// ============================================
// Braj Kavya — Nav Dropdown (Tools menu)
// ============================================

(function () {
  const toggle = document.querySelector('.nav-dropdown-toggle');
  const menu   = document.querySelector('.nav-dropdown-menu');

  if (!toggle || !menu) return;

  // Open / close on button click
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = menu.classList.contains('is-open');
    closeMenu();          // close any already-open state
    if (!isOpen) openMenu();
  });

  // Close when clicking anywhere outside
  document.addEventListener('click', function () {
    closeMenu();
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // Keyboard: allow arrow-key navigation inside the menu
  menu.addEventListener('keydown', function (e) {
    const items = Array.from(menu.querySelectorAll('a'));
    const idx   = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    }
  });

  function openMenu() {
    menu.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    // Move focus to first item for keyboard users
    const first = menu.querySelector('a');
    if (first) first.focus();
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const toggleInput = document.getElementById('trans-toggle');
    const chapterContent = document.getElementById('chapter-content');

    // Only run this script if the toggle actually exists on the page
    if (toggleInput && chapterContent) {
        
        // Listen for the toggle switch changing states
        toggleInput.addEventListener('change', function() {
            if (this.checked) {
                // Turn translations ON
                chapterContent.classList.add('show-translations');
            } else {
                // Turn translations OFF
                chapterContent.classList.remove('show-translations');
            }
        });
    }
});
})();

