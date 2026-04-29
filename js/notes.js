/* =============================================================
   NOTES — Per-section notes saved to localStorage
   Slide-out panel triggered by floating button.
   ============================================================= */

(function (global) {
  'use strict';

  const Notes = {
    panel: null,
    fab: null,
    currentSection: 'general',

    init() {
      // Build the floating button
      this.fab = Utils.el('button', {
        class: 'notes-fab',
        'aria-label': 'Open notes',
        title: 'Notes for this section',
        onclick: () => this.toggle(),
      });
      this.fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
      document.body.appendChild(this.fab);

      // Build the panel
      this.panel = Utils.el('aside', { class: 'notes-panel', 'aria-hidden': 'true' });
      this.panel.appendChild(this.buildPanel());
      document.body.appendChild(this.panel);

      // Auto-detect current section based on active tab
      Store.on('change', () => this.refresh());
    },

    buildPanel() {
      const wrap = document.createDocumentFragment();

      const header = Utils.el('div', { class: 'notes-panel__header' });
      this.titleEl = Utils.el('h3', { class: 'notes-panel__title' }, 'Your Notes');
      const close = Utils.el('button', {
        class: 'notes-panel__close',
        'aria-label': 'Close',
        onclick: () => this.close(),
      }, '×');
      header.appendChild(this.titleEl);
      header.appendChild(close);

      const body = Utils.el('div', { class: 'notes-panel__body' });
      this.sectionLabel = Utils.el('div', {
        class: 'eyebrow',
        style: { marginBottom: '8px' }
      }, 'General');
      this.textarea = Utils.el('textarea', {
        class: 'notes-panel__textarea',
        placeholder: 'Tap here to write notes about this section. Reflections, things to remember, lessons from the journey…',
      });
      this.textarea.addEventListener('input', Utils.debounce(() => {
        Store.setNote(this.currentSection, this.textarea.value);
        this.updateStatus('Saved');
      }, 400));
      body.appendChild(this.sectionLabel);
      body.appendChild(this.textarea);

      const footer = Utils.el('div', { class: 'notes-panel__footer' });
      this.statusEl = Utils.el('span', null, 'Notes auto-save as you type');
      footer.appendChild(this.statusEl);

      // Export all notes as a button
      const exportBtn = Utils.el('button', {
        class: 'btn btn--ghost',
        style: { float: 'right' },
        onclick: () => this.exportAll(),
      }, 'Export all notes');
      footer.appendChild(exportBtn);

      const fragment = document.createDocumentFragment();
      fragment.appendChild(header);
      fragment.appendChild(body);
      fragment.appendChild(footer);
      return fragment;
    },

    setSection(sectionId, label) {
      this.currentSection = sectionId;
      if (this.sectionLabel) {
        this.sectionLabel.textContent = label || sectionId;
      }
      if (this.textarea) {
        this.textarea.value = Store.getNote(sectionId);
      }
    },

    refresh() {
      if (this.textarea && this.panel.classList.contains('is-open')) {
        this.textarea.value = Store.getNote(this.currentSection);
      }
    },

    open() {
      this.refresh();
      this.panel.classList.add('is-open');
      this.panel.setAttribute('aria-hidden', 'false');
    },

    close() {
      this.panel.classList.remove('is-open');
      this.panel.setAttribute('aria-hidden', 'true');
    },

    toggle() {
      if (this.panel.classList.contains('is-open')) this.close();
      else this.open();
    },

    updateStatus(msg) {
      if (!this.statusEl) return;
      this.statusEl.textContent = msg;
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => {
        this.statusEl.textContent = 'Notes auto-save as you type';
      }, 1500);
    },

    exportAll() {
      const notes = Store.get().notes || {};
      const lines = [];
      lines.push('═══════════════════════════════');
      lines.push('  MY HAJJ NOTES');
      lines.push('  ' + new Date().toLocaleString());
      lines.push('═══════════════════════════════');
      lines.push('');
      const entries = Object.entries(notes).filter(([_, v]) => v && v.trim());
      if (entries.length === 0) {
        Utils.toast('No notes to export yet');
        return;
      }
      entries.forEach(([section, content]) => {
        lines.push(`── ${section.toUpperCase()} ──`);
        lines.push(content);
        lines.push('');
        lines.push('');
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = Utils.el('a', {
        href: url,
        download: `hajj-notes-${new Date().toISOString().slice(0,10)}.txt`,
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },

    show() { this.fab.style.display = ''; },
    hide() { this.fab.style.display = 'none'; },
  };

  global.Notes = Notes;
})(window);
