/* =============================================================
   I18N — UI chrome translation
   v2.5
   - Stores locale in localStorage (separate key from main user data)
   - Loads /data/i18n.json once
   - Provides I18n.t('key.path') with English fallback
   - Manages dir="ltr" / "rtl" on <html>
   - Notifies subscribers on locale change so UI can re-render
   ============================================================= */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'hajj-companion-v1.locale';
  const DEFAULT_LOCALE = 'en';
  const SUPPORTED = ['en', 'fr', 'ar', 'ur'];
  const RTL_LOCALES = ['ar', 'ur'];

  // Display metadata for the language switcher
  const META = {
    en: { label: 'English',  native: 'English' },
    fr: { label: 'French',   native: 'Français' },
    ar: { label: 'Arabic',   native: 'العربية' },
    ur: { label: 'Urdu',     native: 'اردو' },
  };

  let _strings = null;       // The full i18n.json once loaded
  let _locale = DEFAULT_LOCALE;
  let _subscribers = [];

  const I18n = {
    /**
     * Initialise: read stored locale, load i18n.json, set <html lang>+dir.
     * Returns a Promise that resolves once strings are loaded (or null if load failed).
     */
    async init() {
      // Read stored locale (separate localStorage key from main user data)
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED.indexOf(stored) !== -1) {
          _locale = stored;
        }
      } catch (e) { /* ignore */ }

      // Load strings (cached by browser; small file)
      try {
        const res = await fetch('./data/i18n.json', { cache: 'force-cache' });
        if (res.ok) _strings = await res.json();
      } catch (e) {
        console.warn('I18n: failed to load i18n.json — using English fallback', e);
        _strings = null;
      }

      this._applyDir();
    },

    /**
     * Translate a key like 'tabs.today' or 'footer.share'.
     * Falls back to English if the requested locale is missing the key.
     * Falls back to the key itself if even English is missing it (so a missing
     * translation is visible, not invisible).
     */
    t(key, params) {
      if (!_strings) return this._interp(key, params);
      const fromLocale = this._lookup(_strings[_locale], key);
      if (fromLocale != null) return this._interp(fromLocale, params);
      // English fallback
      const fromEn = this._lookup(_strings.en, key);
      if (fromEn != null) return this._interp(fromEn, params);
      // Last resort — return the key so it's visible we missed something
      return this._interp(key, params);
    },

    /** Walk the dotted path. Returns string | null. */
    _lookup(tree, key) {
      if (!tree) return null;
      const parts = key.split('.');
      let node = tree;
      for (let i = 0; i < parts.length; i++) {
        if (node == null || typeof node !== 'object') return null;
        node = node[parts[i]];
      }
      return (typeof node === 'string') ? node : null;
    },

    /** Replace {placeholder} tokens in a string. */
    _interp(str, params) {
      if (!params || typeof str !== 'string') return str;
      return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
    },

    /** Current locale code. */
    get locale() { return _locale; },

    /** Locale list (for the switcher UI). */
    list() {
      return SUPPORTED.map(code => ({
        code,
        label: META[code].label,
        native: META[code].native,
        rtl: RTL_LOCALES.indexOf(code) !== -1,
      }));
    },

    /**
     * Switch to a new locale. Saves it, sets dir/lang, then notifies subscribers
     * so they can re-render (Guide tabs, Onboarding, footer, etc.).
     */
    setLocale(code) {
      if (SUPPORTED.indexOf(code) === -1) return;
      if (code === _locale) return;
      _locale = code;
      try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
      this._applyDir();
      // Notify subscribers — they decide how to refresh
      _subscribers.forEach(fn => {
        try { fn(_locale); } catch (e) { console.error('I18n subscriber failed', e); }
      });
    },

    /** Apply dir + lang attributes to <html> based on the current locale. */
    _applyDir() {
      try {
        document.documentElement.setAttribute('lang', _locale);
        document.documentElement.setAttribute('dir',
          RTL_LOCALES.indexOf(_locale) !== -1 ? 'rtl' : 'ltr'
        );
        // Add a class so CSS can target the locale specifically
        document.documentElement.className = document.documentElement.className
          .replace(/\blocale-\w+\b/g, '').trim();
        document.documentElement.classList.add('locale-' + _locale);
      } catch (e) { /* ignore */ }
    },

    /** Is the current locale RTL? */
    isRTL() { return RTL_LOCALES.indexOf(_locale) !== -1; },

    /**
     * Subscribe to locale changes. Returns an unsubscribe function.
     * Subscribers are called with the new locale code.
     */
    onChange(fn) {
      _subscribers.push(fn);
      return () => {
        const i = _subscribers.indexOf(fn);
        if (i >= 0) _subscribers.splice(i, 1);
      };
    },

    /**
     * v2.5 — Build the language-switcher UI (a chip in the header).
     * Pass a host element; on locale change, the parent should re-render
     * any text that uses I18n.t().
     */
    renderSwitcher(host) {
      if (!host) return;
      host.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'lang-switcher';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', this.t('header.languageLabel'));

      // Compact icon-button design — opens a small popover with options
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lang-switcher__btn';
      button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-expanded', 'false');
      const current = META[_locale] || META.en;
      button.innerHTML = `<span class="lang-switcher__globe" aria-hidden="true">⌾</span><span class="lang-switcher__current">${current.native}</span><span class="lang-switcher__chev" aria-hidden="true">⌄</span>`;

      const popover = document.createElement('div');
      popover.className = 'lang-switcher__popover';
      popover.setAttribute('role', 'listbox');
      this.list().forEach(({ code, label, native }) => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'lang-switcher__opt' + (code === _locale ? ' is-current' : '');
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', code === _locale ? 'true' : 'false');
        opt.innerHTML = `<span class="lang-switcher__opt-native">${native}</span><span class="lang-switcher__opt-label">${label}</span>`;
        opt.addEventListener('click', () => {
          this.setLocale(code);
          popover.classList.remove('is-open');
          button.setAttribute('aria-expanded', 'false');
          // Re-render the switcher itself so the chip label updates
          this.renderSwitcher(host);
        });
        popover.appendChild(opt);
      });

      // Open / close behaviour
      button.addEventListener('click', () => {
        const open = popover.classList.toggle('is-open');
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      // Close on outside click
      const closeOnOutside = (e) => {
        if (!wrap.contains(e.target)) {
          popover.classList.remove('is-open');
          button.setAttribute('aria-expanded', 'false');
        }
      };
      document.addEventListener('click', closeOnOutside);

      wrap.appendChild(button);
      wrap.appendChild(popover);
      host.appendChild(wrap);
    },
  };

  global.I18n = I18n;
})(window);
