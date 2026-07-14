// ============================================
// Mobile Hamburger Nav + Tools Accordion/Dropdown
// ============================================
(function () {
  const hamburger = document.getElementById('hamburger-btn');
  const nav        = document.getElementById('main-nav');
  const toolsBtn   = document.getElementById('nav-tools-toggle');
  const toolsPanel = document.getElementById('nav-tools-panel');

  if (hamburger && nav) {
    hamburger.addEventListener('click', function () {
      const isOpen = nav.classList.toggle('is-open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (!isOpen && toolsPanel) {
        toolsPanel.classList.remove('is-open');
        toolsBtn && toolsBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (toolsBtn && toolsPanel) {
    toolsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = toolsPanel.classList.toggle('is-open');
      toolsBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function (e) {
      if (window.innerWidth > 768 && !toolsBtn.contains(e.target) && !toolsPanel.contains(e.target)) {
        toolsPanel.classList.remove('is-open');
        toolsBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (nav) {
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 768) {
          nav.classList.remove('is-open');
          hamburger && hamburger.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      hamburger && hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
})();