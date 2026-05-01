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
      // v2.2 — defensive default for Mina camp (existing users from earlier versions)
      if (!this.config.minaCamp || typeof this.config.minaCamp !== 'object') {
        this.config.minaCamp = { type: '', zone: '', area: '' };
      }
      // v2.2 — defensive default for hotel arrays (Store.migrate runs on load too,
      // but onboarding clones the config so we re-default if the migration didn't
      // populate them)
      if (!Array.isArray(this.config.madinahHotels)) this.config.madinahHotels = [];
      if (!Array.isArray(this.config.makkahHotels))  this.config.makkahHotels  = [];

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
      // v2.3 — Load airports for the type-ahead combobox in the flights step
      if (!window._AIRPORTS_LIST) {
        Utils.fetchJSON('./data/airports.json')
          .then(data => {
            window._AIRPORTS_LIST = data;
            // Re-render if on flights step so combobox populates
            if (STEPS[this.currentStep] && STEPS[this.currentStep].id === 'flights') {
              this.render();
            }
          })
          .catch(() => { /* fail silently — input still works as plain text */ });
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

      // v2.7 — pilgrim's name. Used on the emergency card and to attribute
      // journal entries. Defensive default for existing users from earlier versions.
      if (typeof this.config.pilgrimName !== 'string') this.config.pilgrimName = '';
      wrap.appendChild(this.buildField(
        'Your name (as on your passport)',
        'text',
        'e.g. Ahmed Khan',
        this.config.pilgrimName,
        v => { this.config.pilgrimName = v; }
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
        'Add your flight numbers and dates so the guide can plan around them. Tick the road box if you\'re crossing by land.'
      ));

      // Defensive defaults for byRoad fields (existing users from earlier versions)
      if (!this.config.outboundFlight) this.config.outboundFlight = {};
      if (!this.config.returnFlight)   this.config.returnFlight   = {};
      if (typeof this.config.outboundFlight.byRoad !== 'boolean') this.config.outboundFlight.byRoad = false;
      if (typeof this.config.returnFlight.byRoad   !== 'boolean') this.config.returnFlight.byRoad   = false;

      // ── Outbound ───────────────────────────────────────────
      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'Outbound'));
      const outBlock = this._buildFlightLegBlock('outbound');
      wrap.appendChild(outBlock);

      wrap.appendChild(el('hr', { class: 'rule' }));

      // ── Return ─────────────────────────────────────────────
      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'Return'));
      const retBlock = this._buildFlightLegBlock('return');
      wrap.appendChild(retBlock);

      // Date-order warning slot
      const warning = el('div', { id: 'flight-date-warning', class: 'flight-warning hidden' });
      wrap.appendChild(warning);

      requestAnimationFrame(() => this._updateFlightDateWarning());
      return wrap;
    },

    /**
     * v2.3 — Build one flight leg ('outbound' or 'return').
     * Renders: byRoad checkbox, flight number + departure airport (hidden when byRoad),
     *          date/time, arrival airport (hidden when byRoad).
     * Re-renders itself in place when the byRoad checkbox toggles.
     */
    _buildFlightLegBlock(leg) {
      const isOutbound = leg === 'outbound';
      const cfgKey = isOutbound ? 'outboundFlight' : 'returnFlight';
      const flight = this.config[cfgKey];
      const byRoad = !!flight.byRoad;

      const block = el('div', { class: 'flight-leg-block' });

      // ── Travel mode toggle row (checkbox) ───────────
      const modeRow = el('label', { class: 'travel-mode' });
      const checkbox = el('input', {
        type: 'checkbox',
        checked: byRoad,
      });
      checkbox.addEventListener('change', () => {
        this.config[cfgKey].byRoad = !!checkbox.checked;
        // Re-render this block in place so the relevant fields show/hide
        const next = this._buildFlightLegBlock(leg);
        block.replaceWith(next);
      });
      modeRow.appendChild(checkbox);
      modeRow.appendChild(el('span', { class: 'travel-mode__label' },
        isOutbound ? 'Entry by road (no flight)' : 'Exit by road (no flight)'
      ));
      block.appendChild(modeRow);

      // ── Flight number + departure airport (hidden when byRoad) ──
      if (!byRoad) {
        const row1 = el('div', { class: 'input-row' });

        if (isOutbound) {
          row1.appendChild(this.buildFlightField('Flight number', 'e.g. SV124',
            flight.number,
            v => { this.config[cfgKey].number = v; },
            'flight-hint-' + leg
          ));
          // Departure airport — combobox (worldwide)
          row1.appendChild(this._buildAirportCombobox(
            'Departure airport', flight.from || '',
            v => { this.config[cfgKey].from = v; },
            'departure'
          ));
        } else {
          row1.appendChild(this.buildFlightField('Flight number', 'e.g. SV123',
            flight.number,
            v => { this.config[cfgKey].number = v; },
            'flight-hint-' + leg
          ));
          // From: Saudi airports only on return leg
          row1.appendChild(this._buildAirportCombobox(
            'From', flight.from || '',
            v => { this.config[cfgKey].from = v; },
            'saudi'
          ));
        }
        block.appendChild(row1);
      }

      // ── Date + time (always shown) ────────────────
      const row2 = el('div', { class: 'input-row' });
      row2.appendChild(this.buildField('Date', 'date', '', flight.date, v => {
        this.config[cfgKey].date = v;
        // v3.11 — Auto-fill arrivalDate to date+1 if user hasn't set it explicitly,
        // since most flights from Europe to KSA are overnight. User can override.
        if (isOutbound && (!this.config[cfgKey].arrivalDate || this.config[cfgKey]._arrivalAutoFilled)) {
          if (v) {
            const d = new Date(v + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            this.config[cfgKey].arrivalDate = d.toISOString().slice(0, 10);
            this.config[cfgKey]._arrivalAutoFilled = true;
            // Re-render the flight section so the new arrivalDate shows in its field
            this.render();
          }
        }
        this._updateFlightDateWarning();
      }));
      row2.appendChild(this.buildField('Time', 'time', '', flight.time, v => {
        this.config[cfgKey].time = v;
      }));
      block.appendChild(row2);

      // ── v3.11 — Arrival date in Saudi Arabia (outbound only, non-byRoad).
      //    The trip's "Day 1" is anchored to this date, not the flight
      //    departure date, since most pilgrims fly overnight and land
      //    the day after departure. Defaults to date+1; user can adjust.
      if (isOutbound && !byRoad) {
        const arrivalRow = el('div', { class: 'input-row' });
        arrivalRow.appendChild(this.buildField(
          'Arrival date in Saudi Arabia',
          'date',
          '',
          flight.arrivalDate || '',
          v => {
            this.config[cfgKey].arrivalDate = v;
            this.config[cfgKey]._arrivalAutoFilled = false;
          }
        ));
        // Hint
        arrivalRow.appendChild(el('div', { class: 'field' },
          el('label', { class: 'field__label' }, ' '),
          el('p', {
            class: 'field__hint',
            style: { fontSize: '12px', color: 'var(--ink-mute)', margin: '4px 0 0', fontStyle: 'italic' },
          }, 'When you actually land in Madinah/Jeddah. Day 1 of your trip starts here.')
        ));
        block.appendChild(arrivalRow);
      }

      // ── Arrival / Home airport (hidden when byRoad) ─
      if (!byRoad) {
        if (isOutbound) {
          // Arrival airport — Saudi only
          block.appendChild(this._buildAirportCombobox(
            'Arrival airport', flight.to || '',
            v => { this.config[cfgKey].to = v; },
            'saudi'
          ));
        } else {
          // Home airport — worldwide
          block.appendChild(this._buildAirportCombobox(
            'Home airport', flight.to || '',
            v => { this.config[cfgKey].to = v; },
            'departure'
          ));
        }
      }

      return block;
    },

    /**
     * v2.3 — Type-ahead airport combobox.
     * `dataset` is 'departure' (worldwide) or 'saudi' (4 airports).
     * Reads from window._AIRPORTS_LIST — loaded asynchronously in init().
     * Stores the IATA code in config; displays "City — Name (IATA)" when typing.
     */
    _buildAirportCombobox(label, currentIata, onSelect, dataset) {
      const wrap = el('div', { class: 'field' });
      wrap.appendChild(el('label', { class: 'field__label' }, label));

      // Look up current display label from the IATA code
      const list = (window._AIRPORTS_LIST && window._AIRPORTS_LIST[dataset]) || [];
      const fmtAirport = (a) => `${a.city} — ${a.name} (${a.iata})`;
      const findByIata = (iata) => list.find(a => a.iata === iata);
      const initialDisplay = currentIata
        ? (findByIata(currentIata) ? fmtAirport(findByIata(currentIata)) : currentIata)
        : '';

      const inputWrap = el('div', { class: 'combobox' });

      const input = el('input', {
        type: 'text',
        class: 'field__input combobox__input',
        placeholder: dataset === 'saudi' ? 'Type city or IATA (e.g. Jeddah, JED)' : 'Type city or IATA (e.g. London, LHR)',
        value: initialDisplay,
        autocomplete: 'off',
        spellcheck: 'false',
      });

      const dropdown = el('div', { class: 'combobox__dropdown' });

      const renderResults = (query) => {
        dropdown.innerHTML = '';
        const q = query.trim().toLowerCase();
        if (!q) { dropdown.classList.remove('is-open'); return; }
        // Match on iata, city, country, name (in that priority)
        const matches = list.filter(a => {
          const blob = `${a.iata} ${a.city} ${a.country || ''} ${a.name}`.toLowerCase();
          return blob.includes(q);
        }).slice(0, 8);
        if (!matches.length) {
          dropdown.classList.add('is-open');
          dropdown.appendChild(el('div', { class: 'combobox__empty' },
            'No match — type the IATA code if your airport isn\'t listed.'
          ));
          return;
        }
        matches.forEach((a, i) => {
          const opt = el('button', { type: 'button', class: 'combobox__opt' });
          opt.appendChild(el('span', { class: 'combobox__opt-iata' }, a.iata));
          opt.appendChild(el('span', { class: 'combobox__opt-meta' },
            ` ${a.city} · ${a.name}`
          ));
          opt.addEventListener('click', () => {
            input.value = fmtAirport(a);
            this._lastValidIata = a.iata;
            onSelect(a.iata);
            dropdown.classList.remove('is-open');
          });
          dropdown.appendChild(opt);
        });
        dropdown.classList.add('is-open');
      };

      input.addEventListener('input', () => {
        renderResults(input.value);
        // Try to extract IATA from a typed string. If user typed exactly 3
        // letters that match a known airport, treat as a direct selection.
        const typedIata = input.value.trim().toUpperCase();
        const direct = list.find(a => a.iata === typedIata);
        if (direct) {
          onSelect(direct.iata);
        } else {
          // Otherwise store the raw input (uppercased) as a fallback. We don't
          // overwrite a previously-selected IATA unless the user typed something
          // clearly different.
          onSelect(typedIata.length === 3 ? typedIata : input.value.trim());
        }
      });

      input.addEventListener('focus', () => {
        // Show dropdown on focus if query already present
        if (input.value.trim()) renderResults(input.value);
      });

      input.addEventListener('blur', () => {
        // Delay close so click on dropdown option still fires
        setTimeout(() => dropdown.classList.remove('is-open'), 180);
      });

      inputWrap.appendChild(input);
      inputWrap.appendChild(dropdown);
      wrap.appendChild(inputWrap);

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
        'If you stay in different hotels (e.g. shifting packages), add each one with its date range.'
      ));

      // Madinah hotels list
      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'In Madinah'));
      wrap.appendChild(this._buildHotelList('madinah'));

      wrap.appendChild(el('hr', { class: 'rule' }));

      // Makkah hotels list
      wrap.appendChild(el('h4', { class: 'eyebrow' }, 'In Makkah'));
      wrap.appendChild(this._buildHotelList('makkah'));

      // v2.4 — Trip-wide coverage warning (any night not covered by any hotel)
      wrap.appendChild(el('div', {
        class: 'hotel-warnings hotel-warnings--coverage',
        'data-trip-coverage': 'true',
      }));
      // Initial check after mount
      requestAnimationFrame(() => this._refreshTripCoverageWarning());

      wrap.appendChild(el('hr', { class: 'rule' }));

      // v2.2 — Mina camp section (item 6)
      wrap.appendChild(this._buildMinaCampSection());

      // Note about Places API
      const apiKey = (window.APP_CONFIG && window.APP_CONFIG.googleMapsApiKey) || '';
      if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        wrap.appendChild(el('div', { class: 'callout' },
          el('p', { style: { margin: 0 }, html: 'Address autocomplete is currently disabled. Type your hotel name manually — it will still appear in the guide. Site owner: configure your Google Maps API key in <code>js/config.js</code> to enable autocomplete.' })
        ));
      }
      return wrap;
    },

    /**
     * v2.2 — Build the multi-hotel list for one city ('madinah' | 'makkah').
     * Reads/writes the corresponding array on this.config (e.g. madinahHotels).
     */
    _buildHotelList(city) {
      const arrayKey = city + 'Hotels'; // 'madinahHotels' or 'makkahHotels'
      const wrap = el('div', { class: 'hotel-list' });

      // Defensive default if user is at this step before init() finished migration
      if (!Array.isArray(this.config[arrayKey])) {
        this.config[arrayKey] = [];
      }
      // If empty, start with one blank entry so the form isn't entirely empty
      if (this.config[arrayKey].length === 0) {
        this.config[arrayKey].push({ name: '', address: '', placeId: '', lat: null, lng: null, fromDate: '', toDate: '' });
      }

      // Render each hotel entry
      this.config[arrayKey].forEach((hotel, idx) => {
        wrap.appendChild(this._buildHotelEntry(city, idx));
      });

      // "+ Add another hotel" button
      const addBtn = el('button', {
        type: 'button',
        class: 'btn btn--ghost hotel-list__add',
      }, '+ Add another hotel');
      addBtn.addEventListener('click', () => {
        this.config[arrayKey].push({ name: '', address: '', placeId: '', lat: null, lng: null, fromDate: '', toDate: '' });
        // Re-render this hotel list section in place
        const next = this._buildHotelList(city);
        wrap.replaceWith(next);
      });
      wrap.appendChild(addBtn);

      // v2.4 — Validation warnings panel. Updated as the user types (no full re-render).
      const warningsPanel = el('div', {
        class: 'hotel-warnings',
        'data-hotel-warnings': city,
      });
      wrap.appendChild(warningsPanel);
      // Run an initial validation pass after this list is mounted in the DOM
      requestAnimationFrame(() => this._refreshHotelWarnings(city));

      return wrap;
    },

    /**
     * v2.4 — Re-run validation for one city's hotels and re-render the warnings panel.
     * Called from hotel-entry onChange handlers without re-rendering the whole list.
     *
     * Per-city checks: order/overlap/gap, plus dates outside flight window.
     * Combined coverage (does ANY hotel cover every trip night?) is handled
     * separately by _refreshTripCoverageWarning() so it doesn't appear twice.
     */
    _refreshHotelWarnings(city) {
      const arrayKey = city + 'Hotels';
      const hotels = this.config[arrayKey] || [];
      const panel = document.querySelector(`[data-hotel-warnings="${city}"]`);
      if (!panel) return;

      const opts = {
        outboundDate: this.config.outboundFlight && this.config.outboundFlight.date,
        returnDate:   this.config.returnFlight   && this.config.returnFlight.date,
        // No cityWindow — coverage is a combined check, see _refreshTripCoverageWarning
      };

      const warnings = Utils.validateHotelDateRanges(hotels, opts);
      panel.innerHTML = '';
      if (warnings.length) {
        warnings.forEach(w => {
          const cls = 'hotel-warnings__item hotel-warnings__item--' + (w.level === 'warn' ? 'warn' : 'info');
          const item = el('div', { class: cls });
          item.appendChild(el('span', { class: 'hotel-warnings__icon', 'aria-hidden': 'true' },
            w.level === 'warn' ? '⚠' : 'ℹ'
          ));
          item.appendChild(el('span', { class: 'hotel-warnings__text' }, w.message));
          panel.appendChild(item);
        });
      }

      // Always also refresh the trip-wide coverage warning when any city's
      // dates change, since adding a Madinah night may close a coverage gap.
      this._refreshTripCoverageWarning();
    },

    /**
     * v2.4 — Combined coverage warning: do ALL the user's hotels (Madinah + Makkah
     * together) cover every night between outbound and return flights?
     * Renders into [data-trip-coverage] panel which is added beneath both city sections.
     */
    _refreshTripCoverageWarning() {
      const panel = document.querySelector('[data-trip-coverage]');
      if (!panel) return;

      const out = this.config.outboundFlight && this.config.outboundFlight.date;
      const ret = this.config.returnFlight   && this.config.returnFlight.date;
      panel.innerHTML = '';
      if (!out || !ret) return;

      const allHotels = [
        ...(this.config.madinahHotels || []),
        ...(this.config.makkahHotels  || []),
      ];
      const dated = allHotels.filter(h => h && h.name && h.fromDate && h.toDate);
      if (!dated.length) return;

      // Walk every night between outbound and return; flag those not covered
      // by any hotel. "Night X" means the night starting on day X.
      const covered = new Set();
      dated.forEach(h => {
        let d = new Date(h.fromDate);
        const stop = new Date(h.toDate);
        for (let i = 0; i < 60 && d < stop; i++) {
          covered.add(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() + 1);
        }
      });
      const missing = [];
      let cursor = new Date(out);
      const winStop = new Date(ret);
      for (let i = 0; i < 60 && cursor < winStop; i++) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!covered.has(iso)) missing.push(iso);
        cursor.setDate(cursor.getDate() + 1);
      }
      if (!missing.length) return;

      const previewDates = missing.slice(0, 3).join(', ');
      const more = missing.length > 3 ? ` (+${missing.length - 3} more)` : '';
      const item = el('div', { class: 'hotel-warnings__item hotel-warnings__item--info' });
      item.appendChild(el('span', { class: 'hotel-warnings__icon', 'aria-hidden': 'true' }, 'ℹ'));
      item.appendChild(el('span', { class: 'hotel-warnings__text' },
        `${missing.length} night${missing.length === 1 ? '' : 's'} between your flights have no hotel: ${previewDates}${more}. Are you in Mina/Aziziyah those nights?`
      ));
      panel.appendChild(item);
    },

    /**
     * v2.2 — Build a single hotel entry (one row in the multi-hotel list).
     */
    _buildHotelEntry(city, idx) {
      const arrayKey = city + 'Hotels';
      const hotel = this.config[arrayKey][idx];
      const isFirst = idx === 0;
      const isOnly  = this.config[arrayKey].length === 1;

      const entry = el('div', { class: 'hotel-entry' });

      // Header row: "Hotel 1" + remove button (hidden if only one)
      const head = el('div', { class: 'hotel-entry__head' });
      head.appendChild(el('span', { class: 'hotel-entry__num' }, `Hotel ${idx + 1}`));
      if (!isOnly) {
        const remove = el('button', {
          type: 'button',
          class: 'hotel-entry__remove',
          'aria-label': 'Remove this hotel',
        }, '× Remove');
        remove.addEventListener('click', () => {
          this.config[arrayKey].splice(idx, 1);
          const next = this._buildHotelList(city);
          // The parent .hotel-list is the entry's parent
          entry.parentElement.replaceWith(next);
        });
        head.appendChild(remove);
      }
      entry.appendChild(head);

      // Places autocomplete field — uses the existing buildPlacesField helper.
      // The third argument is the current hotel object; on selection, the helper
      // calls our callback with the place data, which we copy into the entry
      // (preserving existing dates).
      const placesField = this.buildPlacesField(
        'Hotel or building name',
        'Start typing to search',
        hotel,
        city + '-' + idx,  // unique key for the autocomplete element
        (place) => {
          // Merge place data into the existing entry to preserve date fields
          const existing = this.config[arrayKey][idx] || {};
          this.config[arrayKey][idx] = {
            ...existing,
            name: place.name || '',
            address: place.address || '',
            placeId: place.placeId || '',
            lat: place.lat,
            lng: place.lng,
          };
        }
      );
      entry.appendChild(placesField);

      // Date range row
      const dateRow = el('div', { class: 'input-row' });
      dateRow.appendChild(this.buildField(
        'From date', 'date', '', hotel.fromDate || '',
        v => {
          this.config[arrayKey][idx].fromDate = v;
          this._refreshHotelWarnings(city);
        }
      ));
      dateRow.appendChild(this.buildField(
        'To date', 'date', '', hotel.toDate || '',
        v => {
          this.config[arrayKey][idx].toDate = v;
          this._refreshHotelWarnings(city);
        }
      ));
      entry.appendChild(dateRow);

      return entry;
    },

    /**
     * v2.2 — Mina camp section. Pilgrims either stay inside the Mina valley
     * (where the type/zone matters for distance to Jamarat) or in Aziziyah
     * (a residential district adjacent to Mina, used in "shifting" packages).
     */
    _buildMinaCampSection() {
      const cfg = this.config.minaCamp;
      const section = el('div');
      section.appendChild(el('h4', { class: 'eyebrow' }, 'During the days of Hajj'));
      section.appendChild(el('p', { class: 'onboarding__step-desc', style: { marginTop: '4px', marginBottom: '12px' } },
        'Where will you sleep on the nights of 8th, 11th, 12th of Dhul Hijjah? Skip if not sure — your operator will confirm.'
      ));

      // Type: radio-style cards
      const typeWrap = el('div', { class: 'mina-camp-types' });
      const types = [
        { id: 'mina',      label: 'Inside Mina valley',     desc: 'Tent in Mina (any zone)' },
        { id: 'aziziyah',  label: 'In Aziziyah',            desc: 'Residential district adjacent to Mina ("shifting" package)' },
        { id: 'unsure',    label: "I'm not sure yet",       desc: 'Confirm with your operator before travelling' },
      ];
      types.forEach(t => {
        const card = el('label', {
          class: 'mina-camp-type' + (cfg.type === t.id ? ' is-selected' : ''),
        });
        const radio = el('input', {
          type: 'radio',
          name: 'mina-camp-type',
          value: t.id,
        });
        if (cfg.type === t.id) radio.checked = true;
        radio.addEventListener('change', () => {
          this.config.minaCamp.type = t.id;
          // Re-render this section so zone field shows/hides properly
          const next = this._buildMinaCampSection();
          section.replaceWith(next);
        });
        card.appendChild(radio);
        const text = el('span', { class: 'mina-camp-type__text' });
        text.appendChild(el('strong', null, t.label));
        text.appendChild(el('span', { class: 'mina-camp-type__desc' }, t.desc));
        card.appendChild(text);
        typeWrap.appendChild(card);
      });
      section.appendChild(typeWrap);

      // Zone (only when type === 'mina')
      if (cfg.type === 'mina') {
        const zoneRow = el('div', { class: 'field', style: { marginTop: '12px' } });
        zoneRow.appendChild(el('label', { class: 'field__label' }, 'Mina zone (if known)'));
        zoneRow.appendChild(el('div', { class: 'field__hint' },
          'Zone A is closest to Jamarat (~300–700m); Zone D is furthest (~3–4km). Premium packages tend to be A; standard B/C; economy D and beyond.'
        ));
        const select = el('select', { class: 'field__input' });
        ['', 'A', 'B', 'C', 'D', 'unknown'].forEach(z => {
          const label = z === '' ? '— select if known —'
                      : z === 'unknown' ? "Don't know"
                      : `Zone ${z}`;
          const opt = el('option', { value: z }, label);
          if (cfg.zone === z) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', () => {
          this.config.minaCamp.zone = select.value;
        });
        zoneRow.appendChild(select);
        section.appendChild(zoneRow);
      }

      // Area / camp number free text (always shown if type is mina or aziziyah)
      if (cfg.type === 'mina' || cfg.type === 'aziziyah') {
        const placeholder = cfg.type === 'mina'
          ? 'e.g. Muaisim, Al-Kabsh, Camp 12B'
          : 'e.g. building name, Aziziyah block';
        const fieldWrap = el('div', { class: 'field', style: { marginTop: '12px' } });
        fieldWrap.appendChild(el('label', { class: 'field__label' },
          cfg.type === 'mina' ? 'Sub-area or camp number (optional)' : 'Aziziyah location (optional)'
        ));
        const input = el('input', {
          type: 'text', class: 'field__input', placeholder,
          value: cfg.area || '',
        });
        input.addEventListener('input', () => { this.config.minaCamp.area = input.value; });
        fieldWrap.appendChild(input);
        section.appendChild(fieldWrap);
      }

      return section;
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
        // Manual fallback — store name even without place_id, via the callback.
        // The callback receives a partial place object; the caller decides how to merge it.
        const v = e.target.value;
        if (typeof onSelect === 'function') {
          onSelect({ name: v, address: '', placeId: '', lat: null, lng: null });
        }
      });

      wrap.appendChild(input);

      // Hook into Maps Autocomplete if available
      if (window.Maps && Maps.attachAutocomplete) {
        Maps.attachAutocomplete(input, key, (place) => {
          if (typeof onSelect === 'function') {
            onSelect(place);
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
