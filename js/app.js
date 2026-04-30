/* =============================================================
   APP — Boot for app.html.
   Initialises Store, FontSize, Maps, Notes, Guide,
   builds tab nav, wires print + service worker.
   ============================================================= */

(function () {
  'use strict';

  function boot() {
    // Initialise core modules
    if (window.FontSize)  FontSize.init();
    if (window.Maps)      Maps.init();

    // v2.2 — load operator list (for Emergency Card name resolution)
    if (!window._OPERATOR_LIST && window.Utils && Utils.fetchJSON) {
      Utils.fetchJSON('./data/operators.json')
        .then(data => {
          window._OPERATOR_LIST = data;
          // Re-render guide so Emergency Card can resolve provider names
          if (window.Guide && Guide.render) Guide.render();
        })
        .catch(() => { /* fail silently */ });
    }

    // v2.1 — like button (footer)
    if (window.Like && Like.init) Like.init();

    // v2.3 — share button (footer)
    if (window.Share && Share.init) Share.init();

    // v2.2 — first-visit disclaimer
    if (window.Disclaimer && Disclaimer.init) Disclaimer.init();

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
        { id: 'today',       title: 'Today' },
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
      // Build all buttons; we mark the active one after Guide.init() decides
      // which tab to land on (smart default based on trip state).
      TAB_LIST.forEach((t) => {
        const btn = document.createElement('button');
        btn.className = 'tab-nav__btn';
        btn.dataset.tab = t.id;
        btn.textContent = t.title;
        btn.setAttribute('role', 'tab');
        btn.addEventListener('click', () => Guide.switchTab(t.id));
        tabHost.appendChild(btn);
      });
    }

    // Initialise Guide (renders all tabs from data files)
    Guide.init(document.getElementById('content-host')).then(() => {
      // After Guide.init, the smart default may have set a tab other than 'overview'.
      // Sync the nav and tab-content visibility with whatever Guide picked.
      const initialTab = Guide.currentTab || 'overview';
      document.querySelectorAll('.tab-nav__btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.tab === initialTab);
      });
      document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.toggle('is-active', t.id === 'tab-' + initialTab);
      });
      // Set initial notes context
      if (window.Notes && Notes.setSection) {
        const tabTitleMap = { today: 'Today', overview: 'Overview' };
        Notes.setSection(initialTab, tabTitleMap[initialTab] || initialTab);
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
