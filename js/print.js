/* =============================================================
   PRINT — Per-section printing (uses window.print + print.css)
   ============================================================= */

(function (global) {
  'use strict';

  const Print = {
    /**
     * Print the currently active tab section.
     * Adds a print header with user's personalized info, then triggers print.
     */
    printActiveTab() {
      const active = document.querySelector('.tab-content.is-active');
      if (!active) {
        window.print();
        return;
      }
      // Add temporary print header
      const header = this.buildPrintHeader();
      active.classList.add('is-printing');
      active.prepend(header);

      // Wait a tick so layout settles, then print
      requestAnimationFrame(() => {
        window.print();
        // Clean up after print dialog
        setTimeout(() => {
          header.remove();
          active.classList.remove('is-printing');
        }, 500);
      });
    },

    buildPrintHeader() {
      const config = Store.getConfig();
      const wrap = Utils.el('div', { class: 'print-header' });

      const title = Utils.el('div', { class: 'print-header__title' }, 'My Hajj Guide');
      const sub = Utils.el('div', { class: 'print-header__sub' });

      const parts = [];
      if (config.outboundFlight && config.outboundFlight.date) {
        parts.push(`Departure: ${Utils.formatDate(config.outboundFlight.date)}`);
      }
      if (config.returnFlight && config.returnFlight.date) {
        parts.push(`Return: ${Utils.formatDate(config.returnFlight.date)}`);
      }
      if (config.madhab) {
        parts.push(`Madhab: ${config.madhab.charAt(0).toUpperCase() + config.madhab.slice(1)}`);
      }
      sub.textContent = parts.join(' · ');

      wrap.appendChild(title);
      wrap.appendChild(sub);
      return wrap;
    },

    /**
     * v2.7 — Print the dedicated emergency card.
     * Builds the card, mounts it in an overlay, marks body so the print stylesheet
     * shows ONLY the card, calls window.print(), then cleans up.
     */
    printEmergencyCard() {
      if (!window.Guide || !Guide.renderEmergencyCardPrintable) {
        console.warn('Print.printEmergencyCard: Guide module unavailable');
        window.print();
        return;
      }
      // Build the printable card and mount in an overlay
      const card = Guide.renderEmergencyCardPrintable();
      const overlay = Utils.el('div', { id: 'em-print-overlay' });
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      document.body.classList.add('is-printing-emergency');

      // Wait two frames for layout + SVG QR rasterisation, then print
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          // Clean up after the print dialog closes
          setTimeout(() => {
            overlay.remove();
            document.body.classList.remove('is-printing-emergency');
          }, 600);
        });
      });
    },

    /**
     * Add a print button to a section.
     */
    addPrintButton(container, label) {
      const btn = Utils.el('button', {
        class: 'btn btn--ghost',
        'data-no-print': '',
        onclick: () => this.printActiveTab(),
        style: { fontSize: '13px' },
      }, label || '🖨 Print this section');
      container.appendChild(btn);
      return btn;
    }
  };

  global.Print = Print;
})(window);
