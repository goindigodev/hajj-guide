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

      const encUrl  = encodeURIComponent(SHARE_URL);
      const encText = encodeURIComponent(SHARE_TEXT + ' — ' + SHARE_URL);
      const encMsg  = encodeURIComponent(SHARE_TEXT);

      overlay.innerHTML = `
        <div class="share-modal__backdrop" data-share-close></div>
        <div class="share-modal__panel">
          <button type="button" class="share-modal__close" data-share-close aria-label="Close">×</button>
          <h2 id="share-title" class="share-modal__title">Share this guide</h2>
          <p class="share-modal__lead">Help another pilgrim plan their Hajj.</p>

          <div class="share-modal__grid">
            <a class="share-tile share-tile--whatsapp" data-share-channel="whatsapp"
               href="https://wa.me/?text=${encText}"
               target="_blank" rel="noopener noreferrer">
              <span class="share-tile__icon">WA</span>
              <span class="share-tile__label">WhatsApp</span>
            </a>
            <a class="share-tile share-tile--telegram" data-share-channel="telegram"
               href="https://t.me/share/url?url=${encUrl}&text=${encMsg}"
               target="_blank" rel="noopener noreferrer">
              <span class="share-tile__icon">TG</span>
              <span class="share-tile__label">Telegram</span>
            </a>
            <a class="share-tile share-tile--email" data-share-channel="email"
               href="mailto:?subject=${encMsg}&body=${encText}">
              <span class="share-tile__icon">@</span>
              <span class="share-tile__label">Email</span>
            </a>
            <button type="button" class="share-tile share-tile--copy" data-share-channel="copy" id="share-copy">
              <span class="share-tile__icon">⧉</span>
              <span class="share-tile__label">Copy link</span>
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
        el.textContent = `Shared ${this._format(count)} time${count === 1 ? '' : 's'}`;
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
      const orig = buttonEl.querySelector('.share-tile__label').textContent;
      try {
        await navigator.clipboard.writeText(SHARE_URL);
        buttonEl.querySelector('.share-tile__label').textContent = 'Copied ✓';
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
          buttonEl.querySelector('.share-tile__label').textContent = 'Copied ✓';
          buttonEl.classList.add('is-copied');
        } catch (err) {
          buttonEl.querySelector('.share-tile__label').textContent = 'Copy failed';
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
