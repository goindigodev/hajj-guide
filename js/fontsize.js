/* =============================================================
   FONTSIZE — Letter sizing control with persistence
   ============================================================= */

(function (global) {
  'use strict';

  const SCALES = [0.875, 1.0, 1.15, 1.35]; // A− / A / A+ / A++
  const LABELS = ['A', 'A', 'A', 'A'];

  const FontSize = {
    init() {
      const level = (Store.get().preferences && Store.get().preferences.fontSize) ?? 1;
      this.apply(level);
    },

    apply(level) {
      const scale = SCALES[level] || 1;
      document.documentElement.style.setProperty('--fs-scale', scale);
      Store.setFontSize(level);
      // Update active state on any control on the page
      document.querySelectorAll('.fontsize-control button').forEach((btn, i) => {
        btn.classList.toggle('is-active', i === level);
      });
    },

    /**
     * Build a control widget. Adds it to the given container.
     */
    renderControl(container) {
      container.innerHTML = '';
      const wrap = Utils.el('div', { class: 'fontsize-control', role: 'group', 'aria-label': 'Adjust text size' });
      const current = (Store.get().preferences && Store.get().preferences.fontSize) ?? 1;
      LABELS.forEach((label, i) => {
        const btn = Utils.el('button', {
          type: 'button',
          'aria-label': `Text size ${i + 1} of ${LABELS.length}`,
          title: ['Smallest', 'Standard', 'Larger', 'Largest'][i],
          class: i === current ? 'is-active' : '',
          onclick: () => this.apply(i),
        }, label);
        wrap.appendChild(btn);
      });
      container.appendChild(wrap);
    }
  };

  global.FontSize = FontSize;
})(window);
