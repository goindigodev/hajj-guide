/* =============================================================
   APP — Boot for app.html.
   Initialises Store, FontSize, Maps, Audio, Notes, Guide,
   builds tab nav, wires print + service worker.
   ============================================================= */

(function () {
  'use strict';

  function boot() {
    // Initialise core modules
    if (window.FontSize)  FontSize.init();
    if (window.Maps)      Maps.init();

    // v2.1 — feedback modal + like button (footer)
    if (window.Feedback && Feedback.init) Feedback.init();
    if (window.Like && Like.init) Like.init();

    // Render font-size control in header
    const fsHost = document.getElementById('fontsize-host');
    if (fsHost && window.FontSize) FontSize.renderControl(fsHost);

    // If the user hasn't onboarded, show empty state
    if (!Store.isOnboarded()) {
      const ne = document.getElementById('needs-onboarding');
      const host = document.getElementById('content-host');
      if (ne) ne.classList.remove('hidden');
      if (host) host.classList.add('hidden');
      const loader = document.getElementById('boot-loader');
      if (loader) loader.style.display = 'none';
      return;
    }

    // Init Notes (floating button + panel)
    if (window.Notes) Notes.init();

    // Build tab nav
    const tabHost = document.querySelector('.tab-nav__inner');
    if (tabHost && window.Guide) {
      const TAB_LIST = [
        { id: 'overview',    title: 'Overview' },
        { id: 'itinerary',   title: 'Itinerary' },
        { id: 'hajj-days',   title: '5 Days of Hajj' },
        { id: 'umrah',       title: 'Umrah' },
        { id: 'duas',        title: 'Duas' },
        { id: 'rulings',     title: 'Rulings' },
        { id: 'locations',   title: 'Locations' },
        { id: 'packing',     title: 'Packing' },
        { id: 'preparation', title: 'Preparation' },
        { id: 'wisdom',      title: 'Wisdom' },
        { id: 'settings',    title: 'Settings' },
      ];
      TAB_LIST.forEach((t, i) => {
        const btn = document.createElement('button');
        btn.className = 'tab-nav__btn' + (i === 0 ? ' is-active' : '');
        btn.dataset.tab = t.id;
        btn.textContent = t.title;
        btn.setAttribute('role', 'tab');
        btn.addEventListener('click', () => Guide.switchTab(t.id));
        tabHost.appendChild(btn);
      });
    }

    // Initialise Guide (renders all tabs from data files)
    Guide.init(document.getElementById('content-host')).then(() => {
      // Set initial notes context
      if (window.Notes && Notes.setSection) {
        Notes.setSection('overview', 'Overview');
      }
      // Hide loader
      const loader = document.getElementById('boot-loader');
      if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s';
        setTimeout(() => loader.remove(), 350);
      }
    }).catch(err => {
      console.error('Guide init failed', err);
      const loader = document.getElementById('boot-loader');
      if (loader) loader.remove();
    });

    // Print button
    const printBtn = document.getElementById('btn-print');
    if (printBtn && window.Print) {
      printBtn.addEventListener('click', () => Print.printActiveTab());
    }

    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./js/sw.js').catch(err => {
        console.log('SW registration failed:', err);
      });
    }

    // Listen for store changes (e.g. madhab change in rulings tab triggers re-render in other tabs)
    Store.on('change', () => {
      // Re-render guide when config changes affect content (deferred)
      // (currently handled inline in tabRulings)
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
