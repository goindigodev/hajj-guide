/* =============================================================
   FEEDBACK — modal form posting to /api/feedback
   v2.1
   ============================================================= */

(function (global) {
  'use strict';

  const Feedback = {
    /**
     * Open the feedback modal. Idempotent — calling twice is fine.
     */
    open() {
      if (document.getElementById('feedback-modal')) return;

      const overlay = document.createElement('div');
      overlay.id = 'feedback-modal';
      overlay.className = 'feedback-modal';
      overlay.innerHTML = `
        <div class="feedback-modal__backdrop" data-feedback-close></div>
        <div class="feedback-modal__panel" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
          <button class="feedback-modal__close" type="button" aria-label="Close" data-feedback-close>×</button>

          <div class="feedback-modal__body">
            <h2 id="feedback-title" class="feedback-modal__title">Send feedback</h2>
            <p class="feedback-modal__lead">
              Found a typo? Want to suggest a feature? Notice something that could help future pilgrims? I read everything.
            </p>

            <form class="feedback-form" id="feedback-form" novalidate>
              <label class="feedback-field">
                <span class="feedback-field__label">Your name <span class="feedback-field__opt">(optional)</span></span>
                <input type="text" name="name" autocomplete="name" maxlength="200" />
              </label>

              <label class="feedback-field">
                <span class="feedback-field__label">Your email <span class="feedback-field__opt">(optional, only if you want a reply)</span></span>
                <input type="email" name="email" autocomplete="email" maxlength="200" />
              </label>

              <label class="feedback-field">
                <span class="feedback-field__label">Message <span class="feedback-field__req">*</span></span>
                <textarea name="message" rows="5" required maxlength="5000" placeholder="What's on your mind?"></textarea>
              </label>

              <!-- Honeypot: hidden from users, bots usually fill it -->
              <div class="feedback-honeypot" aria-hidden="true">
                <label>Website (leave blank)<input type="text" name="website" tabindex="-1" autocomplete="off"/></label>
              </div>

              <div class="feedback-form__actions">
                <button type="button" class="btn btn--ghost" data-feedback-close>Cancel</button>
                <button type="submit" class="btn btn--primary" id="feedback-submit">Send</button>
              </div>

              <div class="feedback-status" id="feedback-status" role="status"></div>
            </form>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.classList.add('is-modal-open');

      // Wire close handlers
      overlay.querySelectorAll('[data-feedback-close]').forEach((btn) => {
        btn.addEventListener('click', () => this.close());
      });

      // Esc to close
      this._escHandler = (e) => {
        if (e.key === 'Escape') this.close();
      };
      document.addEventListener('keydown', this._escHandler);

      // Focus first field
      setTimeout(() => {
        const firstField = overlay.querySelector('input[name="name"]');
        if (firstField) firstField.focus();
      }, 50);

      // Wire submit
      overlay.querySelector('#feedback-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this._submit();
      });
    },

    close() {
      const overlay = document.getElementById('feedback-modal');
      if (overlay) overlay.remove();
      document.body.classList.remove('is-modal-open');
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
    },

    async _submit() {
      const form = document.getElementById('feedback-form');
      const submitBtn = document.getElementById('feedback-submit');
      const statusEl = document.getElementById('feedback-status');
      if (!form || !submitBtn || !statusEl) return;

      const data = {
        name: form.elements.name.value || '',
        email: form.elements.email.value || '',
        message: form.elements.message.value || '',
        website: form.elements.website.value || '', // honeypot
      };

      if (!data.message.trim()) {
        this._setStatus('error', 'Please write a message.');
        return;
      }

      submitBtn.disabled = true;
      this._setStatus('pending', 'Sending…');

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.ok) {
          // Replace form with thank-you state
          this._showThankYou();
        } else {
          this._setStatus('error', body.error || 'Could not send. Please try again.');
          submitBtn.disabled = false;
        }
      } catch (err) {
        this._setStatus('error', 'Network error. Please try again.');
        submitBtn.disabled = false;
      }
    },

    _setStatus(type, msg) {
      const el = document.getElementById('feedback-status');
      if (!el) return;
      el.className = 'feedback-status feedback-status--' + type;
      el.textContent = msg || '';
    },

    _showThankYou() {
      const panel = document.querySelector('.feedback-modal__body');
      if (!panel) return;
      panel.innerHTML = `
        <h2 class="feedback-modal__title">Thank you</h2>
        <p class="feedback-modal__lead">Your message arrived. May Allah accept your effort to make this guide better.</p>
        <div class="feedback-form__actions" style="margin-top: 16px;">
          <button type="button" class="btn btn--primary" data-feedback-close>Close</button>
        </div>
      `;
      panel.querySelectorAll('[data-feedback-close]').forEach((btn) => {
        btn.addEventListener('click', () => this.close());
      });
    },

    /**
     * Wire up every link/button on the page that should open the modal.
     * Uses event delegation so it works for elements added later.
     */
    init() {
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-feedback-open]');
        if (trigger) {
          e.preventDefault();
          this.open();
        }
      });
    },
  };

  global.Feedback = Feedback;

})(window);
