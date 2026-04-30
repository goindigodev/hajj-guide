/* =============================================================
   APP — Boot for app.html.
   Initialises Store, FontSize, Maps, Notes, Guide,
   builds tab nav, wires print + service worker.
   ============================================================= */

(function () {
  'use strict';

  async function boot() {
    // v2.5 — Initialise i18n FIRST (loads strings, sets dir/lang on <html>).
    // Other modules call I18n.t() so this must complete before their UI renders.
    if (window.I18n && I18n.init) await I18n.init();

    // Initialise core modules
    if (window.FontSize)  FontSize.init();
    if (window.Maps)      Maps.init();

    // v2.5 — Render language switcher in header
    const langHost = document.getElementById('lang-switcher-host');
    if (langHost && window.I18n) {
      I18n.renderSwitcher(langHost);
      // When the user switches language, re-render the Guide so all tabs refresh.
      I18n.onChange(() => {
        // Tab nav button labels are static in the DOM — refresh them
        document.querySelectorAll('.tab-nav__btn').forEach(btn => {
          if (btn.dataset.i18nKey) {
            btn.textContent = I18n.t(btn.dataset.i18nKey);
          }
        });
        // Re-render the Guide (re-runs all tab render functions)
        if (window.Guide && Guide.render) Guide.render();
        // Re-apply static i18n bits
        _applyStaticTranslations();
      });
    }

    function _applyStaticTranslations() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = I18n.t(key);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.placeholder = I18n.t(key);
      });
      document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (key) el.setAttribute('aria-label', I18n.t(key));
      });
    }
    _applyStaticTranslations();

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
      // Tab IDs (the i18n key conversion: 'hajj-days' → 'tabs.hajjDays')
      const TAB_LIST = [
        { id: 'today',       i18nKey: 'tabs.today' },
        { id: 'overview',    i18nKey: 'tabs.overview' },
        { id: 'itinerary',   i18nKey: 'tabs.itinerary' },
        { id: 'hajj-days',   i18nKey: 'tabs.hajjDays' },
        { id: 'umrah',       i18nKey: 'tabs.umrah' },
        { id: 'duas',        i18nKey: 'tabs.duas' },
        { id: 'rulings',     i18nKey: 'tabs.rulings' },
        { id: 'locations',   i18nKey: 'tabs.locations' },
        { id: 'packing',     i18nKey: 'tabs.packing' },
        { id: 'preparation', i18nKey: 'tabs.preparation' },
        { id: 'wisdom',      i18nKey: 'tabs.wisdom' },
        { id: 'settings',    i18nKey: 'tabs.settings' },
      ];
      TAB_LIST.forEach((t) => {
        const btn = document.createElement('button');
        btn.className = 'tab-nav__btn';
        btn.dataset.tab = t.id;
        btn.dataset.i18nKey = t.i18nKey; // for refresh on locale change
        btn.textContent = window.I18n ? I18n.t(t.i18nKey) : t.id;
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
