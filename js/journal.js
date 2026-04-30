/* =============================================================
   JOURNAL — daily Hajj reflections
   - One entry per ISO date (YYYY-MM-DD).
   - Stored in Store under `journal: { 'YYYY-MM-DD': {text, updatedAt} }`.
   - Exposes a debounced setter so day-card textareas can save as the user types.
   ============================================================= */

(function (global) {
  'use strict';

  const DEBOUNCE_MS = 600;

  const Journal = {
    _saveTimer: null,
    _pending: {},  // { dateIso: text } — buffer of unsaved text, flushed on debounce

    /**
     * Get the entry for an ISO date (YYYY-MM-DD).
     * Returns the entry object {text, updatedAt} or null if no entry yet.
     */
    get(dateIso) {
      const state = (typeof Store !== 'undefined') ? Store.get() : null;
      if (!state || !state.journal) return null;
      return state.journal[dateIso] || null;
    },

    /**
     * Get all entries as a chronologically-sorted array.
     * Each item: { dateIso, text, updatedAt }
     */
    all() {
      const state = (typeof Store !== 'undefined') ? Store.get() : null;
      if (!state || !state.journal) return [];
      return Object.keys(state.journal)
        .filter(k => state.journal[k] && state.journal[k].text)
        .map(k => ({
          dateIso: k,
          text: state.journal[k].text,
          updatedAt: state.journal[k].updatedAt || 0,
        }))
        .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    },

    /**
     * Save an entry immediately (no debounce). Use for blur events / explicit saves.
     * Empty text deletes the entry to keep storage clean.
     */
    setNow(dateIso, text) {
      if (!dateIso) return;
      const state = Store.get() || {};
      const journal = state.journal ? { ...state.journal } : {};
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        delete journal[dateIso];
      } else {
        journal[dateIso] = {
          text: trimmed,
          updatedAt: Date.now(),
        };
      }
      Store.set({ journal });
    },

    /**
     * Debounced setter — buffers writes during typing.
     * Pass an optional callback to be notified when the save lands.
     */
    set(dateIso, text, onSaved) {
      if (!dateIso) return;
      this._pending[dateIso] = text;
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        // Flush all pending entries in one Store.set call to minimise writes
        const state = Store.get() || {};
        const journal = state.journal ? { ...state.journal } : {};
        Object.keys(this._pending).forEach(d => {
          const t = String(this._pending[d] || '').trim();
          if (!t) {
            delete journal[d];
          } else {
            journal[d] = { text: t, updatedAt: Date.now() };
          }
        });
        Store.set({ journal });
        this._pending = {};
        if (typeof onSaved === 'function') onSaved();
      }, DEBOUNCE_MS);
    },

    /**
     * Force-flush any debounced pending writes immediately.
     * Call this on tab change / page unload to avoid losing the last few keystrokes.
     */
    flush() {
      if (!this._saveTimer) return;
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      const state = Store.get() || {};
      const journal = state.journal ? { ...state.journal } : {};
      Object.keys(this._pending).forEach(d => {
        const t = String(this._pending[d] || '').trim();
        if (!t) delete journal[d];
        else journal[d] = { text: t, updatedAt: Date.now() };
      });
      Store.set({ journal });
      this._pending = {};
    },

    /**
     * How many entries the user has written.
     */
    count() {
      return this.all().length;
    },

    /**
     * Build a plain-text export of all entries. Suitable for download or copy.
     */
    buildExportText() {
      const state = Store.get() || {};
      const cfg = state.config || {};
      const entries = this.all();
      const name = (cfg.pilgrimName || '').trim();
      const lines = [];
      lines.push('Hajj Journal');
      if (name) lines.push(`By ${name}`);
      lines.push(`Generated ${new Date().toLocaleDateString()}`);
      lines.push('');
      lines.push('---');
      lines.push('');
      if (!entries.length) {
        lines.push('No entries yet.');
      } else {
        entries.forEach(e => {
          // Friendly date header
          let dateLine = e.dateIso;
          try {
            const d = new Date(e.dateIso + 'T00:00:00');
            dateLine = d.toLocaleDateString(undefined, {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
          } catch (err) { /* keep ISO fallback */ }
          lines.push(dateLine);
          lines.push('');
          lines.push(e.text);
          lines.push('');
          lines.push('---');
          lines.push('');
        });
      }
      return lines.join('\n');
    },

    /**
     * Trigger a download of the journal as a .txt file.
     */
    exportAll() {
      const text = this.buildExportText();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hajj-journal.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a short delay so the download has time to start
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };

  // Flush pending writes if the page is hidden or about to unload.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => Journal.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') Journal.flush();
    });
  }

  global.Journal = Journal;
})(window);
