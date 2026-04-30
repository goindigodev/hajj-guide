/* =============================================================
   LIKE BUTTON — global counter via /api/like
   v2.1
   ============================================================= */

(function (global) {
  'use strict';

  const LIKE_STORAGE_KEY = 'hajj-companion-v1.likedAt';

  const Like = {
    /**
     * Initialise: find every [data-like-button], read current count,
     * wire click handlers. Idempotent.
     */
    init() {
      const buttons = document.querySelectorAll('[data-like-button]');
      if (!buttons.length) return;

      // Whether this user has already liked
      const liked = !!this._getLikedAt();
      buttons.forEach((btn) => {
        if (liked) btn.classList.add('is-liked');
        btn.addEventListener('click', () => this._onClick(btn));
      });

      // Fetch current count
      this._refresh();
    },

    async _refresh() {
      try {
        const res = await fetch('/api/like', { method: 'GET' });
        if (!res.ok) return;
        const body = await res.json();
        this._renderCount(body.count);
      } catch (e) {
        // Silently fail — counter just shows "—"
      }
    },

    async _onClick(btn) {
      // Block double-counting from the same user
      if (this._getLikedAt()) {
        btn.classList.add('is-liked');
        return;
      }

      // Optimistic UI
      btn.classList.add('is-liked');
      this._setLikedAt(Date.now());

      try {
        const res = await fetch('/api/like', { method: 'POST' });
        if (!res.ok) {
          // Roll back on server failure
          btn.classList.remove('is-liked');
          this._clearLikedAt();
          return;
        }
        const body = await res.json();
        this._renderCount(body.count);
      } catch (e) {
        btn.classList.remove('is-liked');
        this._clearLikedAt();
      }
    },

    _renderCount(n) {
      document.querySelectorAll('[data-like-count]').forEach((el) => {
        el.textContent = this._format(n);
      });
    },

    _format(n) {
      if (typeof n !== 'number' || isNaN(n)) return '—';
      if (n >= 10000) return Math.round(n / 1000) + 'k';
      if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
      return String(n);
    },

    _getLikedAt() {
      try { return localStorage.getItem(LIKE_STORAGE_KEY); }
      catch (e) { return null; }
    },
    _setLikedAt(ts) {
      try { localStorage.setItem(LIKE_STORAGE_KEY, String(ts)); }
      catch (e) { /* localStorage might be disabled */ }
    },
    _clearLikedAt() {
      try { localStorage.removeItem(LIKE_STORAGE_KEY); }
      catch (e) { /* no-op */ }
    },
  };

  global.Like = Like;

})(window);
