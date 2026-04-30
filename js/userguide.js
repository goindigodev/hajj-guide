/* =============================================================
   USER GUIDE — A modal-based slide-show that walks pilgrims through
   the main features of Hajj Guide. Triggered by the (i) button in
   the header. On-demand only (no auto-show on first visit).
   ============================================================= */

(function (global) {
  'use strict';

  // Slide content. Each slide has:
  //   title  — short heading
  //   body   — one-sentence subtitle
  //   bullets — array of bullet lines
  //   img    — relative path to the screenshot
  //   imgAlt — accessibility caption
  const SLIDES = [
    {
      title: 'Welcome',
      body: 'Hajj Guide is a free planning aid that adapts to your dates and madhab. Here is a quick tour of the main features.',
      bullets: [
        'Personalised to your flight dates and accommodation',
        'Madhab-aware rulings (Hanafi, Shafi\u2019i, Maliki, Hanbali)',
        'Works offline once loaded',
        'Your data stays on your device — nothing is sent anywhere',
      ],
      // No image on the welcome slide — the body text is enough
    },
    {
      title: 'Today',
      body: 'Your landing page during the trip. Shows what is happening today and links to tomorrow\u2019s plan.',
      bullets: [
        'Today\u2019s day card opens automatically',
        'Quick countdown if your trip has not started',
        'Yesterday recap and tomorrow preview while on-trip',
      ],
      img: './img/userguide/01-today.jpg',
      imgAlt: 'The Today tab showing today\u2019s open day card with the date in serif at the top',
    },
    {
      title: 'Itinerary',
      body: 'A day-by-day plan of your whole trip — every day from departure to return is here.',
      bullets: [
        'Tap any day to expand and see the rituals, prayers, and notes for that day',
        'Phase pills at the top jump to Madinah, Makkah, the 5 days of Hajj, or Tawaf al-Wada',
        'A journey map at the top shows the geography of the trip at a glance',
        'Print the full itinerary as a single document with the button in the top-right',
      ],
      img: './img/userguide/02-itinerary.jpg',
      imgAlt: 'The Itinerary tab heading with the Print full itinerary button on the right',
    },
    {
      title: 'Add your own stops',
      body: 'Each itinerary day has a "Your stops" section. Add Ziyarat visits, group activities, errands — anything you want to remember.',
      bullets: [
        'Pick from 21 curated places in Madinah and Makkah, or type your own',
        'Optional start and end times',
        'Stops appear chronologically, with the curated description as a subtitle',
        'Editable any time — tap Edit or Remove on any stop',
      ],
      img: './img/userguide/03-stops.jpg',
      imgAlt: 'A day card with three custom stops — Quba Mosque, Date market, Jannat al-Baqi — and a Reflection textarea below',
    },
    {
      title: 'Duas',
      body: 'Every supplication for the journey, with Arabic, transliteration, English translation, and source.',
      bullets: [
        'Arrival, ihram, tawaf, sa\u2019i, Arafah, Muzdalifah, Mina, Tawaf al-Wada — all here',
        'Source citations from authentic hadith collections',
        'The Rulings tab shows what each madhab holds, side by side',
      ],
      img: './img/userguide/04-duas.jpg',
      imgAlt: 'The Duas tab showing the Talbiyah dua with Arabic, transliteration, and English translation',
    },
    {
      title: 'Hajj journal',
      body: 'A space to record your reflections day by day. Entries appear inline with each Itinerary day AND in a dedicated Journal tab.',
      bullets: [
        'Write directly into the Reflection textarea on any day card — auto-saves as you type',
        'The Journal tab aggregates all entries chronologically',
        'Export as a text file — keep your reflections after the trip is over',
      ],
      img: './img/userguide/05-journal.jpg',
      imgAlt: 'The Journal tab showing one entry with date, body text, and an Edit on the Itinerary link',
    },
    {
      title: 'Emergency card',
      body: 'A printable single-page card with everything someone helping you would need.',
      bullets: [
        'Your name, madhab, group leader, 24-hr operator line',
        'Madinah and Makkah hotels with check-in dates',
        'Saudi emergency numbers (911, 997, 999, 998, 930)',
        'A QR code linking directly to the operator\u2019s emergency phone',
        'Print it from the Overview tab — keep a copy in each bag',
      ],
      img: './img/userguide/06-emergency-card-print.jpg',
      imgAlt: 'The printable Emergency Card with pilgrim details on the left and a large QR code on the right',
    },
    {
      title: 'Settings',
      body: 'Manage your name, edit trip details, change text size, or reset everything.',
      bullets: [
        'Your name appears on the printed emergency card',
        'Text size — four levels for comfortable reading at any distance',
        'Edit trip details — update flights, hotels, operator any time',
        'Reset all data — useful if you want to start over',
      ],
      img: './img/userguide/07-settings.jpg',
      imgAlt: 'The Settings tab showing the Your Name field, Trip Details, and Reset options',
    },
  ];

  const UserGuide = {
    overlay: null,
    modal: null,
    currentSlide: 0,
    keydownHandler: null,

    /**
     * Open the user-guide modal. Always starts on slide 0.
     */
    open() {
      this.currentSlide = 0;
      if (!this.overlay) this._buildModal();
      // Re-render to ensure latest slide content + state are reflected
      this._render();
      document.body.classList.add('userguide-open');
      this.overlay.classList.add('is-visible');
      this.overlay.setAttribute('aria-hidden', 'false');
      // Focus the close button so Esc/Enter work right away
      const closeBtn = this.overlay.querySelector('.userguide__close');
      if (closeBtn) closeBtn.focus();
      // Lock background scroll
      this._lockScroll(true);
      // Bind Esc-to-close
      this.keydownHandler = (e) => this._onKeydown(e);
      document.addEventListener('keydown', this.keydownHandler);
    },

    /**
     * Close the user-guide modal.
     */
    close() {
      if (!this.overlay) return;
      this.overlay.classList.remove('is-visible');
      this.overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('userguide-open');
      this._lockScroll(false);
      if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }
      // Return focus to the trigger if available
      const trigger = document.getElementById('btn-userguide');
      if (trigger) trigger.focus();
    },

    /**
     * Build modal DOM once. Subsequent opens reuse it.
     */
    _buildModal() {
      const el = (tag, attrs, ...kids) => {
        const e = document.createElement(tag);
        if (attrs) {
          Object.keys(attrs).forEach(k => {
            if (k === 'class') e.className = attrs[k];
            else if (k.startsWith('aria-') || k === 'role' || k === 'tabindex')
              e.setAttribute(k, attrs[k]);
            else e[k] = attrs[k];
          });
        }
        kids.forEach(k => {
          if (k == null) return;
          if (typeof k === 'string') e.appendChild(document.createTextNode(k));
          else e.appendChild(k);
        });
        return e;
      };

      this.overlay = el('div', {
        class: 'userguide-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'userguide-title',
        'aria-hidden': 'true',
      });

      this.modal = el('div', { class: 'userguide-modal' });

      // Close button (top-right)
      const closeBtn = el('button', {
        type: 'button',
        class: 'userguide__close',
        'aria-label': 'Close user guide',
      });
      closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      closeBtn.addEventListener('click', () => this.close());
      this.modal.appendChild(closeBtn);

      // Slide host — re-rendered on each navigate
      const host = el('div', { class: 'userguide__slide-host' });
      this.modal.appendChild(host);

      // Footer: prev / counter / next
      const footer = el('div', { class: 'userguide__footer' });

      const prevBtn = el('button', {
        type: 'button',
        class: 'userguide__nav userguide__nav--prev',
      }, '\u2190 Back');
      prevBtn.addEventListener('click', () => this._navigate(-1));
      footer.appendChild(prevBtn);

      const dots = el('div', { class: 'userguide__dots', 'aria-hidden': 'true' });
      footer.appendChild(dots);

      const nextBtn = el('button', {
        type: 'button',
        class: 'userguide__nav userguide__nav--next btn btn--primary',
      }, 'Next \u2192');
      nextBtn.addEventListener('click', () => this._navigate(+1));
      footer.appendChild(nextBtn);

      this.modal.appendChild(footer);
      this.overlay.appendChild(this.modal);

      // Click outside the modal closes it
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });

      document.body.appendChild(this.overlay);
    },

    /**
     * Render the current slide into the host container.
     */
    _render() {
      const slide = SLIDES[this.currentSlide];
      if (!slide || !this.modal) return;

      const host = this.modal.querySelector('.userguide__slide-host');
      host.innerHTML = '';

      // Slide eyebrow + title
      const eyebrow = document.createElement('div');
      eyebrow.className = 'userguide__eyebrow';
      eyebrow.textContent = `Step ${this.currentSlide + 1} of ${SLIDES.length}`;
      host.appendChild(eyebrow);

      const title = document.createElement('h2');
      title.id = 'userguide-title';
      title.className = 'userguide__title';
      title.textContent = slide.title;
      host.appendChild(title);

      const body = document.createElement('p');
      body.className = 'userguide__body';
      body.textContent = slide.body;
      host.appendChild(body);

      // Image (skipped on welcome slide)
      if (slide.img) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'userguide__img-wrap';
        const img = document.createElement('img');
        img.className = 'userguide__img';
        img.src = slide.img;
        img.alt = slide.imgAlt || '';
        // Lazy load to keep modal-open snappy if the user never reaches this slide
        img.loading = 'lazy';
        imgWrap.appendChild(img);
        host.appendChild(imgWrap);
      }

      // Bullets
      if (slide.bullets && slide.bullets.length) {
        const list = document.createElement('ul');
        list.className = 'userguide__bullets';
        slide.bullets.forEach(text => {
          const li = document.createElement('li');
          li.textContent = text;
          list.appendChild(li);
        });
        host.appendChild(list);
      }

      // Reset host scroll on navigate so users see the top of each slide
      host.scrollTop = 0;

      // Update prev/next + dots
      this._updateNavState();
    },

    _updateNavState() {
      if (!this.modal) return;
      const prev = this.modal.querySelector('.userguide__nav--prev');
      const next = this.modal.querySelector('.userguide__nav--next');
      const dotsHost = this.modal.querySelector('.userguide__dots');

      // Prev disabled on first slide
      prev.disabled = this.currentSlide === 0;
      prev.style.visibility = this.currentSlide === 0 ? 'hidden' : 'visible';

      // Next becomes "Done" on last slide
      if (this.currentSlide === SLIDES.length - 1) {
        next.textContent = 'Done \u2713';
        next.dataset.done = '1';
      } else {
        next.textContent = 'Next \u2192';
        delete next.dataset.done;
      }

      // Re-render the dot indicators
      dotsHost.innerHTML = '';
      SLIDES.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'userguide__dot' + (i === this.currentSlide ? ' is-active' : '');
        dot.setAttribute('aria-label', `Go to step ${i + 1}`);
        dot.addEventListener('click', () => {
          this.currentSlide = i;
          this._render();
        });
        dotsHost.appendChild(dot);
      });
    },

    _navigate(direction) {
      const next = this.currentSlide + direction;
      if (next < 0) return;
      if (next >= SLIDES.length) {
        // Pressing "Done" on the last slide closes
        this.close();
        return;
      }
      this.currentSlide = next;
      this._render();
    },

    _onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowLeft') {
        if (this.currentSlide > 0) this._navigate(-1);
      } else if (e.key === 'ArrowRight') {
        this._navigate(+1);
      }
    },

    /**
     * Prevent scrolling of the page behind the modal.
     */
    _lockScroll(lock) {
      if (lock) {
        this._savedScrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._savedScrollY}px`;
        document.body.style.width = '100%';
      } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        if (typeof this._savedScrollY === 'number') {
          window.scrollTo(0, this._savedScrollY);
          this._savedScrollY = null;
        }
      }
    },
  };

  global.UserGuide = UserGuide;
})(window);
