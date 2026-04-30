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

  /**
   * v2.1 — Airline IATA reference for the smart flight helpers.
   * Just the carriers commonly flown by pilgrims to KSA. Not exhaustive
   * — if a user's airline isn't here, we silently fall back to no hint.
   * Each entry maps IATA prefix -> { name, statusUrl }.
   * statusUrl is a template; {flight} is replaced with the user's number.
   */
  const AIRLINES = {
    SV: { name: 'Saudia', statusUrl: 'https://www.saudia.com/manage/flight-status' },
    XY: { name: 'flynas', statusUrl: 'https://www.flynas.com/en/flight-status' },
    EK: { name: 'Emirates', statusUrl: 'https://www.emirates.com/english/manage-booking/flight-status/' },
    EY: { name: 'Etihad Airways', statusUrl: 'https://www.etihad.com/en-gb/manage/flight-status' },
    QR: { name: 'Qatar Airways', statusUrl: 'https://www.qatarairways.com/en/flight-status.html' },
    TK: { name: 'Turkish Airlines', statusUrl: 'https://www.turkishairlines.com/en-int/flights/flight-status/' },
    MS: { name: 'EgyptAir', statusUrl: 'https://www.egyptair.com/en/fly/Pages/flight-status.aspx' },
    BA: { name: 'British Airways', statusUrl: 'https://www.britishairways.com/travel/flight-information/public/en_gb' },
    VS: { name: 'Virgin Atlantic', statusUrl: 'https://www.virginatlantic.com/flight-status' },
    LH: { name: 'Lufthansa', statusUrl: 'https://www.lufthansa.com/xx/en/flight-status' },
    AF: { name: 'Air France', statusUrl: 'https://www.airfrance.us/US/en/local/transverse/flight/flight-status.htm' },
    KL: { name: 'KLM', statusUrl: 'https://www.klm.com/travel/gb_en/prepare_for_travel/checkin_options/flight_status/index.htm' },
    PK: { name: 'Pakistan International', statusUrl: 'https://www.piac.com.pk/' },
    AI: { name: 'Air India', statusUrl: 'https://www.airindia.com/in/en/manage/flight-status.html' },
    GF: { name: 'Gulf Air', statusUrl: 'https://www.gulfair.com/manage-my-booking/flight-status' },
    KU: { name: 'Kuwait Airways', statusUrl: 'https://www.kuwaitairways.com/en/manage-my-booking/flight-status' },
    RJ: { name: 'Royal Jordanian', statusUrl: 'https://www.rj.com/en/manage-my-booking/flight-status' },
    GA: { name: 'Garuda Indonesia', statusUrl: 'https://www.garuda-indonesia.com/' },
    MH: { name: 'Malaysia Airlines', statusUrl: 'https://www.malaysiaairlines.com/' },
    BG: { name: 'Biman Bangladesh', statusUrl: 'https://www.biman-airlines.com/' },
    UL: { name: 'SriLankan Airlines', statusUrl: 'https://www.srilankan.com/en_uk/flight-status' },
    AC: { name: 'Air Canada', statusUrl: 'https://www.aircanada.com/us/en/aco/home/flight-status.html' },
    UA: { name: 'United Airlines', statusUrl: 'https://www.united.com/en-us/flight-status' },
    DL: { name: 'Delta', statusUrl: 'https://www.delta.com/flightinfo/searchByFlight' },
    AA: { name: 'American Airlines', statusUrl: 'https://www.aa.com/travelInformation/flights/status' },
  };

  /**
   * Normalise a flight-number string: uppercase, strip whitespace + non-alphanumerics.
   * "ba 147" -> "BA147", " sv-124 " -> "SV124".
   */
  function normaliseFlightNumber(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Given a normalised flight number like "BA147", return { iata, airline, statusUrl }
   * or null if no match. Tries the first 2 chars (IATA standard).
   */
  function lookupAirline(flightNum) {
    const norm = normaliseFlightNumber(flightNum);
    if (norm.length < 3) return null;
    const iata = norm.slice(0, 2);
    const airline = AIRLINES[iata];
    if (!airline) return null;
    return {
      iata,
      number: norm,
      name: airline.name,
      statusUrl: airline.statusUrl,
    };
  }


  const Onboarding = {
    currentStep: 0,
    config: null,

    init(container) {
      this.container = container;
      this.config = JSON.parse(JSON.stringify(Store.getConfig()));
      // Defensive default for new operator fields (existing users haven't populated)
      if (!this.config.operator) this.config.operator = {};
      if (!('serviceProvider' in this.config.operator))      this.config.operator.serviceProvider = '';
      if (!('serviceProviderOther' in this.config.operator)) this.config.operator.serviceProviderOther = '';

      // Load Nusuk operator list (cached on window so multiple renders don't refetch)
      if (!window._OPERATOR_LIST) {
        Utils.fetchJSON('./data/operators.json')
          .then(data => {
            window._OPERATOR_LIST = data;
            // If user is currently on the operator step, re-render so the dropdown populates
            if (STEPS[this.currentStep] && STEPS[this.currentStep].id === 'operator') {
              this.render();
            }
          })
          .catch(() => { /* fail silently — dropdown shows just "Other" */ });
      }
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
      const outFlightWrap = this.buildFlightField('Flight number', 'e.g. SV124',
        this.config.outboundFlight.number,
        v => { this.config.outboundFlight.number = v; },
        'flight-hint-out'
      );
      outRow.appendChild(outFlightWrap);
      outRow.appendChild(this.buildField('Departure airport', 'text', 'e.g. LHR', this.config.outboundFlight.from, v => { this.config.outboundFlight.from = v.toUpperCase(); }));
      wrap.appendChild(outRow);

      const outRow2 = el('div', { class: 'input-row' });
      outRow2.appendChild(this.buildField('Date', 'date', '', this.config.outboundFlight.date, v => {
        this.config.outboundFlight.date = v;
        this._updateFlightDateWarning();
      }));
      outRow2.appendChild(this.buildField('Time', 'time', '', this.config.outboundFlight.time, v => { this.config.outboundFlight.time = v; }));
      wrap.appendChild(outRow2);

      wrap.appendChild(this.buildField('Arrival airport', 'text', 'MED (Madinah) or JED (Jeddah)', this.config.outboundFlight.to, v => { this.config.outboundFlight.to = v.toUpperCase(); }));

      wrap.appendChild(el('hr', { class: 'rule' }));

      // Return
      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'Return'));
      const retRow = el('div', { class: 'input-row' });
      retRow.appendChild(this.buildFlightField('Flight number', 'e.g. SV123',
        this.config.returnFlight.number,
        v => { this.config.returnFlight.number = v; },
        'flight-hint-ret'
      ));
      retRow.appendChild(this.buildField('From', 'text', 'e.g. JED', this.config.returnFlight.from, v => { this.config.returnFlight.from = v.toUpperCase(); }));
      wrap.appendChild(retRow);

      const retRow2 = el('div', { class: 'input-row' });
      retRow2.appendChild(this.buildField('Date', 'date', '', this.config.returnFlight.date, v => {
        this.config.returnFlight.date = v;
        this._updateFlightDateWarning();
      }));
      retRow2.appendChild(this.buildField('Time', 'time', '', this.config.returnFlight.time, v => { this.config.returnFlight.time = v; }));
      wrap.appendChild(retRow2);

      wrap.appendChild(this.buildField('Home airport', 'text', 'e.g. LHR', this.config.returnFlight.to, v => { this.config.returnFlight.to = v.toUpperCase(); }));

      // Date-order warning slot (populated by _updateFlightDateWarning)
      const warning = el('div', { id: 'flight-date-warning', class: 'flight-warning hidden' });
      wrap.appendChild(warning);

      // Run an initial check after mount
      requestAnimationFrame(() => this._updateFlightDateWarning());

      return wrap;
    },

    /**
     * Smart flight-number field with airline detection and verify link.
     * Renders into a wrapper div containing a label, the input, and
     * a hint area (filled in with detected airline + verify button).
     */
    buildFlightField(label, placeholder, initialValue, onValue, hintId) {
      const wrap = el('div', { class: 'field' });
      wrap.appendChild(el('label', { class: 'field__label' }, label));

      const input = el('input', {
        type: 'text',
        class: 'field__input flight-input',
        placeholder,
        value: initialValue || '',
        autocapitalize: 'characters',
        autocomplete: 'off',
        spellcheck: 'false',
      });

      const hint = el('div', { class: 'flight-hint', id: hintId });

      // Update on every keystroke: normalise + write back + render hint
      const onInput = () => {
        const raw = input.value;
        const norm = normaliseFlightNumber(raw);
        // Update displayed value if normalisation differs (preserves caret)
        if (raw !== norm) {
          const pos = input.selectionStart;
          input.value = norm;
          try { input.setSelectionRange(pos, pos); } catch (e) { /* no-op */ }
        }
        onValue(norm);
        this._renderFlightHint(hint, norm);
      };

      input.addEventListener('input', onInput);
      input.addEventListener('blur', onInput);

      wrap.appendChild(input);
      wrap.appendChild(hint);

      // Initial render of the hint
      requestAnimationFrame(() => this._renderFlightHint(hint, normaliseFlightNumber(initialValue)));
      return wrap;
    },

    /** Render the airline hint inside the given hint container. */
    _renderFlightHint(hintEl, flightNum) {
      hintEl.innerHTML = '';
      if (!flightNum || flightNum.length < 3) return;
      const lookup = lookupAirline(flightNum);
      if (!lookup) return;

      const row = el('div', { class: 'flight-hint__row' });
      row.appendChild(el('span', { class: 'flight-hint__airline' },
        el('strong', null, lookup.name),
        ' · ',
        lookup.number
      ));

      const verify = el('a', {
        href: lookup.statusUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'flight-hint__verify',
      }, 'Verify on airline website ↗');
      row.appendChild(verify);
      hintEl.appendChild(row);
    },

    /** Show/hide a warning if return date is before outbound date. */
    _updateFlightDateWarning() {
      const warn = document.getElementById('flight-date-warning');
      if (!warn) return;
      const out = this.config.outboundFlight && this.config.outboundFlight.date;
      const ret = this.config.returnFlight && this.config.returnFlight.date;
      if (!out || !ret) {
        warn.classList.add('hidden');
        warn.textContent = '';
        return;
      }
      // Compare as ISO strings (YYYY-MM-DD sorts correctly)
      if (ret < out) {
        warn.classList.remove('hidden');
        warn.textContent = 'Heads up — your return date is before your outbound date. Double-check.';
      } else if (ret === out) {
        warn.classList.remove('hidden');
        warn.textContent = 'Heads up — return and outbound are the same day. Double-check.';
      } else {
        warn.classList.add('hidden');
        warn.textContent = '';
      }
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

      // 1. Local agency (the company you booked through, e.g. Adam Travel, Hisar, Dar El Salam)
      wrap.appendChild(this.buildField(
        'Local agency you booked through',
        'text',
        'e.g. Adam Travel, Hisar Tour, Dar El Salam',
        this.config.operator.name,
        v => { this.config.operator.name = v; }
      ));

      // 2. Saudi service provider (Nusuk-approved) — dropdown
      wrap.appendChild(this._buildServiceProviderField());

      // 3. Group leader + phone
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

    /**
     * Build a select-with-fallback for the Saudi service provider.
     * Reads the list from window._OPERATOR_LIST (loaded via fetchJSON in init).
     */
    _buildServiceProviderField() {
      const wrap = el('div', { class: 'field' });
      wrap.appendChild(el('label', { class: 'field__label' }, 'Saudi Service Provider (Nusuk-approved)'));
      wrap.appendChild(el('div', { class: 'field__hint' },
        'Optional. The Saudi company that operates your package on the ground. Different from your local agency.'
      ));

      const select = el('select', { class: 'field__input' });
      select.appendChild(el('option', { value: '' }, '— select if known —'));

      const list = (window._OPERATOR_LIST && window._OPERATOR_LIST.providers) || [];
      list.forEach(p => {
        const opt = el('option', { value: p.id }, p.name);
        if (this.config.operator.serviceProvider === p.id) opt.selected = true;
        select.appendChild(opt);
      });

      // Allow free text for "other" — append a special option, then reveal a text input
      const otherOpt = el('option', { value: '__other__' }, 'Other (not on the Nusuk list)');
      if (this.config.operator.serviceProvider === '__other__' ||
          (this.config.operator.serviceProviderOther &&
           !list.some(p => p.id === this.config.operator.serviceProvider))) {
        otherOpt.selected = true;
      }
      select.appendChild(otherOpt);

      const otherInput = el('input', {
        type: 'text',
        class: 'field__input',
        placeholder: 'Provider name',
        value: this.config.operator.serviceProviderOther || '',
        style: { marginTop: '8px', display: select.value === '__other__' ? 'block' : 'none' },
      });

      select.addEventListener('change', () => {
        const val = select.value;
        if (val === '__other__') {
          this.config.operator.serviceProvider = '__other__';
          otherInput.style.display = 'block';
          otherInput.focus();
        } else {
          this.config.operator.serviceProvider = val;
          this.config.operator.serviceProviderOther = '';
          otherInput.style.display = 'none';
        }
      });

      otherInput.addEventListener('input', () => {
        this.config.operator.serviceProviderOther = otherInput.value;
      });

      wrap.appendChild(select);
      wrap.appendChild(otherInput);
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
