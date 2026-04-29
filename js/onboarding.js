/* =============================================================
   ONBOARDING — Multi-step wizard that captures user config
   ============================================================= */

(function (global) {
  'use strict';

  const { $, $$, el } = Utils;

  const STEPS = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'flights', title: 'Your Flights' },
    { id: 'madhab',  title: 'Your Madhab' },
    { id: 'operator', title: 'Hajj Operator' },
    { id: 'accommodation', title: 'Where You Will Stay' },
    { id: 'group', title: 'Travel Companions' },
  ];

  const Onboarding = {
    currentStep: 0,
    config: null,

    init(container) {
      this.container = container;
      this.config = JSON.parse(JSON.stringify(Store.getConfig()));
      this.render();
    },

    render() {
      this.container.innerHTML = '';
      this.container.appendChild(this.buildProgress());

      const stepsHost = el('div', { class: 'onboarding__steps' });
      STEPS.forEach((step, i) => {
        const stepEl = el('div', {
          class: 'onboarding__step' + (i === this.currentStep ? ' is-active' : ''),
          'data-step': step.id,
        });
        stepEl.appendChild(this.buildStep(step.id));
        stepsHost.appendChild(stepEl);
      });
      this.container.appendChild(stepsHost);

      this.container.appendChild(this.buildNav());
    },

    buildProgress() {
      const wrap = el('div', { class: 'onboarding__progress' });
      STEPS.forEach((_, i) => {
        const cls = i < this.currentStep ? 'is-done'
                  : i === this.currentStep ? 'is-current' : '';
        wrap.appendChild(el('span', { class: cls }));
      });
      return wrap;
    },

    buildNav() {
      const isLast = this.currentStep === STEPS.length - 1;
      const isFirst = this.currentStep === 0;

      const nav = el('div', { class: 'onboarding__nav' });

      const back = el('button', {
        class: 'btn btn--ghost',
        onclick: () => this.prev(),
        style: { visibility: isFirst ? 'hidden' : 'visible' }
      }, '← Back');

      const skip = el('button', {
        class: 'btn btn--ghost',
        onclick: () => this.skip(),
      }, 'Skip for now');

      const next = el('button', {
        class: 'btn btn--primary',
        onclick: () => this.next(),
      }, isLast ? 'Begin Your Journey →' : 'Continue →');

      nav.appendChild(back);
      nav.appendChild(skip);
      nav.appendChild(next);
      return nav;
    },

    /* ─── Step builders ────────────────────────────────────── */

    buildStep(id) {
      switch (id) {
        case 'welcome': return this.stepWelcome();
        case 'flights': return this.stepFlights();
        case 'madhab': return this.stepMadhab();
        case 'operator': return this.stepOperator();
        case 'accommodation': return this.stepAccommodation();
        case 'group': return this.stepGroup();
      }
      return el('div');
    },

    stepWelcome() {
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'onboarding__step-num' }, 'Bismillah'));
      wrap.appendChild(el('h2', { class: 'onboarding__step-title' }, 'Welcome.'));
      wrap.appendChild(el('p', { class: 'onboarding__step-desc' },
        'This companion will become a personalised guide to your Hajj — your dates, your flights, your madhab, your accommodation. Everything is stored only on this device. Nothing is sent anywhere.'
      ));
      wrap.appendChild(el('div', { class: 'callout callout--info' },
        el('p', { style: { margin: 0 } },
          el('strong', null, 'A note on what follows: '),
          'This is a planning aid, not a fatwa. Always confirm rulings with a qualified scholar of your madhab. May Allah accept your Hajj and grant you ease.'
        )
      ));
      wrap.appendChild(el('p', { class: 'text-mute italic', style: { marginTop: '32px' } },
        'You can skip any question and return later from settings.'
      ));
      return wrap;
    },

    stepFlights() {
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'onboarding__step-num' }, 'Step 1 of 5'));
      wrap.appendChild(el('h2', { class: 'onboarding__step-title' }, 'Your flights.'));
      wrap.appendChild(el('p', { class: 'onboarding__step-desc' },
        'Add your flight numbers and dates so the guide can plan around them.'
      ));

      // Outbound
      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'Outbound'));
      const outRow = el('div', { class: 'input-row' });
      outRow.appendChild(this.buildField('Flight number', 'text', 'e.g. SV124', this.config.outboundFlight.number, v => { this.config.outboundFlight.number = v; }));
      outRow.appendChild(this.buildField('Departure airport', 'text', 'e.g. LHR', this.config.outboundFlight.from, v => { this.config.outboundFlight.from = v.toUpperCase(); }));
      wrap.appendChild(outRow);

      const outRow2 = el('div', { class: 'input-row' });
      outRow2.appendChild(this.buildField('Date', 'date', '', this.config.outboundFlight.date, v => { this.config.outboundFlight.date = v; }));
      outRow2.appendChild(this.buildField('Time', 'time', '', this.config.outboundFlight.time, v => { this.config.outboundFlight.time = v; }));
      wrap.appendChild(outRow2);

      wrap.appendChild(this.buildField('Arrival airport', 'text', 'MED (Madinah) or JED (Jeddah)', this.config.outboundFlight.to, v => { this.config.outboundFlight.to = v.toUpperCase(); }));

      wrap.appendChild(el('hr', { class: 'rule' }));

      // Return
      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'Return'));
      const retRow = el('div', { class: 'input-row' });
      retRow.appendChild(this.buildField('Flight number', 'text', 'e.g. SV123', this.config.returnFlight.number, v => { this.config.returnFlight.number = v; }));
      retRow.appendChild(this.buildField('From', 'text', 'e.g. JED', this.config.returnFlight.from, v => { this.config.returnFlight.from = v.toUpperCase(); }));
      wrap.appendChild(retRow);

      const retRow2 = el('div', { class: 'input-row' });
      retRow2.appendChild(this.buildField('Date', 'date', '', this.config.returnFlight.date, v => { this.config.returnFlight.date = v; }));
      retRow2.appendChild(this.buildField('Time', 'time', '', this.config.returnFlight.time, v => { this.config.returnFlight.time = v; }));
      wrap.appendChild(retRow2);

      wrap.appendChild(this.buildField('Home airport', 'text', 'e.g. LHR', this.config.returnFlight.to, v => { this.config.returnFlight.to = v.toUpperCase(); }));

      return wrap;
    },

    stepMadhab() {
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'onboarding__step-num' }, 'Step 2 of 5'));
      wrap.appendChild(el('h2', { class: 'onboarding__step-title' }, 'Your madhab.'));
      wrap.appendChild(el('p', { class: 'onboarding__step-desc' },
        'Rulings throughout the guide will reflect the school you choose. You can switch any time.'
      ));

      const grid = el('div', { class: 'option-grid' });
      const madhabs = [
        { id: 'hanafi', title: 'Hanafi', hint: 'School of Imam Abu Hanifa' },
        { id: 'shafi', title: 'Shafi\'i', hint: 'School of Imam ash-Shafi\'i' },
        { id: 'maliki', title: 'Maliki', hint: 'School of Imam Malik' },
        { id: 'hanbali', title: 'Hanbali', hint: 'School of Imam Ahmad' },
      ];
      madhabs.forEach(m => {
        const card = el('label', {
          class: 'option-card' + (this.config.madhab === m.id ? ' is-selected' : ''),
        });
        const input = el('input', { type: 'radio', name: 'madhab', value: m.id });
        if (this.config.madhab === m.id) input.checked = true;
        input.addEventListener('change', () => {
          this.config.madhab = m.id;
          $$('.option-card', grid).forEach(c => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
        });
        card.appendChild(input);
        card.appendChild(el('span', { class: 'option-card__title' }, m.title));
        card.appendChild(el('span', { class: 'option-card__hint' }, m.hint));
        grid.appendChild(card);
      });
      wrap.appendChild(grid);

      wrap.appendChild(el('div', { class: 'callout' },
        el('p', { style: { margin: 0 } },
          'If you are unsure, choose the school followed by the majority in your community or by the scholar you usually consult.'
        )
      ));
      return wrap;
    },

    stepOperator() {
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'onboarding__step-num' }, 'Step 3 of 5'));
      wrap.appendChild(el('h2', { class: 'onboarding__step-title' }, 'Your Hajj operator.'));
      wrap.appendChild(el('p', { class: 'onboarding__step-desc' },
        'Their details will appear on your emergency card. Keep this accessible offline.'
      ));

      wrap.appendChild(this.buildField('Operator name', 'text', 'e.g. Al-Hidaya Tours', this.config.operator.name, v => { this.config.operator.name = v; }));

      const row1 = el('div', { class: 'input-row' });
      row1.appendChild(this.buildField('Your group leader', 'text', 'Name', this.config.operator.contactName, v => { this.config.operator.contactName = v; }));
      row1.appendChild(this.buildField('Group leader phone', 'tel', '+966...', this.config.operator.contactPhone, v => { this.config.operator.contactPhone = v; }));
      wrap.appendChild(row1);

      wrap.appendChild(this.buildField('24-hr emergency line', 'tel', 'Operator emergency contact', this.config.operator.emergencyPhone, v => { this.config.operator.emergencyPhone = v; }));

      wrap.appendChild(el('div', { class: 'callout callout--info' },
        el('p', { style: { margin: 0 } },
          el('strong', null, 'Tip: '), 'Save these in your phone contacts as well, in case the device is reset or the browser cache is cleared.'
        )
      ));
      return wrap;
    },

    stepAccommodation() {
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'onboarding__step-num' }, 'Step 4 of 5'));
      wrap.appendChild(el('h2', { class: 'onboarding__step-title' }, 'Where you will stay.'));
      wrap.appendChild(el('p', { class: 'onboarding__step-desc' },
        'Knowing your hotels lets the guide calculate distances and embed walking maps.'
      ));

      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'In Madinah'));
      const madinahWrap = this.buildPlacesField(
        'Hotel or building name',
        'Start typing to search',
        this.config.madinahHotel,
        'madinah',
        (place) => { this.config.madinahHotel = place; }
      );
      wrap.appendChild(madinahWrap);

      wrap.appendChild(el('hr', { class: 'rule' }));

      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'In Makkah'));
      const makkahWrap = this.buildPlacesField(
        'Hotel or building name',
        'Start typing to search',
        this.config.makkahHotel,
        'makkah',
        (place) => { this.config.makkahHotel = place; }
      );
      wrap.appendChild(makkahWrap);

      // Note about Places API
      const apiKey = (window.APP_CONFIG && window.APP_CONFIG.googleMapsApiKey) || '';
      if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        wrap.appendChild(el('div', { class: 'callout' },
          el('p', { style: { margin: 0 }, html: 'Address autocomplete is currently disabled. Type your hotel name manually — it will still appear in the guide. Site owner: configure your Google Maps API key in <code>js/config.js</code> to enable autocomplete.' })
        ));
      }
      return wrap;
    },

    stepGroup() {
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'onboarding__step-num' }, 'Step 5 of 5'));
      wrap.appendChild(el('h2', { class: 'onboarding__step-title' }, 'Your travel companions.'));
      wrap.appendChild(el('p', { class: 'onboarding__step-desc' },
        'For the lost-group emergency card. Useful if you become separated in the crowds.'
      ));

      wrap.appendChild(this.buildField(
        'Total people in your party (including you)',
        'number', '1', String(this.config.groupSize || 1),
        v => { this.config.groupSize = Math.max(1, parseInt(v) || 1); }
      ));

      const contacts = el('div', { class: 'group-contacts' });
      const renderContacts = () => {
        contacts.innerHTML = '';
        contacts.appendChild(el('h4', { class: 'eyebrow' }, 'Contacts (companions or family back home)'));

        (this.config.groupContacts || []).forEach((c, i) => {
          const row = el('div', { class: 'input-row', style: { marginBottom: '8px' } });
          row.appendChild(this.buildField('Name', 'text', '', c.name || '', v => { this.config.groupContacts[i].name = v; }, true));
          row.appendChild(this.buildField('Phone', 'tel', '', c.phone || '', v => { this.config.groupContacts[i].phone = v; }, true));
          contacts.appendChild(row);
          const remove = el('button', {
            class: 'btn btn--ghost',
            type: 'button',
            style: { fontSize: '12px', marginBottom: '12px' },
            onclick: () => {
              this.config.groupContacts.splice(i, 1);
              renderContacts();
            }
          }, '× Remove');
          contacts.appendChild(remove);
        });

        const add = el('button', {
          class: 'btn btn--secondary',
          type: 'button',
          onclick: () => {
            this.config.groupContacts = this.config.groupContacts || [];
            this.config.groupContacts.push({ name: '', phone: '' });
            renderContacts();
          }
        }, '+ Add a contact');
        contacts.appendChild(add);
      };
      renderContacts();
      wrap.appendChild(contacts);
      return wrap;
    },

    /* ─── Field helpers ────────────────────────────────────── */

    buildField(label, type, placeholder, value, onInput, compact) {
      const wrap = el('div', { class: 'field' });
      wrap.appendChild(el('label', { class: 'field__label' }, label));
      const input = el('input', {
        class: 'input',
        type, placeholder,
        value: value || '',
      });
      input.addEventListener('input', e => onInput(e.target.value));
      wrap.appendChild(input);
      return wrap;
    },

    buildPlacesField(label, placeholder, currentValue, key, onSelect) {
      const wrap = el('div', { class: 'field' });
      wrap.appendChild(el('label', { class: 'field__label' }, label));

      const input = el('input', {
        class: 'input',
        type: 'text',
        placeholder,
        value: currentValue && currentValue.name ? currentValue.name : '',
        autocomplete: 'off',
      });

      input.addEventListener('input', e => {
        // Manual fallback — store name even without place_id
        const v = e.target.value;
        if (key === 'madinah') {
          this.config.madinahHotel = { ...this.config.madinahHotel, name: v };
        } else {
          this.config.makkahHotel = { ...this.config.makkahHotel, name: v };
        }
      });

      wrap.appendChild(input);

      // Hook into Maps Autocomplete if available
      if (window.Maps && Maps.attachAutocomplete) {
        Maps.attachAutocomplete(input, key, (place) => {
          if (key === 'madinah') {
            this.config.madinahHotel = place;
          } else {
            this.config.makkahHotel = place;
          }
        });
      }

      // Also show a hint of detected coords if any
      if (currentValue && currentValue.lat) {
        wrap.appendChild(el('span', { class: 'field__hint' },
          `📍 ${currentValue.address || 'Location saved'}`
        ));
      }

      return wrap;
    },

    /* ─── Navigation ───────────────────────────────────────── */

    next() {
      this.persistCurrent();
      if (this.currentStep < STEPS.length - 1) {
        this.currentStep++;
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        this.complete();
      }
    },

    prev() {
      this.persistCurrent();
      if (this.currentStep > 0) {
        this.currentStep--;
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },

    skip() {
      // Mark as onboarded and proceed to app even with empty config
      this.persistCurrent();
      this.complete();
    },

    persistCurrent() {
      Store.set({ config: this.config });
    },

    complete() {
      Store.set({ onboarded: true, config: this.config });
      // Redirect to the main guide
      window.location.href = './app.html';
    }
  };

  global.Onboarding = Onboarding;
})(window);
