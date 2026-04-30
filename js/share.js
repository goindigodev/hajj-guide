/* =============================================================
   SHARE — popup with WhatsApp / Telegram / Email / Copy
   v2.3
   ============================================================= */

(function (global) {
  'use strict';

  const SHARE_URL = 'https://hajjguide.net';
  const SHARE_TEXT = 'A free, personalised Hajj companion';

  const Share = {
    init() {
      // Event delegation so it works for buttons added later
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-share-button]');
        if (trigger) {
          e.preventDefault();
          this.open();
        }
      });
    },

    open() {
      if (document.getElementById('share-modal')) return;

      const overlay = document.createElement('div');
      overlay.id = 'share-modal';
      overlay.className = 'share-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'share-title');

      // v2.5 — translate via I18n with English fallback
      const t = (k, f) => (window.I18n ? I18n.t(k) : f);
      // The share text used in deep links uses the localised tagline
      const shareText = t('share.shareText', SHARE_TEXT);
      const encUrl  = encodeURIComponent(SHARE_URL);
      const encText = encodeURIComponent(shareText + ' — ' + SHARE_URL);
      const encMsg  = encodeURIComponent(shareText);

      const ariaClose  = t('share.ariaClose',     'Close');
      const title      = t('share.title',         'Share this guide');
      const lead       = t('share.lead',          'Help another pilgrim plan their Hajj.');
      const tWhatsapp  = t('share.tileWhatsapp',  'WhatsApp');
      const tTelegram  = t('share.tileTelegram',  'Telegram');
      const tEmail     = t('share.tileEmail',     'Email');
      const tCopy      = t('share.tileCopy',      'Copy link');

      overlay.innerHTML = `
        <div class="share-modal__backdrop" data-share-close></div>
        <div class="share-modal__panel">
          <button type="button" class="share-modal__close" data-share-close aria-label="${ariaClose}">×</button>
          <h2 id="share-title" class="share-modal__title">${title}</h2>
          <p class="share-modal__lead">${lead}</p>

          <div class="share-modal__grid">
            <a class="share-tile share-tile--whatsapp" data-share-channel="whatsapp"
               href="https://wa.me/?text=${encText}"
               target="_blank" rel="noopener noreferrer">
              <span class="share-tile__icon">WA</span>
              <span class="share-tile__label">${tWhatsapp}</span>
            </a>
            <a class="share-tile share-tile--telegram" data-share-channel="telegram"
               href="https://t.me/share/url?url=${encUrl}&text=${encMsg}"
               target="_blank" rel="noopener noreferrer">
              <span class="share-tile__icon">TG</span>
              <span class="share-tile__label">${tTelegram}</span>
            </a>
            <a class="share-tile share-tile--email" data-share-channel="email"
               href="mailto:?subject=${encMsg}&body=${encText}">
              <span class="share-tile__icon">@</span>
              <span class="share-tile__label">${tEmail}</span>
            </a>
            <button type="button" class="share-tile share-tile--copy" data-share-channel="copy" id="share-copy">
              <span class="share-tile__icon">⧉</span>
              <span class="share-tile__label">${tCopy}</span>
            </button>
          </div>

          <div class="share-modal__url">
            <code>${SHARE_URL}</code>
          </div>
          <div class="share-modal__count" id="share-count-display"></div>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.classList.add('is-modal-open');

      // Wire close
      overlay.querySelectorAll('[data-share-close]').forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      // Esc to close
      this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
      document.addEventListener('keydown', this._escHandler);

      // Wire each share channel — count on click + special-case copy
      overlay.querySelectorAll('[data-share-channel]').forEach(el => {
        el.addEventListener('click', (ev) => {
          const channel = el.getAttribute('data-share-channel');
          this._recordShare(channel);
          if (channel === 'copy') {
            ev.preventDefault();
            this._copyLink(el);
          }
        });
      });

      // Display the current share count if available
      this._refreshCount();
    },

    close() {
      const overlay = document.getElementById('share-modal');
      if (overlay) overlay.remove();
      document.body.classList.remove('is-modal-open');
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
    },

    /** Increment share counter and update the display. Fail silently if the API is unavailable. */
    async _recordShare(channel) {
      try {
        const res = await fetch('/api/share', { method: 'POST' });
        if (res.ok) {
          const body = await res.json();
          this._updateCount(body.count);
        }
      } catch (e) { /* offline — ignore */ }
    },

    async _refreshCount() {
      try {
        const res = await fetch('/api/share', { method: 'GET' });
        if (!res.ok) return;
        const body = await res.json();
        this._updateCount(body.count);
      } catch (e) { /* ignore */ }
    },

    _updateCount(count) {
      const el = document.getElementById('share-count-display');
      if (!el) return;
      if (typeof count === 'number' && count > 0) {
        const t = (k, f) => (window.I18n ? I18n.t(k, { n: this._format(count) }) : f);
        el.textContent = count === 1
          ? t('share.countOne',  `Shared ${this._format(count)} time`)
          : t('share.countMany', `Shared ${this._format(count)} times`);
      } else {
        el.textContent = '';
      }
    },

    _format(n) {
      if (n >= 10000) return Math.round(n / 1000) + 'k';
      if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
      return String(n);
    },

    /** Copy URL to clipboard, give visual feedback on the button. */
    async _copyLink(buttonEl) {
      const t = (k, f) => (window.I18n ? I18n.t(k) : f);
      const copied = t('share.copied', 'Copied ✓');
      const failed = t('share.copyFailed', 'Copy failed');
      const orig = buttonEl.querySelector('.share-tile__label').textContent;
      try {
        await navigator.clipboard.writeText(SHARE_URL);
        buttonEl.querySelector('.share-tile__label').textContent = copied;
        buttonEl.classList.add('is-copied');
      } catch (e) {
        // Fallback: select + copy via legacy method
        try {
          const ta = document.createElement('textarea');
          ta.value = SHARE_URL;
          ta.style.position = 'absolute';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          buttonEl.querySelector('.share-tile__label').textContent = copied;
          buttonEl.classList.add('is-copied');
        } catch (err) {
          buttonEl.querySelector('.share-tile__label').textContent = failed;
        }
      }
      setTimeout(() => {
        if (buttonEl.querySelector('.share-tile__label')) {
          buttonEl.querySelector('.share-tile__label').textContent = orig;
          buttonEl.classList.remove('is-copied');
        }
      }, 1800);
    },
  };

  global.Share = Share;
})(window);
