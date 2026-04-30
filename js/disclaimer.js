/* =============================================================
   DISCLAIMER — first-visit modal acknowledgement
   v2.2
   ============================================================= */

(function (global) {
  'use strict';

  // Stored OUTSIDE the main hajj-companion-v1 object, so resetting user data
  // doesn't dismiss the disclaimer permanently and so we never collide with
  // the Store schema.
  const STORAGE_KEY = 'hajj-companion-v1.disclaimerAcknowledgedAt';
  // Bump this if the disclaimer text materially changes — users see it again.
  const DISCLAIMER_VERSION = '1';

  const Disclaimer = {
    /**
     * Show the disclaimer if the user hasn't acknowledged the current version.
     * No-op if already acknowledged.
     */
    init() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && data.version === DISCLAIMER_VERSION) return;
        }
      } catch (e) {
        // localStorage unavailable — show every visit, fail open
      }
      // Defer to next tick so any boot logic running synchronously finishes first
      setTimeout(() => this._show(), 100);
    },

    _show() {
      if (document.getElementById('disclaimer-modal')) return;

      const overlay = document.createElement('div');
      overlay.id = 'disclaimer-modal';
      overlay.className = 'disclaimer-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'disclaimer-title');
      overlay.innerHTML = `
        <div class="disclaimer-modal__backdrop"></div>
        <div class="disclaimer-modal__panel">
          <div class="disclaimer-modal__ornament" aria-hidden="true"></div>
          <h2 id="disclaimer-title" class="disclaimer-modal__title">Before you begin.</h2>
          <p class="disclaimer-modal__lead">
            Hajj Guide is a planning aid, not a fatwa.
          </p>
          <p class="disclaimer-modal__body">
            Rulings shown reflect commonly-held positions in each madhab but individual scholars may differ.
            Times, distances and logistical details are approximate.
            For anything that affects whether your Hajj is valid, confirm with a qualified scholar.
          </p>
          <p class="disclaimer-modal__body">
            Your data stays on your device — no account, no tracking.
          </p>
          <div class="disclaimer-modal__actions">
            <button type="button" class="btn btn--primary" id="disclaimer-accept">I understand</button>
          </div>
          <p class="disclaimer-modal__caption">
            May Allah accept your Hajj.
          </p>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.classList.add('is-disclaimer-open');

      const acceptBtn = overlay.querySelector('#disclaimer-accept');
      acceptBtn.addEventListener('click', () => this._acknowledge());

      // Esc also accepts (treats Esc as "I've seen this") — do not allow
      // dismissal without acknowledgement, but Esc is a reasonable shortcut.
      this._escHandler = (e) => {
        if (e.key === 'Escape') this._acknowledge();
      };
      document.addEventListener('keydown', this._escHandler);

      setTimeout(() => acceptBtn.focus(), 80);
    },

    _acknowledge() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: DISCLAIMER_VERSION,
          at: Date.now(),
        }));
      } catch (e) { /* ignore */ }

      const overlay = document.getElementById('disclaimer-modal');
      if (overlay) {
        overlay.classList.add('is-closing');
        setTimeout(() => {
          overlay.remove();
          document.body.classList.remove('is-disclaimer-open');
        }, 240);
      }

      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
    },

    /**
     * Reset acknowledgement (called after Settings → Reset all data).
     */
    reset() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    },
  };

  global.Disclaimer = Disclaimer;

})(window);
