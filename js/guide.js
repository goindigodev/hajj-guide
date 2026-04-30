/* =============================================================
   GUIDE — Renders all tab content from data files + user config.
   Single source of truth for the personalised guide.
   ============================================================= */

(function (global) {
  'use strict';

  const { el, $, $$, escapeHtml, formatDate, addDays, daysBetween, slugify } = Utils;

  // ─── Tab definitions ──────────────────────────────────────
  const TABS = [
    { id: 'today',       title: 'Today',        icon: '◐' },
    { id: 'overview',    title: 'Overview',     icon: '☉' },
    { id: 'itinerary',   title: 'Itinerary',    icon: '✦' },
    { id: 'hajj-days',   title: '5 Days of Hajj', icon: '۞' },
    { id: 'umrah',       title: 'Umrah',        icon: '◯' },
    { id: 'duas',        title: 'Duas',         icon: '﷽' },
    { id: 'rulings',     title: 'Rulings',      icon: '⚖' },
    { id: 'locations',   title: 'Locations',    icon: '◇' },
    { id: 'packing',     title: 'Packing',      icon: '✓' },
    { id: 'preparation', title: 'Preparation',  icon: '◷' },
    { id: 'wisdom',      title: 'Wisdom & Tips',icon: '✶' },
    { id: 'journal',     title: 'Journal',       icon: '✎' },
    { id: 'settings',    title: 'Settings',     icon: '⚙' },
  ];

  const Guide = {
    data: { duas: null, rulings: null, itinerary: null },
    config: null,
    currentTab: 'overview',

    async init(host) {
      this.host = host;
      this.config = Store.getConfig();

      // Load data files
      try {
        const [duas, rulings, itinerary] = await Promise.all([
          Utils.fetchJSON('./data/duas.json'),
          Utils.fetchJSON('./data/rulings.json'),
          Utils.fetchJSON('./data/itinerary-template.json'),
        ]);
        this.data.duas = duas.duas;
        this.data.rulings = rulings.rulings;
        this.data.itinerary = itinerary;
      } catch (e) {
        console.error('Failed to load data files', e);
        this.host.innerHTML = '<p class="text-mute italic">Failed to load guide data. Please refresh.</p>';
        return;
      }

      // v2.4 — If the user is currently on their trip, default to the Today tab.
      // Otherwise, the Today tab still exists but Overview is a friendlier landing.
      if (this._isOnTrip()) {
        this.currentTab = 'today';
      }

      this.render();
    },

    /**
     * v2.4 — Are we currently mid-trip? Returns true iff today's date falls
     * within [outboundDate, returnDate] inclusive. False if dates are missing.
     */
    _isOnTrip() {
      const out = this.config && this.config.outboundFlight && this.config.outboundFlight.date;
      const ret = this.config && this.config.returnFlight   && this.config.returnFlight.date;
      if (!out || !ret) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(out);
      const end   = new Date(ret);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    },

    render() {
      this.host.innerHTML = '';
      TABS.forEach(tab => {
        const panel = el('div', {
          class: 'tab-content' + (tab.id === this.currentTab ? ' is-active' : ''),
          id: `tab-${tab.id}`,
          role: 'tabpanel',
        });
        const content = this.renderTab(tab.id);
        if (content) panel.appendChild(content);
        this.host.appendChild(panel);
      });
    },

    renderTab(id) {
      switch (id) {
        case 'today':       return this.tabToday();
        case 'overview':    return this.tabOverview();
        case 'itinerary':   return this.tabItinerary();
        case 'hajj-days':   return this.tabHajjDays();
        case 'umrah':       return this.tabUmrah();
        case 'duas':        return this.tabDuas();
        case 'rulings':     return this.tabRulings();
        case 'locations':   return this.tabLocations();
        case 'packing':     return this.tabPacking();
        case 'preparation': return this.tabPreparation();
        case 'wisdom':      return this.tabWisdom();
        case 'journal':     return this.tabJournal();
        case 'settings':    return this.tabSettings();
      }
      return el('div');
    },

    switchTab(id) {
      this.currentTab = id;
      $$('.tab-content').forEach(t => t.classList.toggle('is-active', t.id === `tab-${id}`));
      $$('.tab-nav__btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === id));

      // v3.0 — scroll the active tab into view inside the tab strip.
      // If the user clicked a half-visible tab, this brings it fully into frame.
      const activeBtn = document.querySelector(`.tab-nav__btn[data-tab="${id}"]`);
      const scroller  = document.querySelector('.tab-nav__inner');
      if (activeBtn && scroller) {
        const btnRect = activeBtn.getBoundingClientRect();
        const navRect = scroller.getBoundingClientRect();
        const margin  = 40; // keep the chevron clear of the active pill
        if (btnRect.left < navRect.left + margin) {
          scroller.scrollBy({ left: btnRect.left - navRect.left - margin, behavior: 'smooth' });
        } else if (btnRect.right > navRect.right - margin) {
          scroller.scrollBy({ left: btnRect.right - navRect.right + margin, behavior: 'smooth' });
        }
      }

      // v2.7 — re-render the Journal tab on activation so newly-typed entries
      // from the Itinerary tab appear immediately. The Journal renders from
      // Store, so we need a fresh build each time it's shown.
      if (id === 'journal') {
        const panel = document.getElementById('tab-journal');
        if (panel) {
          panel.innerHTML = '';
          panel.appendChild(this.tabJournal());
        }
      }

      // Update notes section context
      if (window.Notes && Notes.setSection) {
        const tabDef = TABS.find(t => t.id === id);
        Notes.setSection(id, tabDef ? tabDef.title : id);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /* ─── TABS ────────────────────────────────────────────── */

    /**
     * v2.4 — TODAY tab. The "what's happening right now" focused view.
     * Three states:
     *   - pre-trip: friendly countdown to outbound flight
     *   - on-trip: today's day card + yesterday recap + tomorrow preview + duas + group contacts
     *   - post-trip: brief Hajj-concluded message with link to Overview for the emergency card
     *   - no flight data: prompt to complete onboarding
     */
    tabToday() {
      const cfg = this.config || {};
      const out = cfg.outboundFlight && cfg.outboundFlight.date;
      const ret = cfg.returnFlight   && cfg.returnFlight.date;

      if (!out) {
        return this._tabTodayNoFlights();
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(out);
      startDate.setHours(0, 0, 0, 0);
      const endDate = ret ? new Date(ret) : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);

      if (today < startDate) {
        return this._tabTodayCountdown(startDate);
      }
      if (endDate && today > endDate) {
        return this._tabTodayConcluded(startDate, endDate);
      }
      return this._tabTodayOnTrip(today);
    },

    _tabTodayNoFlights() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Today'));
      wrap.appendChild(el('div', { class: 'callout callout--info' },
        el('p', { style: { margin: 0 } },
          'Add your flight dates to see your daily plan. ',
          el('a', { href: './index.html' }, 'Open setup'),
          '.'
        )
      ));
      return wrap;
    },

    _tabTodayCountdown(startDate) {
      const wrap = el('div', { class: 'today-tab today-tab--countdown' });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = Math.round((startDate - today) / 86400000);

      // Hijri date for today (large, prominent)
      const todayHijri = Utils.formatHijri(today) || '';
      const startHijri = Utils.formatHijri(startDate) || '';

      wrap.appendChild(el('div', { class: 'today-hero' },
        el('div', { class: 'today-hero__greg' }, Utils.formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
        todayHijri ? el('div', { class: 'today-hero__hijri' }, todayHijri) : null
      ));

      // Big countdown
      const count = el('div', { class: 'today-countdown' });
      count.appendChild(el('div', { class: 'today-countdown__num' }, String(days)));
      count.appendChild(el('div', { class: 'today-countdown__label' },
        days === 0 ? 'Your Hajj begins today.' :
        days === 1 ? 'day until your Hajj begins' :
        'days until your Hajj begins'
      ));
      wrap.appendChild(count);

      const sub = el('p', { class: 'today-countdown__sub' });
      sub.appendChild(document.createTextNode('Outbound: '));
      sub.appendChild(el('strong', null, Utils.formatDate(startDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })));
      if (startHijri) {
        sub.appendChild(document.createTextNode(' · '));
        sub.appendChild(el('em', null, startHijri));
      }
      wrap.appendChild(sub);

      // Suggestion to use the Preparation/Packing tabs while waiting
      wrap.appendChild(el('div', { class: 'callout', style: { marginTop: 'var(--space-6)' } },
        el('p', { style: { margin: 0 } },
          'While you wait: review the ',
          el('a', { href: '#', 'data-jump-tab': 'preparation' }, 'Preparation'),
          ', ',
          el('a', { href: '#', 'data-jump-tab': 'packing' }, 'Packing'),
          ', and ',
          el('a', { href: '#', 'data-jump-tab': 'duas' }, 'Duas'),
          ' tabs.'
        )
      ));

      // Wire tab-jump links
      requestAnimationFrame(() => this._wireTabJumpLinks(wrap));
      return wrap;
    },

    _tabTodayConcluded(startDate, endDate) {
      const wrap = el('div', { class: 'today-tab today-tab--concluded' });
      wrap.appendChild(el('div', { class: 'today-hero' },
        el('div', { class: 'today-hero__greg' }, Utils.formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
        el('div', { class: 'today-hero__hijri' }, Utils.formatHijri(new Date()) || '')
      ));

      wrap.appendChild(el('h2', { class: 'today-concluded__heading' }, 'Your Hajj has concluded.'));
      wrap.appendChild(el('p', { class: 'today-concluded__lead' },
        'May Allah accept your pilgrimage and grant you Hajj Mabroor.'
      ));
      wrap.appendChild(el('p', { class: 'today-concluded__sub' },
        `Your trip ran from ${Utils.formatDate(startDate, { day: 'numeric', month: 'short', year: 'numeric' })} to ${Utils.formatDate(endDate, { day: 'numeric', month: 'short', year: 'numeric' })}.`
      ));

      wrap.appendChild(el('div', { class: 'callout callout--info', style: { marginTop: 'var(--space-6)' } },
        el('p', { style: { margin: 0 } },
          'The full guide is still available — visit the ',
          el('a', { href: '#', 'data-jump-tab': 'itinerary' }, 'Itinerary'),
          ' tab for your day-by-day record, or the ',
          el('a', { href: '#', 'data-jump-tab': 'wisdom' }, 'Wisdom & Tips'),
          ' tab for post-Hajj reflections.'
        )
      ));
      requestAnimationFrame(() => this._wireTabJumpLinks(wrap));
      return wrap;
    },

    _tabTodayOnTrip(today) {
      const wrap = el('div', { class: 'today-tab today-tab--on-trip' });

      // Big Hijri + Gregorian header
      const todayHijri = Utils.formatHijri(today) || '';
      const heroGreg = Utils.formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      wrap.appendChild(el('div', { class: 'today-hero' },
        el('div', { class: 'today-hero__greg' }, heroGreg),
        todayHijri ? el('div', { class: 'today-hero__hijri' }, todayHijri) : null
      ));

      // Build the full itinerary day list and find today / yesterday / tomorrow
      const allDays = this.buildItineraryDays();
      const todayIso = today.toISOString().slice(0, 10);
      const findDay = (iso) => allDays.find(d => d.date && d.date.toISOString().slice(0, 10) === iso) || null;

      const yesterdayIso = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
      const tomorrowIso  = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

      const dayToday     = findDay(todayIso);
      const dayYesterday = findDay(yesterdayIso);
      const dayTomorrow  = findDay(tomorrowIso);

      // ── Today's plan (expanded) ────────────────────────────
      if (dayToday) {
        const todaySection = el('div', { class: 'today-section today-section--main' });
        todaySection.appendChild(el('h2', { class: 'today-section__heading' }, 'Today'));

        const card = this.renderDayCard(dayToday, 0);
        // Expand it by default — that's the whole point of this view
        const head = card.querySelector('.day-card__header');
        const body = card.querySelector('.day-card__body');
        if (head && body) {
          card.classList.add('is-open');
          head.setAttribute('aria-expanded', 'true');
        }
        todaySection.appendChild(card);
        wrap.appendChild(todaySection);

        // Today's duas (separate section so they're glanceable)
        if (dayToday.duaIds && dayToday.duaIds.length && this.data.duas) {
          const duaSection = el('div', { class: 'today-section' });
          duaSection.appendChild(el('h2', { class: 'today-section__heading' }, 'Duas for today'));
          dayToday.duaIds.forEach(id => {
            const dua = this.data.duas.find(d => d.id === id);
            if (dua) duaSection.appendChild(this.renderDuaCard(dua));
          });
          wrap.appendChild(duaSection);
        }
      } else {
        // Edge case: today's date is in the trip window but no day card matches
        // (shouldn't happen but possible if itinerary build skips a day)
        wrap.appendChild(el('div', { class: 'callout' },
          el('p', { style: { margin: 0 } },
            'No specific plan recorded for today — see the ',
            el('a', { href: '#', 'data-jump-tab': 'itinerary' }, 'Itinerary'),
            ' tab for the full schedule.'
          )
        ));
      }

      // ── Yesterday recap ─────────────────────────────────────
      if (dayYesterday) {
        const ySection = el('div', { class: 'today-section today-section--past' });
        ySection.appendChild(el('h2', { class: 'today-section__heading' }, 'Yesterday'));
        ySection.appendChild(this.renderDayCard(dayYesterday, 0));
        wrap.appendChild(ySection);
      }

      // ── Tomorrow preview ────────────────────────────────────
      if (dayTomorrow) {
        const tSection = el('div', { class: 'today-section today-section--future' });
        tSection.appendChild(el('h2', { class: 'today-section__heading' }, 'Tomorrow'));
        tSection.appendChild(this.renderDayCard(dayTomorrow, 0));
        wrap.appendChild(tSection);
      }

      // ── Quick group contacts strip ─────────────────────────
      const contacts = this._buildQuickContacts();
      if (contacts) wrap.appendChild(contacts);

      // Wire collapsible day-cards is already attached inside renderDayCard().
      // We just need to wire the tab-jump links here.
      requestAnimationFrame(() => {
        this._wireTabJumpLinks(wrap);
      });

      return wrap;
    },

    /**
     * v2.4 — Compact contacts strip for the Today tab. Pulls operator + group leader
     * + extra contacts. Each phone is a tap-to-call link.
     */
    _buildQuickContacts() {
      const cfg = this.config || {};
      const op = cfg.operator || {};
      const all = [];
      if (op.contactName || op.contactPhone) all.push({ name: op.contactName || 'Group leader', phone: op.contactPhone, role: 'Group leader' });
      if (op.emergencyPhone) all.push({ name: '24-hr emergency line', phone: op.emergencyPhone, role: 'Emergency' });
      (cfg.groupContacts || []).forEach((c, i) => {
        if (c.name || c.phone) all.push({ name: c.name || `Contact ${i + 1}`, phone: c.phone, role: '' });
      });
      if (!all.length) return null;

      const section = el('div', { class: 'today-section today-contacts' });
      section.appendChild(el('h2', { class: 'today-section__heading' }, 'Quick contacts'));
      const list = el('div', { class: 'today-contacts__list' });
      all.forEach(c => {
        const row = el('a', {
          class: 'today-contact',
          href: c.phone ? `tel:${String(c.phone).replace(/\s/g, '')}` : '#',
        });
        const text = el('div', { class: 'today-contact__text' });
        text.appendChild(el('span', { class: 'today-contact__name' }, c.name));
        if (c.role) text.appendChild(el('span', { class: 'today-contact__role' }, c.role));
        row.appendChild(text);
        if (c.phone) row.appendChild(el('span', { class: 'today-contact__phone' }, c.phone));
        list.appendChild(row);
      });
      section.appendChild(list);
      return section;
    },

    /** Helper: wire any anchor with [data-jump-tab="..."] to switch tabs. */
    _wireTabJumpLinks(root) {
      root.querySelectorAll('[data-jump-tab]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const tabId = a.getAttribute('data-jump-tab');
          if (tabId) this.switchTab(tabId);
        });
      });
    },

    tabOverview() {
      const wrap = el('div');

      // Personalisation strip
      wrap.appendChild(this.renderSetupChip());

      // Page header
      const header = el('div', { class: 'section-header' });
      const title = el('h1', { class: 'display-1', style: { fontSize: 'var(--fs-3xl)', margin: 0 } }, 'Bismillah.');
      header.appendChild(title);
      wrap.appendChild(header);

      wrap.appendChild(el('p', { class: 'lead', style: { maxWidth: '60ch' } },
        'Your guide to a Hajj that is structured, intentional and rooted in your madhab. Use the tabs to navigate. Tap the notes icon at any time to record reflections. Tap the print icon to print the current section.'
      ));

      // Countdown
      const out = this.config.outboundFlight;
      if (out && out.date) {
        wrap.appendChild(this.renderCountdown(out.date));
      }

      wrap.appendChild(el('div', { class: 'ornament' },
        el('span', { class: 'ornament__symbol' }, '۞')
      ));

      // Pillars + Wajib of Hajj — madhab-specific
      wrap.appendChild(el('h2', null, 'The Essentials of Hajj'));
      const madhab = this.config.madhab || 'hanafi';
      wrap.appendChild(el('p', { class: 'text-mute' },
        'Per the ', this.renderMadhabBadge(madhab), ' school. Other schools differ — see ',
        el('a', { href: '#', onclick: e => { e.preventDefault(); this.switchTab('rulings'); } }, 'Rulings'),
        ' for full comparison.'
      ));

      const essentials = this.essentialsByMadhab(madhab);
      const grid = el('div', { class: 'grid grid-2', style: { marginTop: 'var(--space-5)' } });
      essentials.forEach(group => {
        const card = el('div', { class: 'card' });
        card.appendChild(el('h3', { style: { marginTop: 0 } }, group.title));
        card.appendChild(el('p', { class: 'text-mute', style: { fontSize: 'var(--fs-sm)' } }, group.subtitle));
        const list = el('ol', { style: { paddingLeft: '20px', lineHeight: '1.7' } });
        group.items.forEach(item => list.appendChild(el('li', null, item)));
        card.appendChild(list);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);

      // Type of Hajj based on flights
      wrap.appendChild(el('h2', { style: { marginTop: 'var(--space-7)' } }, 'Your Type of Hajj'));
      wrap.appendChild(el('div', { class: 'card' },
        el('h3', { style: { marginTop: 0 } }, 'Hajj at-Tamattu\''),
        el('p', null, 'Most pilgrims travelling from outside Saudi Arabia perform Tamattu\': you enter Ihram for Umrah on arrival, complete the Umrah, exit Ihram, then re-enter Ihram on the 8th of Dhul Hijjah for Hajj. A sacrifice (hady) becomes obligatory.'),
        el('p', { class: 'text-mute', style: { fontSize: 'var(--fs-sm)', marginBottom: 0 } },
          'The other types — Ifrad (Hajj only) and Qiran (Umrah and Hajj together in one Ihram) — are options for those who can carry it through.'
        )
      ));

      // Emergency card
      if (this.config.operator && (this.config.operator.name || this.config.operator.contactPhone)) {
        wrap.appendChild(el('h2', { style: { marginTop: 'var(--space-7)' } }, 'Emergency Card'));
        wrap.appendChild(el('p', { class: 'text-mute', style: { fontSize: 'var(--fs-sm)' } },
          'A printable card with your operator details, hotels, and Saudi emergency numbers. ',
          'Includes a QR code for the 24-hr line. Keep a copy in each bag.'
        ));
        // v2.7 — dedicated print button (uses the new single-page printable layout)
        const printBtn = el('button', {
          class: 'btn btn--primary',
          style: { marginBottom: 'var(--space-4)' },
        }, '🖨 Print emergency card');
        printBtn.addEventListener('click', () => {
          if (window.Print && Print.printEmergencyCard) Print.printEmergencyCard();
          else window.print();
        });
        wrap.appendChild(printBtn);
        // The on-screen card stays as a quick reference (without the QR code)
        wrap.appendChild(this.renderEmergencyCard());
      }

      return wrap;
    },

    tabItinerary() {
      const wrap = el('div');

      // v2.9 — Header row: title on the left, "Print full itinerary" button on the right.
      // Clean responsive flex layout — wraps on narrow screens.
      const headerRow = el('div', {
        class: 'tab-header-row',
        style: {
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        },
      });
      headerRow.appendChild(el('h1', { style: { margin: 0 } }, 'Your Itinerary'));
      const printBtn = el('button', {
        class: 'btn btn--ghost no-print',
        style: { fontSize: '13px' },
        type: 'button',
        title: 'Print a single document covering every day, with your custom stops',
      }, '🖨 Print full itinerary');
      printBtn.addEventListener('click', () => {
        if (window.Print && Print.printFullItinerary) Print.printFullItinerary();
      });
      headerRow.appendChild(printBtn);
      wrap.appendChild(headerRow);

      wrap.appendChild(el('p', { class: 'lead' },
        'A day-by-day plan personalised to your flight dates. Each card opens to show the day\'s rituals, prayers, and duas.'
      ));

      const out = this.config.outboundFlight;
      const ret = this.config.returnFlight;

      if (!out || !out.date) {
        wrap.appendChild(el('div', { class: 'callout callout--warn' },
          el('p', { style: { margin: 0 } },
            'Your outbound flight date isn\'t set. ',
            el('a', { href: './index.html' }, 'Add it now'),
            ' to see your personalised itinerary.'
          )
        ));
        // Still show generic structure
      } else if (ret && ret.date && Utils.containsHajjPeriod) {
        // v2.2 — sanity-check the user's date range covers the 8-13 Dhul Hijjah window.
        // If not, the day labels may be misleading. Warn them clearly but don't block.
        const containsHajj = Utils.containsHajjPeriod(out.date, ret.date);
        if (containsHajj === false) {
          wrap.appendChild(el('div', { class: 'callout callout--warn' },
            el('p', { style: { margin: 0 } },
              el('strong', null, 'Heads up: '),
              'Your flight dates don\'t appear to include the Hajj days (8–13 Dhul Hijjah). ',
              'The day-by-day itinerary below assumes you\'re going for Hajj — if you\'re going for Umrah only or your dates are different, treat the Hajj-day labels as illustrative.'
            )
          ));
        }
      }

      // v3.3 — Prominent prompt when hotel dates are missing.
      // The day-by-day Madinah/Makkah labelling is driven by hotel check-in/out
      // dates. Without those, we show a generic reference itinerary — but tell
      // the user clearly so they can personalise it.
      const madinahDated = this.getHotels('madinah').some(h => h && h.fromDate && h.toDate);
      const makkahDated  = this.getHotels('makkah').some(h => h && h.fromDate && h.toDate);
      if (!madinahDated && !makkahDated) {
        const banner = el('div', { class: 'itinerary-cta callout callout--info' });
        const inner = el('div', { class: 'itinerary-cta__inner' });

        const txt = el('div', { class: 'itinerary-cta__text' });
        txt.appendChild(el('strong', { class: 'itinerary-cta__title' },
          'Make this itinerary yours'));
        txt.appendChild(el('p', { class: 'itinerary-cta__body' },
          'The plan below is a generic Hajj reference. Add your accommodation check-in and check-out dates and the Madinah/Makkah days will reshape around your actual stay. Hajj days (8–12 Dhul Hijjah) stay fixed regardless.'
        ));
        inner.appendChild(txt);

        const btn = el('button', {
          type: 'button',
          class: 'btn btn--primary itinerary-cta__btn',
        }, 'Add accommodation dates →');
        btn.addEventListener('click', () => this.switchTab('settings'));
        inner.appendChild(btn);

        banner.appendChild(inner);
        wrap.appendChild(banner);
      } else if (madinahDated && !makkahDated) {
        // Madinah but no Makkah — softer nudge
        wrap.appendChild(el('div', { class: 'callout callout--info' },
          el('p', { style: { margin: 0 } },
            el('strong', null, 'Almost there: '),
            'You\'ve added Madinah dates but not Makkah. ',
            (() => {
              const a = el('a', { href: '#' }, 'Add Makkah dates');
              a.addEventListener('click', (e) => { e.preventDefault(); this.switchTab('settings'); });
              return a;
            })(),
            ' to complete your personalised itinerary.'
          )
        ));
      } else if (!madinahDated && makkahDated) {
        // Makkah but no Madinah — softer nudge
        wrap.appendChild(el('div', { class: 'callout callout--info' },
          el('p', { style: { margin: 0 } },
            el('strong', null, 'Almost there: '),
            'You\'ve added Makkah dates but not Madinah. ',
            (() => {
              const a = el('a', { href: '#' }, 'Add Madinah dates');
              a.addEventListener('click', (e) => { e.preventDefault(); this.switchTab('settings'); });
              return a;
            })(),
            ' to complete your personalised itinerary.'
          )
        ));
      }

      // v2: Journey map hero (Option 1) — geographic infographic of the entire trip
      wrap.appendChild(this.renderJourneyMapHero());

      // v2: Sticky strip (Option 2) — quick navigation between locations
      wrap.appendChild(this.renderJourneyStrip());

      // Build the day list. We attach data-day-index for scroll-spy.
      const days = this.buildItineraryDays();
      days.forEach((day, i) => {
        const card = this.renderDayCard(day, i);
        card.setAttribute('data-day-index', String(i));
        // Tag with the location so the strip can correlate
        const stop = this.classifyDayLocation(day);
        if (stop) card.setAttribute('data-stop', stop);
        wrap.appendChild(card);
      });

      // Wire strip <-> day card scroll-spy AFTER paint
      requestAnimationFrame(() => this.wireJourneyStripObserver(wrap));

      return wrap;
    },

    /**
     * v2: Hero journey map (Option 1) — stylised geographic infographic
     * showing the entire trip on one image. Static SVG, personalised with
     * the user's hotel names where useful. Approximate geography by design —
     * the scientific value of accuracy is low next to the narrative value
     * of clarity.
     */
    renderJourneyMapHero() {
      const cfg = this.config || {};
      const madinahHotelName = this.firstHotelName('madinah', 'Masjid an-Nabawi');
      const makkahHotelName  = this.firstHotelName('makkah',  'Masjid al-Haram');

      // v2.2 — Determine if we should show the Aziziyah marker and which one is highlighted
      const minaType = (cfg.minaCamp && cfg.minaCamp.type) || '';
      const showAziziyah = minaType === 'aziziyah';   // only show when relevant
      const minaActive = minaType === 'mina' || minaType === '' || minaType === 'unsure';
      // Class names for conditional emphasis
      const minaClass = minaActive ? 'jh-pin-active' : 'jh-pin-dim';
      const aziziyahClass = showAziziyah ? 'jh-pin-active' : '';

      const host = el('div', { class: 'journey-hero' });

      // The SVG itself, hand-tuned so the geography reads as map-like
      // (Madinah top-right, Makkah cluster bottom-left, Hajj sites east).
      // viewBox is fixed; the host scales responsively.
      host.innerHTML = `
        <div class="journey-hero__inner">
          <svg viewBox="0 0 680 460" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the Hajj journey from Madinah to Makkah and the holy sites">
            <defs>
              <pattern id="hd-dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="7" cy="7" r="0.4" fill="#d8cfb8"/>
              </pattern>
            </defs>
            <rect x="0" y="0" width="680" height="460" fill="url(#hd-dots)" opacity="0.5"/>
            <text x="32" y="34" class="jh-title">From Madinah to Makkah · your journey</text>
            <line x1="32" y1="42" x2="200" y2="42" stroke="#b8954a" stroke-width="0.5"/>

            <!-- Madinah cluster -->
            <circle cx="540" cy="100" r="60" fill="#4a5d4a" opacity="0.05"/>
            <text x="540" y="50" class="jh-region" text-anchor="middle">Madinah</text>
            <text x="540" y="65" class="jh-region-sub" text-anchor="middle">DAYS 1–4</text>
            <g transform="translate(540, 105)">
              <circle r="14" fill="#fff" stroke="#2f3d2f" stroke-width="1"/>
              <path d="M -7 4 L -7 -2 Q -7 -8 -3 -9 Q 0 -11 3 -9 Q 7 -8 7 -2 L 7 4 Z" fill="#2f3d2f"/>
              <circle cx="0" cy="-12" r="1.2" fill="#b8954a"/>
            </g>
            <text x="540" y="138" class="jh-pin-sub" text-anchor="middle">Masjid an-Nabawi</text>

            <!-- Travel path Madinah → Makkah -->
            <path d="M 510 130 Q 380 230 240 240" fill="none" stroke="#b8954a" stroke-width="1" stroke-dasharray="3 4" opacity="0.7"/>
            <text x="380" y="200" class="jh-path-label" text-anchor="middle">~440 km · Day 5</text>

            <!-- Makkah cluster -->
            <circle cx="180" cy="280" r="120" fill="#4a5d4a" opacity="0.04"/>
            <text x="80" y="220" class="jh-region">Makkah</text>
            <text x="80" y="234" class="jh-region-sub">DAYS 5–14</text>

            <g transform="translate(180, 280)">
              <circle r="18" fill="#fff" stroke="#2f3d2f" stroke-width="1.5"/>
              <rect x="-7" y="-7" width="14" height="14" fill="#1a1d1a"/>
              <line x1="-7" y1="-2" x2="7" y2="-2" stroke="#b8954a" stroke-width="1"/>
            </g>
            <text x="180" y="322" class="jh-pin" text-anchor="middle">Masjid al-Haram</text>
            <text x="180" y="336" class="jh-pin-sub" text-anchor="middle">Day 5: Umrah · Day 13: Wada</text>

            <g transform="translate(290, 250)" class="${minaClass}">
              <circle r="11" fill="#fff" stroke="#2f3d2f" stroke-width="1"/>
              <path d="M -5 4 L 0 -5 L 5 4 Z" fill="#2f3d2f"/>
              <line x1="-5" y1="4" x2="5" y2="4" stroke="#2f3d2f" stroke-width="0.5"/>
            </g>
            <text x="290" y="232" class="jh-pin ${minaClass}" text-anchor="middle">Mina</text>
            <text x="290" y="280" class="jh-pin-sub ${minaClass}" text-anchor="middle">Days 8 · 10 · 11 · 12</text>

            ${showAziziyah ? `
            <!-- Aziziyah — residential district between Makkah and Mina, used for shifting packages -->
            <g transform="translate(232, 218)" class="jh-aziziyah-marker ${aziziyahClass}">
              <circle r="9" fill="#fdfbf6" stroke="#a85d3c" stroke-width="1.2"/>
              <!-- Building silhouette to differentiate from Mina's tent -->
              <rect x="-4" y="-4" width="8" height="8" fill="#a85d3c"/>
              <rect x="-3" y="-2" width="1" height="1" fill="#fdfbf6"/>
              <rect x="-1" y="-2" width="1" height="1" fill="#fdfbf6"/>
              <rect x="1" y="-2" width="1" height="1" fill="#fdfbf6"/>
              <rect x="-3" y="0" width="1" height="1" fill="#fdfbf6"/>
              <rect x="-1" y="0" width="1" height="1" fill="#fdfbf6"/>
              <rect x="1" y="0" width="1" height="1" fill="#fdfbf6"/>
            </g>
            <text x="232" y="200" class="jh-pin jh-pin-aziziyah" text-anchor="middle">Aziziyah</text>
            <text x="232" y="240" class="jh-pin-sub" text-anchor="middle" font-style="italic">your camp</text>
            ` : ''}

            <g transform="translate(380, 290)">
              <circle r="9" fill="#fff" stroke="#2f3d2f" stroke-width="1"/>
              <circle cx="-3" cy="0" r="1" fill="#2f3d2f"/>
              <circle cx="0" cy="0" r="1" fill="#2f3d2f"/>
              <circle cx="3" cy="0" r="1" fill="#2f3d2f"/>
            </g>
            <text x="380" y="313" class="jh-pin" text-anchor="middle">Muzdalifah</text>
            <text x="380" y="325" class="jh-pin-sub" text-anchor="middle">Night of 9th</text>

            <g transform="translate(490, 320)">
              <circle r="13" fill="#fff" stroke="#2f3d2f" stroke-width="1.5"/>
              <path d="M -7 4 L -3 -4 L 0 -2 L 3 -5 L 7 4 Z" fill="#2f3d2f"/>
            </g>
            <text x="490" y="345" class="jh-pin" text-anchor="middle">Arafah</text>
            <text x="490" y="358" class="jh-pin-sub" text-anchor="middle">Day 9 · Wuquf</text>

            <g transform="translate(310, 234)">
              <circle r="6" fill="#b8954a"/>
              <circle r="3" fill="#fff"/>
            </g>
            <text x="335" y="225" class="jh-pin-sub" font-style="italic">Jamarat</text>

            <!-- Hajj day path -->
            <path d="M 200 270 Q 250 258 280 252" fill="none" stroke="#a85d3c" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M 300 250 Q 380 270 478 318" fill="none" stroke="#a85d3c" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M 478 318 Q 430 305 388 292" fill="none" stroke="#a85d3c" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="2 2"/>
            <path d="M 372 286 Q 340 268 300 252" fill="none" stroke="#a85d3c" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M 280 250 Q 230 260 198 268" fill="none" stroke="#a85d3c" stroke-width="0.8" stroke-linecap="round" stroke-dasharray="1 3" opacity="0.6"/>

            <!-- Day-number medallions along the ritual path -->
            <g class="jh-day">
              <circle cx="248" cy="262" r="9" fill="#fdfbf6" stroke="#a85d3c" stroke-width="0.8"/>
              <text x="248" y="266" text-anchor="middle">8</text>
              <circle cx="395" cy="288" r="9" fill="#fdfbf6" stroke="#a85d3c" stroke-width="0.8"/>
              <text x="395" y="292" text-anchor="middle">9</text>
              <circle cx="335" cy="280" r="9" fill="#fdfbf6" stroke="#a85d3c" stroke-width="0.8"/>
              <text x="335" y="284" text-anchor="middle">10</text>
            </g>

            <!-- Legend -->
            <g transform="translate(32, 400)">
              <text class="jh-legend-title">LEGEND</text>
              <line x1="0" y1="14" x2="200" y2="14" stroke="#ede4d3" stroke-width="0.5"/>
              <line x1="0" y1="28" x2="20" y2="28" stroke="#b8954a" stroke-width="1" stroke-dasharray="3 4"/>
              <text x="26" y="32" class="jh-legend">Inter-city travel</text>
              <line x1="0" y1="44" x2="20" y2="44" stroke="#a85d3c" stroke-width="1.2"/>
              <text x="26" y="48" class="jh-legend">Hajj rituals path</text>
              <circle cx="220" cy="28" r="6" fill="#fdfbf6" stroke="#a85d3c" stroke-width="0.8"/>
              <text x="220" y="31" class="jh-legend-day" text-anchor="middle">9</text>
              <text x="232" y="32" class="jh-legend">Day of Dhul Hijjah</text>
            </g>
          </svg>
        </div>
        <p class="journey-hero__caption">
          From <em>${this.escapeHtmlSafe(madinahHotelName)}</em> to <em>${this.escapeHtmlSafe(makkahHotelName)}</em>, with the five days of Hajj at the eastern sites. Geography is stylised — the real Mina is just minutes from the Haram by foot.
        </p>
      `;
      return host;
    },

    /**
     * v2: Sticky journey strip (Option 2) — pinned navigation across
     * the major locations. Click a pin to jump to that section's first
     * day card; intersection observer highlights the active stop as
     * the user scrolls.
     */
    renderJourneyStrip() {
      const stops = [
        { id: 'madinah',     label: 'Madinah',    sub: 'Days 1–4' },
        { id: 'makkah',      label: 'Makkah',     sub: 'Day 5' },
        { id: 'hajj',        label: '5 Days',     sub: 'Mina · Arafah · Muzdalifah' },
        { id: 'makkah-post', label: 'Makkah',     sub: 'Tawaf al-Wada' },
      ];

      const strip = el('nav', {
        class: 'journey-strip',
        'aria-label': 'Journey navigation',
      });

      const inner = el('div', { class: 'journey-strip__inner' });
      stops.forEach((stop, i) => {
        const btn = el('button', {
          type: 'button',
          class: 'journey-strip__pin',
          'data-stop': stop.id,
        });
        btn.appendChild(el('span', { class: 'journey-strip__label' }, stop.label));
        btn.appendChild(el('span', { class: 'journey-strip__sub' }, stop.sub));
        btn.addEventListener('click', () => this._scrollToStop(stop.id));
        inner.appendChild(btn);
        if (i < stops.length - 1) {
          inner.appendChild(el('span', { class: 'journey-strip__sep', 'aria-hidden': 'true' }, '·'));
        }
      });
      strip.appendChild(inner);
      return strip;
    },

    /**
     * Map a day object to one of the strip's stops. Reads the day's
     * dateLabel/title/location to figure out which segment of the trip
     * it belongs to. Returns null if a day shouldn't trigger highlighting
     * (e.g. flight days).
     */
    classifyDayLocation(day) {
      if (!day) return null;
      const t = (day.title || '').toLowerCase();
      const loc = (day.location || '').toLowerCase();

      // Hajj days share the "5 Days" segment — keyed off Hijri label
      if (/dhul hijjah|tarwiyah|arafah|nahr|tashreeq/i.test(t)) return 'hajj';
      if (loc.includes('mina') || loc.includes('arafah') || loc.includes('muzdalifah')) return 'hajj';

      if (t.startsWith('arrive in madinah') || t.startsWith('in madinah')) return 'madinah';
      if (t.includes('travel to makkah') || t.startsWith('umrah')) return 'makkah';
      if (t.startsWith('rest in makkah')) return 'makkah';
      if (t.startsWith('recovery in makkah') || t.startsWith('in makkah') ||
          t.includes('tawaf al-wada')) return 'makkah-post';

      // Departure / Return don't get highlighted in the strip
      return null;
    },

    /**
     * Wire intersection observer between strip pins and day cards.
     * As the user scrolls, the strip pin matching the most-visible
     * day card gets the .is-active class.
     */
    wireJourneyStripObserver(rootEl) {
      const strip = rootEl.querySelector('.journey-strip');
      if (!strip || typeof IntersectionObserver === 'undefined') return;

      const cards = rootEl.querySelectorAll('.day-card[data-stop]');
      if (!cards.length) return;

      const setActive = (stopId) => {
        strip.querySelectorAll('.journey-strip__pin').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-stop') === stopId);
        });
      };

      // Set initial active to first stop
      setActive(cards[0].getAttribute('data-stop'));

      const observer = new IntersectionObserver(
        (entries) => {
          // Find the entry closest to the top of the viewport that is intersecting
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          if (visible) {
            const stop = visible.target.getAttribute('data-stop');
            if (stop) setActive(stop);
          }
        },
        {
          // Trigger when a card crosses ~30% from the top of the viewport
          rootMargin: '-30% 0px -60% 0px',
          threshold: 0,
        }
      );

      cards.forEach((c) => observer.observe(c));

      // Save reference for cleanup if the tab unmounts later
      this._journeyObserver = observer;
    },

    /**
     * Scroll to the first day card matching a stop, opening it.
     */
    _scrollToStop(stopId) {
      const card = document.querySelector(
        `.day-card[data-stop="${stopId}"]`
      );
      if (!card) return;
      // Account for sticky tab nav height + strip height
      const navOffset = 130;
      const top = card.getBoundingClientRect().top + window.pageYOffset - navOffset;
      window.scrollTo({ top, behavior: 'smooth' });
      // Open the card
      card.classList.add('is-open');
    },

    /** Tiny helper: HTML-escape user-controlled strings before innerHTML use. */
    escapeHtmlSafe(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * v2.2 — Helpers for the multi-hotel schema (madinahHotels / makkahHotels arrays).
     *
     * `getHotels(city)` returns the array (always an array, defensive).
     * `firstHotelName(city)` returns the first non-empty hotel name (used in journey-map caption).
     * `hotelNameForDate(city, date)` returns the hotel whose date range contains the given date,
     *   falling back to the first hotel when no date matches.
     */
    getHotels(city) {
      const cfg = this.config || {};
      const arr = cfg[city + 'Hotels'];
      return Array.isArray(arr) ? arr : [];
    },

    firstHotelName(city, fallback) {
      const list = this.getHotels(city);
      const named = list.find(h => h && h.name);
      return named ? named.name : (fallback || '');
    },

    /**
     * Pick the right hotel for a given date. ISO yyyy-mm-dd comparison works
     * because Date object's toISOString gives us a sortable string after slicing.
     * Returns the hotel whose [fromDate, toDate] window contains the date,
     * else the first named hotel, else null.
     */
    hotelForDate(city, date) {
      const list = this.getHotels(city);
      if (!list.length) return null;
      if (!date) return list.find(h => h && h.name) || null;

      const iso = (date instanceof Date)
        ? date.toISOString().slice(0, 10)
        : String(date).slice(0, 10);

      // First try: hotel whose dates contain the day (inclusive on both ends)
      for (const h of list) {
        if (!h || !h.name) continue;
        const f = h.fromDate || '';
        const t = h.toDate || '';
        if (f && t) {
          if (iso >= f && iso <= t) return h;
        } else if (f && !t) {
          if (iso >= f) return h;
        } else if (!f && t) {
          if (iso <= t) return h;
        }
      }
      // Fallback: first hotel with a name
      return list.find(h => h && h.name) || null;
    },

    hotelNameForDate(city, date, fallback) {
      const h = this.hotelForDate(city, date);
      return (h && h.name) ? h.name : (fallback || '');
    },

    tabHajjDays() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'The Five Days of Hajj'));
      wrap.appendChild(el('p', { class: 'lead' },
        'From the 8th of Dhul Hijjah (Yawm at-Tarwiyah) to the 12th or 13th. The order, timing and rulings of each day matter — particularly in your madhab. Tap any day for the detail.'
      ));

      const days = this.data.itinerary.phases.find(p => p.id === 'hajj-days').days;
      const madhab = this.config.madhab || 'hanafi';

      days.forEach((day, idx) => {
        const card = el('div', { class: 'day-card is-open' });
        const head = el('div', { class: 'day-card__header' });
        head.appendChild(el('span', { class: 'day-card__date' }, day.hijri));
        head.appendChild(el('span', { class: 'day-card__title' }, day.name));
        head.appendChild(el('span', { class: 'day-card__location' }, day.location));
        card.appendChild(head);

        const body = el('div', { class: 'day-card__body' });
        const inner = el('div', { class: 'day-card__inner' });
        inner.appendChild(el('p', null, day.summary));

        // Day-specific rulings
        const rulings = this.rulingsForHajjDay(idx, madhab);
        if (rulings.length) {
          inner.appendChild(el('h4', { class: 'eyebrow' }, 'Key rulings'));
          rulings.forEach(r => inner.appendChild(this.renderRuling(r, madhab)));
        }

        body.appendChild(inner);
        card.appendChild(body);
        wrap.appendChild(card);
      });

      return wrap;
    },

    tabUmrah() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Umrah'));
      wrap.appendChild(el('p', { class: 'lead' },
        'The lesser pilgrimage — performed before Hajj for Tamattu\' pilgrims. Eight steps from Ihram to release.'
      ));

      const steps = [
        {
          title: 'Ghusl & Ihram',
          body: 'Take a ritual bath (ghusl) before donning Ihram. Men: two unstitched white cloths (izar and rida). Women: regular modest clothing covering the body except hands and face. Apply non-scented ointments only.',
        },
        {
          title: 'At the Miqat',
          body: 'Pray two rakahs of Ihram (sunnah) if time and place permit. Make the niyyah (intention) for Umrah, then begin the Talbiyah. From this moment until the rituals are complete, you avoid: cutting hair/nails, perfume, hunting, marital relations, arguments and harming any living thing.',
        },
        {
          title: 'Entering Makkah',
          body: 'Continue Talbiyah until you see the Ka\'bah for the first time. Pause and supplicate — duas at this moment are accepted.',
        },
        {
          title: 'Tawaf',
          body: 'Seven counter-clockwise circuits of the Ka\'bah, beginning at the line of the Black Stone. Men: uncover right shoulder (idtiba) and walk briskly in the first three circuits (ramal). On completion, pray two rakahs behind Maqam Ibrahim, then drink Zamzam.',
        },
        {
          title: 'Sa\'i',
          body: 'Seven trips between Safa and Marwah, beginning at Safa. The two stretches between the green markers are jogged by men if able. Each trip ends with personal supplication.',
        },
        {
          title: 'Halq or Taqsir',
          body: 'Men: shave the head (halq, preferred) or shorten across the entire head. Women: cut a fingertip-length from a small portion of the hair. This releases you from Ihram.',
        },
        {
          title: 'Release',
          body: 'All Ihram restrictions are lifted. The Umrah is complete. For Tamattu\' pilgrims, you re-enter Ihram on the 8th of Dhul Hijjah for Hajj.',
        },
      ];

      steps.forEach((step, i) => {
        const card = el('div', { class: 'card', style: { marginBottom: 'var(--space-4)' } });
        card.appendChild(el('div', { class: 'eyebrow' }, `Step ${i + 1} of ${steps.length}`));
        card.appendChild(el('h3', { style: { marginTop: '8px' } }, step.title));
        card.appendChild(el('p', { style: { marginBottom: 0 } }, step.body));
        wrap.appendChild(card);
      });

      return wrap;
    },

    tabDuas() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Duas'));
      wrap.appendChild(el('p', { class: 'lead' },
        'Every supplication you need for the journey, with Arabic, transliteration, and English.'
      ));

      // Render each dua
      this.data.duas.forEach(dua => {
        wrap.appendChild(this.renderDuaCard(dua));
      });

      return wrap;
    },

    tabRulings() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Rulings by Madhab'));
      const madhab = this.config.madhab || 'hanafi';
      wrap.appendChild(el('p', { class: 'lead' },
        'Showing the position of the ', this.renderMadhabBadge(madhab),
        ' school by default. Tap "Compare" on any ruling to see the other three.'
      ));

      // Madhab switcher
      const switcher = el('div', { class: 'card', style: { marginBottom: 'var(--space-5)' } });
      switcher.appendChild(el('div', { class: 'eyebrow' }, 'Switch your madhab'));
      switcher.appendChild(el('p', { class: 'text-mute', style: { fontSize: 'var(--fs-sm)' } },
        'This changes the default position shown throughout the guide.'
      ));
      const grid = el('div', { class: 'option-grid' });
      ['hanafi', 'shafi', 'maliki', 'hanbali'].forEach(m => {
        const card = el('label', {
          class: 'option-card' + (madhab === m ? ' is-selected' : ''),
        });
        const input = el('input', { type: 'radio', name: 'madhab-switcher', value: m });
        if (madhab === m) input.checked = true;
        input.addEventListener('change', () => {
          Store.set({ config: { madhab: m } });
          this.config = Store.getConfig();
          this.render();
        });
        card.appendChild(input);
        card.appendChild(el('span', { class: 'option-card__title' }, this.madhabName(m)));
        grid.appendChild(card);
      });
      switcher.appendChild(grid);
      wrap.appendChild(switcher);

      // Group rulings by category
      const byCat = {};
      this.data.rulings.forEach(r => {
        if (!byCat[r.category]) byCat[r.category] = [];
        byCat[r.category].push(r);
      });
      const catNames = {
        ihram: 'Ihram', tawaf: 'Tawaf', 'sa-i': 'Sa\'i', salah: 'Prayer',
        arafah: 'Arafah', muzdalifah: 'Muzdalifah', mina: 'Mina',
        rami: 'Stoning (Rami)', 'halq-taqsir': 'Halq & Taqsir',
        sacrifice: 'Sacrifice (Hady)',
      };

      Object.keys(byCat).forEach(catKey => {
        wrap.appendChild(el('h2', { style: { marginTop: 'var(--space-6)' } }, catNames[catKey] || catKey));
        byCat[catKey].forEach(r => wrap.appendChild(this.renderRuling(r, madhab)));
      });

      return wrap;
    },

    tabLocations() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Sacred Locations'));
      wrap.appendChild(el('p', { class: 'lead' },
        'The places of the journey. Distances are walking estimates; transport may be required in heat or for those with limited mobility.'
      ));

      const places = [
        { key: 'masjidAnNabawi', name: 'Masjid an-Nabawi', desc: 'The Prophet\'s Mosque in Madinah. The Rawdah, between the pulpit and the Prophet\'s grave, is one of the gardens of Paradise.' },
        { key: 'masjidAlHaram', name: 'Masjid al-Haram', desc: 'The Sacred Mosque containing the Ka\'bah, the Black Stone, Maqam Ibrahim, the Hijr (Hatim), Zamzam, and the Sa\'i corridor between Safa and Marwah.' },
        { key: 'mina', name: 'Mina', desc: 'The valley of tents east of Makkah. Pilgrims spend the 8th, 10th, 11th, 12th (and optionally 13th) of Dhul Hijjah here. Distance from Masjid al-Haram: ~7 km.' },
        { key: 'arafah', name: 'Arafah (Jabal ar-Rahmah)', desc: 'The plain where the standing (Wuquf) takes place on the 9th of Dhul Hijjah — the central rite of Hajj. Distance from Mina: ~14 km.' },
        { key: 'muzdalifah', name: 'Muzdalifah (Mash\'ar al-Haram)', desc: 'The plain between Arafah and Mina. Pilgrims stay the night of the 9th, combining Maghrib and Isha and collecting pebbles for stoning. Distance from Arafah: ~9 km.' },
        { key: 'jamarat', name: 'Jamarat', desc: 'The three pillars (Sughra, Wusta, Aqabah) representing the temptations of Shaytan. Pilgrims throw seven pebbles at each. Distance from most Mina camps: ~2-3 km on foot.' },
      ];

      // v2.2 — User's hotels (multi-hotel array support).
      const madinahHotels = this.getHotels('madinah').filter(h => h && h.name);
      const makkahHotels  = this.getHotels('makkah').filter(h => h && h.name);
      if (madinahHotels.length || makkahHotels.length) {
        wrap.appendChild(el('h2', { style: { marginTop: 'var(--space-5)' } }, 'Your accommodation'));
        madinahHotels.forEach(h => wrap.appendChild(this.renderHotelCard('madinah', h)));
        makkahHotels.forEach(h => wrap.appendChild(this.renderHotelCard('makkah', h)));
      }

      wrap.appendChild(el('h2', { style: { marginTop: 'var(--space-7)' } }, 'Holy sites'));

      places.forEach(p => {
        const place = Maps.PLACES[p.key];
        const card = el('div', { class: 'card', style: { marginBottom: 'var(--space-5)' } });
        card.appendChild(el('h3', { style: { marginTop: 0 } }, p.name));
        card.appendChild(el('p', null, p.desc));
        const mapWrap = el('div');
        const mapEl = el('div', { class: 'map-embed' });
        mapWrap.appendChild(mapEl);
        card.appendChild(mapWrap);
        // Render map embed
        if (window.Maps && place) {
          requestAnimationFrame(() => Maps.renderEmbed(mapEl, place));
        }
        wrap.appendChild(card);
      });

      return wrap;
    },

    tabPacking() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Packing Checklist'));
      wrap.appendChild(el('p', { class: 'lead' },
        'A comprehensive list — check things off as you pack. Your progress is saved automatically.'
      ));

      const sections = this.packingData();
      const packing = Store.getPacking();

      sections.forEach(section => {
        const sec = el('section', { class: 'packing-section' });
        const head = el('div', { class: 'packing-section__header' });
        head.appendChild(el('h2', { class: 'packing-section__title' }, section.title));
        const countEl = el('span', { class: 'packing-section__count' });
        head.appendChild(countEl);
        sec.appendChild(head);

        const list = el('ul', { class: 'packing-list' });
        const updateCount = () => {
          const total = section.items.length;
          const done = section.items.filter(i => packing[i.id]).length;
          countEl.textContent = `${done} of ${total} packed`;
        };
        updateCount();

        section.items.forEach(item => {
          const li = el('li', { class: 'packing-item' + (packing[item.id] ? ' is-checked' : '') });
          const cb = el('input', { type: 'checkbox' });
          cb.checked = !!packing[item.id];
          cb.addEventListener('change', () => {
            Store.togglePacking(item.id);
            packing[item.id] = cb.checked;
            li.classList.toggle('is-checked', cb.checked);
            updateCount();
          });
          li.appendChild(cb);
          const label = el('div', { class: 'packing-item__label' }, item.label);
          if (item.hint) {
            label.appendChild(el('span', { class: 'packing-item__hint' }, item.hint));
          }
          li.appendChild(label);
          li.addEventListener('click', e => {
            if (e.target !== cb) {
              cb.checked = !cb.checked;
              cb.dispatchEvent(new Event('change'));
            }
          });
          list.appendChild(li);
        });

        sec.appendChild(list);
        wrap.appendChild(sec);
      });

      return wrap;
    },

    tabPreparation() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Preparation'));
      wrap.appendChild(el('p', { class: 'lead' },
        'A timeline of what to do — and when — to arrive ready in body, mind and soul.'
      ));

      const phases = [
        {
          when: 'Three months before',
          items: [
            'Make the niyyah and inform close family of your intention.',
            'Begin daily exercise — walk 5–10 km a day to build stamina.',
            'Confirm visa, vaccinations (meningitis ACWY required; check with your operator).',
            'Settle outstanding debts, ask forgiveness, restore severed ties.',
            'Begin reading a Hajj manual from a scholar of your madhab.',
          ]
        },
        {
          when: 'One month before',
          items: [
            'Verify all rituals and timings — particularly madhab-specific ones.',
            'Memorise key duas (Talbiyah, Niyyah, Rabbana atina, Arafah dua).',
            'Pack early so you don\'t forget anything in the rush.',
            'Test your phone with international roaming or buy a Saudi SIM plan.',
            'Inform employer, set out-of-office, prepare household for absence.',
          ]
        },
        {
          when: 'One week before',
          items: [
            'Confirm flights, transfers, accommodation. Save all references offline.',
            'Photocopy passport, visa, ID — keep copies in different bags.',
            'Make a clear will and leave with a trusted person.',
            'Distribute charity (sadaqah) before departure.',
            'Visit family, ask for forgiveness in person where possible.',
          ]
        },
        {
          when: 'Day of departure',
          items: [
            'Take ghusl (full ritual bath) before leaving home.',
            'Pray two rakahs at home as a farewell prayer.',
            'Recite the dua for leaving home as you step out.',
            'Recite the traveller\'s dua and dua for boarding the plane.',
            'Begin the journey in a state of calm and gratitude.',
          ]
        }
      ];

      phases.forEach(phase => {
        const card = el('div', { class: 'card', style: { marginBottom: 'var(--space-4)' } });
        card.appendChild(el('div', { class: 'eyebrow' }, phase.when));
        card.appendChild(el('h3', { style: { marginTop: '6px' } }, phase.when));
        const list = el('ul', { style: { paddingLeft: '20px', lineHeight: '1.7', margin: 0 } });
        phase.items.forEach(i => list.appendChild(el('li', null, i)));
        card.appendChild(list);
        wrap.appendChild(card);
      });

      return wrap;
    },

    tabWisdom() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Wisdom & Practical Tips'));
      wrap.appendChild(el('p', { class: 'lead' },
        'Lessons from those who have walked before you.'
      ));

      const sections = [
        {
          title: 'Heat & hydration',
          tips: [
            'Drink water constantly — small sips, every hour. Don\'t wait until you feel thirsty.',
            'Carry an electrolyte solution (Dioralyte, ORS). Plain water alone leads to imbalance in extreme heat.',
            'Use an umbrella for shade when walking — it\'s permitted in Ihram for men.',
            'Wet a small towel and place it on the back of the neck during long stops.',
            'Eat regularly even if not hungry. Skipping meals worsens dehydration.',
            'Recognise heat exhaustion: headache, nausea, dizziness, cold sweat. Stop, hydrate, find shade. Get help if it doesn\'t pass.',
          ]
        },
        {
          title: 'Crowd safety',
          tips: [
            'Never go against the flow. If you\'ve dropped something, do not bend down — keep moving.',
            'Stay calm during pelting (Rami). The crowds surge most around dawn — go later.',
            'Memorise your group meeting point and operator phone number. Save them in your phone and on paper.',
            'Wear an ID bracelet or carry a card with your accommodation, group leader and emergency contact.',
            'In a tight crowd, move sideways — never backwards.',
            'Stay near the edges of huge crowds, not in the middle.',
            'If separated from your group, return to your accommodation rather than searching at the rituals.',
          ]
        },
        {
          title: 'Common mistakes',
          tips: [
            'Going to Arafah but leaving before sunset — invalidates Wuquf in Maliki and risks dam in others.',
            'Praying Maghrib at Arafah instead of Muzdalifah (wajib in Hanafi to delay).',
            'Performing Rami on the 11th or 12th before Zawal (invalid in three madhabs).',
            'Touching the body of Ihram cloth to the face for women (dispute in Hanafi/Shafi\'i).',
            'Cutting only a few hairs after Sa\'i (insufficient in Hanafi/Maliki/Hanbali).',
            'Doing Tawaf without wudu (invalid in Shafi\'i/Maliki/Hanbali; sinful in Hanafi).',
            'Skipping Tawaf al-Wada (wajib in Hanafi/Shafi\'i/Hanbali; dam if missed).',
            'Forgetting Takbir at-Tashreeq after fard prayers.',
          ]
        },
        {
          title: 'For families',
          tips: [
            'Establish meeting points for every location — accommodation, Haram entrance, group bus.',
            'Children should carry a card with the parent\'s phone number, hotel, and group name.',
            'Discuss separation procedure in advance: where to go, who to call.',
            'Women should travel with a mahram. Confirm madhab requirements with your scholar.',
            'For older travellers: consider a wheelchair option for Tawaf and Sa\'i — there is a dedicated upper level.',
          ]
        },
        {
          title: 'Useful apps',
          tips: [
            'Nusuk — official Saudi app, required for entry to Rawdah and other services.',
            'Tawakkalna — for any government service in Saudi Arabia.',
            'Muslim Pro / Athan — prayer times that adjust to your location.',
            'Google Maps — has Madinah and Makkah well-mapped, including walking routes.',
            'Currency converter (offline mode) — for understanding prices in Riyal.',
          ]
        }
      ];

      sections.forEach(section => {
        wrap.appendChild(el('h2', { style: { marginTop: 'var(--space-6)' } }, section.title));
        const list = el('div', { class: 'card' });
        const ul = el('ul', { style: { paddingLeft: '20px', lineHeight: '1.7', margin: 0 } });
        section.tips.forEach(tip => ul.appendChild(el('li', { style: { marginBottom: '8px' } }, tip)));
        list.appendChild(ul);
        wrap.appendChild(list);
      });

      return wrap;
    },

    /* v2.7 — Journal tab. Aggregates entries from all day cards into a
       chronological list. Empty state when nothing written yet. */
    tabJournal() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Journal'));
      wrap.appendChild(el('p', { class: 'lead' },
        'Reflections from your Hajj — what stayed with you, lessons, gratitude, duas accepted. ' +
        'Entries also appear inline with each day in the Itinerary.'
      ));

      const entries = (window.Journal && Journal.all()) || [];

      // Header row with count + export button
      const header = el('div', {
        class: 'journal-header',
        style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', margin: 'var(--space-5) 0' }
      });
      header.appendChild(el('div', { class: 'eyebrow', style: { margin: 0 } },
        entries.length === 0 ? 'No entries yet'
          : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
      ));
      if (entries.length) {
        const exportBtn = el('button', { class: 'btn btn--ghost' }, 'Export as text');
        exportBtn.addEventListener('click', () => Journal.exportAll());
        header.appendChild(exportBtn);
      }
      wrap.appendChild(header);

      if (!entries.length) {
        // Empty state
        const empty = el('div', { class: 'journal-empty' });
        empty.appendChild(el('p', { class: 'journal-empty__lead' },
          'Open any day in the Itinerary tab and write a reflection. Your entries will collect here.'
        ));
        empty.appendChild(el('p', { class: 'journal-empty__hint text-mute italic' },
          'A small written reflection each day — even a sentence — becomes a precious record after the trip is over.'
        ));
        const goBtn = el('button', { class: 'btn btn--primary' }, 'Open Itinerary →');
        goBtn.addEventListener('click', () => this.switchTab('itinerary'));
        empty.appendChild(goBtn);
        wrap.appendChild(empty);
        return wrap;
      }

      // Render each entry as a card
      const list = el('div', { class: 'journal-list' });
      // Most recent first
      entries.slice().reverse().forEach(entry => {
        const card = el('article', { class: 'journal-entry' });

        const head = el('header', { class: 'journal-entry__head' });
        let dateLine = entry.dateIso;
        try {
          const d = new Date(entry.dateIso + 'T00:00:00');
          dateLine = d.toLocaleDateString(undefined, {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });
        } catch (e) { /* keep iso */ }
        head.appendChild(el('div', { class: 'journal-entry__date' }, dateLine));
        // Hijri date sub-line
        const hijri = (() => {
          try { return Utils.formatHijri(new Date(entry.dateIso + 'T00:00:00')); }
          catch (e) { return ''; }
        })();
        if (hijri) head.appendChild(el('div', { class: 'journal-entry__hijri' }, hijri));
        card.appendChild(head);

        // Body — preserve the user's line breaks
        const body = el('div', { class: 'journal-entry__body' });
        // Split on \n and render <p> for each non-empty paragraph
        const paras = entry.text.split(/\n\s*\n/);
        paras.forEach(p => {
          const trimmed = p.trim();
          if (trimmed) {
            // Within paragraph, single \n becomes <br>
            const para = el('p');
            const lines = trimmed.split(/\n/);
            lines.forEach((line, i) => {
              para.appendChild(document.createTextNode(line));
              if (i < lines.length - 1) para.appendChild(el('br'));
            });
            body.appendChild(para);
          }
        });
        card.appendChild(body);

        // Footer — jump-to-day link
        const footer = el('footer', { class: 'journal-entry__footer' });
        const editLink = el('button', {
          class: 'journal-entry__edit',
          type: 'button',
        }, 'Edit on the Itinerary →');
        editLink.addEventListener('click', () => {
          this.switchTab('itinerary');
          // Try to scroll to that day's card
          requestAnimationFrame(() => {
            const cards = document.querySelectorAll('#tab-itinerary .day-card');
            for (const c of cards) {
              const dateEl = c.querySelector('.day-card__date');
              // We can't easily match by ISO, so just scroll to the first one for now
              // (The user lands on the itinerary; scrolling to the exact day is a nice-to-have.)
              break;
            }
            const target = document.querySelector('#tab-itinerary');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
        footer.appendChild(editLink);
        card.appendChild(footer);

        list.appendChild(card);
      });
      wrap.appendChild(list);

      return wrap;
    },

    tabSettings() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Settings'));
      wrap.appendChild(el('p', { class: 'lead' },
        'Adjust your preferences and trip details.'
      ));

      // v2.7 — pilgrim's name (used on emergency card + journal export).
      // Inline editable field — auto-saves to config on blur.
      const nameCard = el('div', { class: 'settings-card', style: { gridColumn: '1 / -1' } });
      nameCard.appendChild(el('h3', null, 'Your name'));
      nameCard.appendChild(el('p', { class: 'text-mute', style: { margin: '0 0 var(--space-3)' } },
        'Used on your printed emergency card and as a header on your journal export.'
      ));
      const nameInput = el('input', {
        type: 'text',
        class: 'field__input',
        placeholder: 'e.g. Ahmed Khan',
        value: (this.config && this.config.pilgrimName) || '',
        style: { maxWidth: '420px' },
      });
      nameInput.addEventListener('blur', () => {
        const cfg = Store.getConfig() || {};
        cfg.pilgrimName = nameInput.value.trim();
        Store.set({ config: cfg });
        this.config = cfg;
      });
      nameCard.appendChild(nameInput);

      const grid = el('div', { class: 'settings-grid' });
      grid.appendChild(nameCard);

      // Edit setup
      const editCard = el('div', { class: 'settings-card' });
      editCard.appendChild(el('h3', null, 'Trip details'));
      editCard.appendChild(el('p', null, 'Update your flights, accommodation, operator or madhab.'));
      const editBtn = el('a', { class: 'btn btn--primary', href: './index.html' }, 'Edit setup →');
      editCard.appendChild(editBtn);
      grid.appendChild(editCard);

      // Notes export
      const notesCard = el('div', { class: 'settings-card' });
      notesCard.appendChild(el('h3', null, 'Your notes'));
      notesCard.appendChild(el('p', null, 'Export all the notes you\'ve written across the guide.'));
      const exportBtn = el('button', { class: 'btn btn--secondary' }, 'Export notes as text');
      exportBtn.addEventListener('click', () => Notes.exportAll());
      notesCard.appendChild(exportBtn);
      grid.appendChild(notesCard);

      // Reset
      const resetCard = el('div', { class: 'settings-card' });
      resetCard.appendChild(el('h3', null, 'Reset everything'));
      resetCard.appendChild(el('p', null, 'Clear all your data — flights, notes, packing. This cannot be undone.'));
      const resetBtn = el('button', { class: 'btn btn--secondary', style: { color: 'var(--crimson)' } }, 'Reset all data');
      resetBtn.addEventListener('click', async () => {
        if (confirm('This will erase everything. Continue?')) {
          Store.reset();
          if (window.Disclaimer && Disclaimer.reset) Disclaimer.reset();
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          window.location.href = './index.html';
        }
      });
      resetCard.appendChild(resetBtn);
      grid.appendChild(resetCard);

      wrap.appendChild(grid);

      // Disclaimer
      wrap.appendChild(el('div', { class: 'callout callout--info', style: { marginTop: 'var(--space-7)' } },
        el('p', { style: { margin: 0 } },
          el('strong', null, 'Disclaimer: '),
          'This is a planning aid, not a fatwa. Times, distances and rulings are approximate and reflect commonly-held positions. Always confirm with a qualified scholar of your madhab. The author is not responsible for trip decisions made on the basis of this guide.'
        )
      ));

      return wrap;
    },

    /* ─── Renderers ──────────────────────────────────────── */

    renderSetupChip() {
      const cfg = this.config;
      const parts = [];

      if (cfg.outboundFlight && cfg.outboundFlight.date) {
        parts.push({ label: 'Departure', value: formatDate(cfg.outboundFlight.date) });
      }
      if (cfg.outboundFlight && cfg.outboundFlight.number) {
        parts.push({ label: 'Flight', value: cfg.outboundFlight.number });
      }
      if (cfg.madhab) {
        parts.push({ label: 'Madhab', value: cfg.madhab.charAt(0).toUpperCase() + cfg.madhab.slice(1) });
      }
      if (cfg.operator && cfg.operator.name) {
        parts.push({ label: 'With', value: cfg.operator.name });
      }

      if (parts.length === 0) {
        return el('div', { style: { marginBottom: 'var(--space-5)' } },
          el('a', { href: './index.html', class: 'setup-chip' }, '+ Personalise this guide')
        );
      }

      const wrap = el('div', { style: { marginBottom: 'var(--space-5)', display: 'flex', flexWrap: 'wrap', gap: '8px' } });
      parts.forEach(p => {
        wrap.appendChild(el('span', { class: 'setup-chip' },
          p.label + ': ', el('strong', null, p.value)
        ));
      });
      wrap.appendChild(el('a', { href: './index.html', class: 'setup-chip', style: { textDecoration: 'none' } }, '✎ Edit'));
      return wrap;
    },

    renderCountdown(targetDate) {
      const wrap = el('div');
      wrap.appendChild(el('h2', { class: 'text-center', style: { marginTop: 'var(--space-6)' } }, 'Countdown'));
      const target = new Date(targetDate);
      const cd = el('div', { class: 'countdown' });
      ['days', 'hours', 'minutes', 'seconds'].forEach(unit => {
        const u = el('div', { class: 'countdown__unit', 'data-unit': unit });
        u.appendChild(el('span', { class: 'countdown__num' }, '—'));
        u.appendChild(el('span', { class: 'countdown__label' }, unit));
        cd.appendChild(u);
      });
      wrap.appendChild(cd);

      const update = () => {
        const now = new Date();
        let diff = target - now;
        if (diff < 0) {
          cd.querySelectorAll('.countdown__num').forEach(n => n.textContent = '0');
          cd.querySelector('.countdown__label').textContent = 'In progress';
          return;
        }
        const d = Math.floor(diff / 86400000); diff -= d * 86400000;
        const h = Math.floor(diff / 3600000); diff -= h * 3600000;
        const m = Math.floor(diff / 60000); diff -= m * 60000;
        const s = Math.floor(diff / 1000);
        const nums = cd.querySelectorAll('.countdown__num');
        nums[0].textContent = d;
        nums[1].textContent = h;
        nums[2].textContent = m;
        nums[3].textContent = s;
      };
      update();
      if (this._countdownTimer) clearInterval(this._countdownTimer);
      this._countdownTimer = setInterval(update, 1000);
      return wrap;
    },

    renderMadhabBadge(m) {
      return el('span', { class: `madhab-badge madhab-badge--${m}` }, this.madhabName(m));
    },

    madhabName(m) {
      return ({ hanafi: 'Hanafi', shafi: 'Shafi\'i', maliki: 'Maliki', hanbali: 'Hanbali' })[m] || m;
    },

    renderRuling(ruling, currentMadhab) {
      const wrap = el('div', { class: 'ruling' });
      wrap.appendChild(el('h4', { class: 'ruling__topic' }, ruling.topic));
      wrap.appendChild(el('p', { class: 'ruling__position' },
        this.renderMadhabBadge(currentMadhab), ' — ',
        ruling[currentMadhab]
      ));

      // Compare panel
      const others = ['hanafi', 'shafi', 'maliki', 'hanbali'].filter(m => m !== currentMadhab);
      const details = el('details', { class: 'ruling__compare' });
      details.appendChild(el('summary', null, 'Compare other schools'));
      others.forEach(m => {
        const row = el('div', { class: 'ruling__other' });
        row.appendChild(el('div', { class: 'ruling__other-label' }, this.madhabName(m)));
        row.appendChild(el('div', { class: 'ruling__other-text' }, ruling[m]));
        details.appendChild(row);
      });
      wrap.appendChild(details);
      return wrap;
    },

    renderHotelCard(region, hotel) {
      const card = el('div', { class: 'hotel-card' });
      card.appendChild(el('div', { class: 'eyebrow' }, region === 'madinah' ? 'In Madinah' : 'In Makkah'));
      card.appendChild(el('h3', { class: 'hotel-card__name' }, hotel.name));
      if (hotel.address) {
        card.appendChild(el('p', { class: 'hotel-card__address' }, hotel.address));
      }
      // Distance to Haram
      const target = region === 'madinah' ? Maps.PLACES.masjidAnNabawi : Maps.PLACES.masjidAlHaram;
      if (hotel.lat && target.lat) {
        const km = Maps.haversine(hotel, target);
        if (km !== null) {
          const mins = Math.round(km * 12); // ~12 min/km walking
          card.appendChild(el('span', { class: 'hotel-card__distance' },
            `📍 ${km.toFixed(2)} km from ${target.name} · approx ${mins} min walk`
          ));
        }
      }

      // Map embed
      const mapWrap = el('div', { style: { marginTop: 'var(--space-3)' } });
      const mapEl = el('div', { class: 'map-embed' });
      mapWrap.appendChild(mapEl);
      card.appendChild(mapWrap);
      if (window.Maps && hotel.placeId) {
        requestAnimationFrame(() => Maps.renderEmbed(mapEl, hotel));
      } else if (window.Maps && hotel.name) {
        requestAnimationFrame(() => Maps.renderEmbed(mapEl, { name: hotel.name }));
      } else {
        mapEl.appendChild(el('div', { class: 'map-embed__placeholder' },
          el('p', null, hotel.name),
          el('p', { style: { fontSize: '13px' } }, 'Map preview unavailable.')
        ));
      }
      return card;
    },

    renderEmergencyCard() {
      const cfg = this.config;
      const card = el('div', { class: 'emergency-card' });
      const dl = el('dl');
      const add = (label, value) => {
        if (!value) return;
        dl.appendChild(el('dt', null, label));
        dl.appendChild(el('dd', null, value));
      };
      const addPhone = (label, value) => {
        if (!value) return;
        dl.appendChild(el('dt', null, label));
        const dd = el('dd', null);
        dd.appendChild(el('a', { href: `tel:${value.replace(/\s/g, '')}` }, value));
        dl.appendChild(dd);
      };

      add('Operator', cfg.operator && cfg.operator.name);
      // v2.2 — also surface Saudi service provider name (resolved from operators.json) if set
      if (cfg.operator && (cfg.operator.serviceProvider || cfg.operator.serviceProviderOther)) {
        let provName = '';
        if (cfg.operator.serviceProvider === '__other__') {
          provName = cfg.operator.serviceProviderOther || '';
        } else if (cfg.operator.serviceProvider && window._OPERATOR_LIST && window._OPERATOR_LIST.providers) {
          const p = window._OPERATOR_LIST.providers.find(x => x.id === cfg.operator.serviceProvider);
          if (p) provName = p.name;
        }
        if (provName) add('Saudi provider', provName);
      }
      add('Group leader', cfg.operator && cfg.operator.contactName);
      addPhone('Group phone', cfg.operator && cfg.operator.contactPhone);
      addPhone('24-hr line', cfg.operator && cfg.operator.emergencyPhone);

      // v2.2 — list each Madinah/Makkah hotel separately.
      // If a hotel has dates, append them in parentheses for clarity.
      const fmtHotelLine = (h) => {
        const hasDates = h.fromDate || h.toDate;
        if (!hasDates) return h.name;
        const f = h.fromDate || '?';
        const t = h.toDate || '?';
        return `${h.name} (${f} → ${t})`;
      };
      this.getHotels('madinah').filter(h => h && h.name).forEach((h, i, arr) => {
        const label = arr.length > 1 ? `Madinah hotel ${i + 1}` : 'Madinah hotel';
        add(label, fmtHotelLine(h));
      });
      this.getHotels('makkah').filter(h => h && h.name).forEach((h, i, arr) => {
        const label = arr.length > 1 ? `Makkah hotel ${i + 1}` : 'Makkah hotel';
        add(label, fmtHotelLine(h));
      });

      // v2.2 — Mina camp summary
      if (cfg.minaCamp && cfg.minaCamp.type) {
        let minaSummary = '';
        if (cfg.minaCamp.type === 'mina') {
          minaSummary = 'Mina';
          if (cfg.minaCamp.zone && cfg.minaCamp.zone !== 'unknown') {
            minaSummary += ` · Zone ${cfg.minaCamp.zone}`;
          }
          if (cfg.minaCamp.area) minaSummary += ` · ${cfg.minaCamp.area}`;
        } else if (cfg.minaCamp.type === 'aziziyah') {
          minaSummary = 'Aziziyah';
          if (cfg.minaCamp.area) minaSummary += ` · ${cfg.minaCamp.area}`;
        } else if (cfg.minaCamp.type === 'unsure') {
          minaSummary = 'Mina (camp TBC)';
        }
        if (minaSummary) add('Mina camp', minaSummary);
      }

      if ((cfg.groupContacts || []).length) {
        cfg.groupContacts.forEach((c, i) => {
          if (c.name || c.phone) {
            dl.appendChild(el('dt', null, `Contact ${i + 1}`));
            const dd = el('dd', null);
            dd.appendChild(document.createTextNode((c.name || '') + ' '));
            if (c.phone) dd.appendChild(el('a', { href: `tel:${c.phone.replace(/\s/g, '')}` }, c.phone));
            dl.appendChild(dd);
          }
        });
      }
      card.appendChild(dl);
      return card;
    },

    /**
     * v2.7 — Build the PRINT-optimised emergency card.
     * Single A4 page, large fonts, QR code for the operator emergency phone.
     * Used by Print.printEmergencyCard().
     */
    renderEmergencyCardPrintable() {
      const cfg = this.config || {};
      const op = cfg.operator || {};
      const card = el('div', { class: 'em-print' });

      // Header — pilgrim name + Hajj year
      const head = el('div', { class: 'em-print__head' });
      const hijriYear = (() => {
        try {
          const out = cfg.outboundFlight && cfg.outboundFlight.date;
          const d = out ? new Date(out) : new Date();
          const hijri = Utils.formatHijri(d) || '';
          // formatHijri returns something like "10 Dhul Qa'dah 1447" — pull the year
          const m = hijri.match(/(\d{4})/);
          return m ? m[1] : '';
        } catch (e) { return ''; }
      })();
      const titleLine = el('div', { class: 'em-print__title' }, 'Emergency Card');
      head.appendChild(titleLine);
      if (hijriYear) head.appendChild(el('div', { class: 'em-print__subtitle' }, `Hajj ${hijriYear} AH`));
      card.appendChild(head);

      // Two-column body: pilgrim info on the left, QR code on the right
      const body = el('div', { class: 'em-print__body' });
      const left = el('div', { class: 'em-print__left' });
      const right = el('div', { class: 'em-print__right' });

      // PILGRIM section
      const pilgrim = el('div', { class: 'em-print__section' });
      pilgrim.appendChild(el('div', { class: 'em-print__section-label' }, 'Pilgrim'));
      const name = (cfg.pilgrimName || '').trim() || '[Your name]';
      pilgrim.appendChild(el('div', { class: 'em-print__pilgrim-name' }, name));
      const meta = [];
      if (cfg.madhab) meta.push(cfg.madhab.charAt(0).toUpperCase() + cfg.madhab.slice(1) + ' madhab');
      if (cfg.groupSize && cfg.groupSize > 1) meta.push(`Party of ${cfg.groupSize}`);
      if (meta.length) pilgrim.appendChild(el('div', { class: 'em-print__pilgrim-meta' }, meta.join(' · ')));
      left.appendChild(pilgrim);

      // OPERATOR section
      const opSection = el('div', { class: 'em-print__section' });
      opSection.appendChild(el('div', { class: 'em-print__section-label' }, 'Hajj operator'));
      if (op.name) opSection.appendChild(el('div', { class: 'em-print__row' }, op.name));
      // Saudi service provider, if known
      let provName = '';
      if (op.serviceProvider === '__other__') {
        provName = op.serviceProviderOther || '';
      } else if (op.serviceProvider && window._OPERATOR_LIST && window._OPERATOR_LIST.providers) {
        const p = window._OPERATOR_LIST.providers.find(x => x.id === op.serviceProvider);
        if (p) provName = p.name;
      }
      if (provName) {
        opSection.appendChild(el('div', { class: 'em-print__row em-print__row--sub' }, `Saudi provider: ${provName}`));
      }
      // Group leader
      if (op.contactName || op.contactPhone) {
        const leaderRow = el('div', { class: 'em-print__row' });
        if (op.contactName) {
          leaderRow.appendChild(el('span', { class: 'em-print__row-label' }, 'Group leader: '));
          leaderRow.appendChild(document.createTextNode(op.contactName));
          if (op.contactPhone) leaderRow.appendChild(document.createTextNode(' · '));
        }
        if (op.contactPhone) leaderRow.appendChild(el('strong', null, op.contactPhone));
        opSection.appendChild(leaderRow);
      }
      // 24-hour emergency line — this is the big one
      if (op.emergencyPhone) {
        const big = el('div', { class: 'em-print__phone-big' });
        big.appendChild(el('div', { class: 'em-print__phone-big-label' }, '24-hr emergency line'));
        big.appendChild(el('div', { class: 'em-print__phone-big-number' }, op.emergencyPhone));
        opSection.appendChild(big);
      }
      left.appendChild(opSection);

      // ACCOMMODATION section
      const accom = el('div', { class: 'em-print__section' });
      accom.appendChild(el('div', { class: 'em-print__section-label' }, 'Accommodation'));
      const fmtHotel = (h) => {
        const dates = (h.fromDate || h.toDate)
          ? ` (${h.fromDate || '?'} → ${h.toDate || '?'})` : '';
        return h.name + dates;
      };
      const madinahHotels = this.getHotels('madinah').filter(h => h && h.name);
      const makkahHotels  = this.getHotels('makkah').filter(h => h && h.name);
      if (madinahHotels.length) {
        madinahHotels.forEach((h, i, arr) => {
          const lab = arr.length > 1 ? `Madinah ${i + 1}: ` : 'Madinah: ';
          const r = el('div', { class: 'em-print__row' });
          r.appendChild(el('span', { class: 'em-print__row-label' }, lab));
          r.appendChild(document.createTextNode(fmtHotel(h)));
          accom.appendChild(r);
        });
      }
      if (makkahHotels.length) {
        makkahHotels.forEach((h, i, arr) => {
          const lab = arr.length > 1 ? `Makkah ${i + 1}: ` : 'Makkah: ';
          const r = el('div', { class: 'em-print__row' });
          r.appendChild(el('span', { class: 'em-print__row-label' }, lab));
          r.appendChild(document.createTextNode(fmtHotel(h)));
          accom.appendChild(r);
        });
      }
      // Mina camp
      if (cfg.minaCamp && cfg.minaCamp.type) {
        let m = '';
        if (cfg.minaCamp.type === 'mina') {
          m = 'Mina';
          if (cfg.minaCamp.zone && cfg.minaCamp.zone !== 'unknown') m += ` · Zone ${cfg.minaCamp.zone}`;
          if (cfg.minaCamp.area) m += ` · ${cfg.minaCamp.area}`;
        } else if (cfg.minaCamp.type === 'aziziyah') {
          m = 'Aziziyah';
          if (cfg.minaCamp.area) m += ` · ${cfg.minaCamp.area}`;
        } else if (cfg.minaCamp.type === 'unsure') {
          m = 'Mina (TBC)';
        }
        if (m) {
          const r = el('div', { class: 'em-print__row' });
          r.appendChild(el('span', { class: 'em-print__row-label' }, 'Hajj days: '));
          r.appendChild(document.createTextNode(m));
          accom.appendChild(r);
        }
      }
      left.appendChild(accom);

      // SAUDI EMERGENCY NUMBERS — always shown, public info, anyone can call
      const saudi = el('div', { class: 'em-print__section em-print__section--saudi' });
      saudi.appendChild(el('div', { class: 'em-print__section-label' }, 'Saudi Arabia emergency numbers'));
      const grid = el('div', { class: 'em-print__saudi-grid' });
      [
        { num: '911', label: 'All emergencies (unified)' },
        { num: '997', label: 'Red Crescent (ambulance)' },
        { num: '999', label: 'Police' },
        { num: '998', label: 'Civil defence (fire)' },
        { num: '930', label: 'Tourist help line' },
      ].forEach(item => {
        const cell = el('div', { class: 'em-print__saudi-cell' });
        cell.appendChild(el('div', { class: 'em-print__saudi-num' }, item.num));
        cell.appendChild(el('div', { class: 'em-print__saudi-label' }, item.label));
        grid.appendChild(cell);
      });
      saudi.appendChild(grid);
      left.appendChild(saudi);

      // GROUP CONTACTS — if present
      if ((cfg.groupContacts || []).filter(c => c && (c.name || c.phone)).length) {
        const contacts = el('div', { class: 'em-print__section' });
        contacts.appendChild(el('div', { class: 'em-print__section-label' }, 'Travel companions'));
        cfg.groupContacts.forEach(c => {
          if (!c || (!c.name && !c.phone)) return;
          const r = el('div', { class: 'em-print__row' });
          if (c.name) r.appendChild(document.createTextNode(c.name));
          if (c.phone) {
            r.appendChild(document.createTextNode(' · '));
            r.appendChild(el('strong', null, c.phone));
          }
          contacts.appendChild(r);
        });
        left.appendChild(contacts);
      }

      // RIGHT COLUMN — QR code
      if (op.emergencyPhone && window.QRCode) {
        const qrSection = el('div', { class: 'em-print__qr' });
        const telUrl = 'tel:' + String(op.emergencyPhone).replace(/\s/g, '');
        try {
          const qr = new QRCode({
            content: telUrl,
            container: 'svg-viewbox',
            join: true,
            padding: 1,
            width: 220,
            height: 220,
            ecl: 'M',
            xmlDeclaration: false,
            pretty: false,
          });
          // Output a string — inject as innerHTML so the SVG renders
          const svgString = qr.svg();
          const wrap = el('div', { class: 'em-print__qr-img' });
          wrap.innerHTML = svgString;
          qrSection.appendChild(wrap);
          qrSection.appendChild(el('div', { class: 'em-print__qr-caption' }, 'Scan to call the 24-hr line'));
          qrSection.appendChild(el('div', { class: 'em-print__qr-tel' }, op.emergencyPhone));
        } catch (e) {
          console.warn('QR generation failed:', e);
          // Fallback: skip QR but show the number prominently
          qrSection.appendChild(el('div', { class: 'em-print__qr-caption' }, 'Emergency number'));
          qrSection.appendChild(el('div', { class: 'em-print__qr-tel' }, op.emergencyPhone));
        }
        right.appendChild(qrSection);
      }

      // Footer reminder
      const foot = el('div', { class: 'em-print__foot' });
      foot.appendChild(el('div', null, 'Keep this card with you at all times. Show to authorities if separated from your group.'));
      foot.appendChild(el('div', { class: 'em-print__foot-small' },
        'Saudi emergency numbers are publicly known and may be called from any phone, free of charge.'
      ));

      body.appendChild(left);
      body.appendChild(right);
      card.appendChild(body);
      card.appendChild(foot);

      return card;
    },

    /**
     * v2.9 — Build the PRINT-optimised full itinerary.
     * Single document covering every day of the trip, with the user's stops,
     * actions, notes. Designed for A4 portrait printing as a take-along document.
     *
     * What's included per day:
     *  - Date header (Gregorian + Hijri)
     *  - Title and location
     *  - Description
     *  - "What to do" actions list
     *  - Custom stops (Ziyarat etc.) with times
     *  - Day note callout (if any)
     *  - Dua titles (compact list — full duas would balloon page count)
     *
     * What's NOT included:
     *  - Reflection textareas (personal/empty at print time)
     *  - Journey map (decorative)
     *  - Phase pills (UI controls)
     *  - Edit/delete affordances
     *
     * Used by Print.printFullItinerary().
     */
    renderItineraryPrintable() {
      const cfg = this.config || {};
      const root = el('div', { class: 'it-print' });

      // ── Header ────────────────────────────────────────────
      const head = el('div', { class: 'it-print__head' });
      head.appendChild(el('div', { class: 'it-print__title' }, 'Hajj Itinerary'));
      const subParts = [];
      const name = (cfg.pilgrimName || '').trim();
      if (name) subParts.push(name);
      if (cfg.outboundFlight && cfg.outboundFlight.date) {
        const out = new Date(cfg.outboundFlight.date);
        const hijri = Utils.formatHijri(out) || '';
        const m = hijri.match(/(\d{4})/);
        if (m) subParts.push(`Hajj ${m[1]} AH`);
      }
      if (cfg.madhab) {
        subParts.push(cfg.madhab.charAt(0).toUpperCase() + cfg.madhab.slice(1) + ' madhab');
      }
      if (subParts.length) {
        head.appendChild(el('div', { class: 'it-print__subtitle' }, subParts.join(' · ')));
      }

      // Date range line
      if (cfg.outboundFlight && cfg.outboundFlight.date && cfg.returnFlight && cfg.returnFlight.date) {
        const fromStr = formatDate(cfg.outboundFlight.date, { day: 'numeric', month: 'short', year: 'numeric' });
        const toStr   = formatDate(cfg.returnFlight.date,   { day: 'numeric', month: 'short', year: 'numeric' });
        head.appendChild(el('div', { class: 'it-print__range' }, `${fromStr} → ${toStr}`));
      }
      root.appendChild(head);

      // ── Trip summary strip (compact) ──────────────────────
      const summary = el('div', { class: 'it-print__summary' });
      const summaryRows = [];
      if (cfg.operator && cfg.operator.name) {
        summaryRows.push(['Operator', cfg.operator.name]);
      }
      if (cfg.operator && cfg.operator.contactPhone) {
        summaryRows.push(['Group leader', `${cfg.operator.contactName || ''} · ${cfg.operator.contactPhone}`.trim().replace(/^· /, '')]);
      }
      if (cfg.operator && cfg.operator.emergencyPhone) {
        summaryRows.push(['24-hr line', cfg.operator.emergencyPhone]);
      }
      const madinahHotels = this.getHotels('madinah').filter(h => h && h.name);
      const makkahHotels  = this.getHotels('makkah').filter(h => h && h.name);
      if (madinahHotels.length) summaryRows.push(['Madinah', madinahHotels.map(h => h.name).join(' · ')]);
      if (makkahHotels.length)  summaryRows.push(['Makkah',  makkahHotels.map(h => h.name).join(' · ')]);
      if (summaryRows.length) {
        const grid = el('div', { class: 'it-print__summary-grid' });
        summaryRows.forEach(([k, v]) => {
          const row = el('div', { class: 'it-print__summary-row' });
          row.appendChild(el('span', { class: 'it-print__summary-key' }, k));
          row.appendChild(el('span', { class: 'it-print__summary-val' }, v));
          grid.appendChild(row);
        });
        summary.appendChild(grid);
        root.appendChild(summary);
      }

      // ── Day-by-day ────────────────────────────────────────
      const days = this.buildItineraryDays();
      const list = el('div', { class: 'it-print__days' });

      days.forEach((day, idx) => {
        const block = el('section', { class: 'it-print__day' });

        // Day header line
        const dayHead = el('div', { class: 'it-print__day-head' });
        const dateLine = el('div', { class: 'it-print__day-date' });
        dateLine.appendChild(el('span', { class: 'it-print__day-date-num' }, `Day ${idx + 1}`));
        if (day.date) {
          const greg = formatDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' });
          dateLine.appendChild(el('span', { class: 'it-print__day-date-greg' }, ' · ' + greg));
          const hijri = Utils.formatHijri(day.date);
          if (hijri) dateLine.appendChild(el('span', { class: 'it-print__day-date-hijri' }, ' · ' + hijri));
        }
        dayHead.appendChild(dateLine);
        if (day.location) {
          dayHead.appendChild(el('span', { class: 'it-print__day-location' }, day.location));
        }
        block.appendChild(dayHead);

        // Title
        block.appendChild(el('h2', { class: 'it-print__day-title' }, day.title || ''));

        // Description
        if (day.description) {
          block.appendChild(el('p', { class: 'it-print__day-desc' }, day.description));
        }

        // What to do (actions)
        if (day.actions && day.actions.length) {
          const actionsWrap = el('div', { class: 'it-print__day-section' });
          actionsWrap.appendChild(el('div', { class: 'it-print__day-section-label' }, 'What to do'));
          const ul = el('ul', { class: 'it-print__day-actions' });
          day.actions.forEach(a => ul.appendChild(el('li', null, a)));
          actionsWrap.appendChild(ul);
          block.appendChild(actionsWrap);
        }

        // Custom stops — only if this day has a real date
        if (day.date && window.Stops) {
          const dateIso = day.date.toISOString().slice(0, 10);
          const stops = Stops.forDate(dateIso);
          if (stops.length) {
            const stopsWrap = el('div', { class: 'it-print__day-section it-print__day-section--stops' });
            stopsWrap.appendChild(el('div', { class: 'it-print__day-section-label' }, 'Your stops'));
            const stopList = el('ul', { class: 'it-print__day-stops' });
            stops.forEach(s => {
              const li = el('li', { class: 'it-print__day-stop' });
              const time = Stops.formatTimeRange(s);
              // Always render the time slot for column alignment, even when empty.
              // Use a non-breaking space to preserve width when no time is set.
              li.appendChild(el('span', { class: 'it-print__day-stop-time' }, time || '\u00A0'));
              li.appendChild(el('span', { class: 'it-print__day-stop-place' }, s.place));
              stopList.appendChild(li);
            });
            stopsWrap.appendChild(stopList);
            block.appendChild(stopsWrap);
          }
        }

        // Note (if any)
        if (day.note) {
          const noteWrap = el('div', { class: 'it-print__day-note' });
          noteWrap.appendChild(el('span', { class: 'it-print__day-note-label' }, 'Note: '));
          noteWrap.appendChild(document.createTextNode(day.note));
          block.appendChild(noteWrap);
        }

        // Dua titles (compact — just titles, not full text)
        if (day.duaIds && day.duaIds.length && this.data && this.data.duas) {
          const titles = day.duaIds
            .map(id => (this.data.duas.find(d => d.id === id) || {}).title)
            .filter(Boolean);
          if (titles.length) {
            const duaWrap = el('div', { class: 'it-print__day-duas' });
            duaWrap.appendChild(el('span', { class: 'it-print__day-duas-label' }, 'Duas: '));
            duaWrap.appendChild(document.createTextNode(titles.join(' · ')));
            block.appendChild(duaWrap);
          }
        }

        list.appendChild(block);
      });

      root.appendChild(list);

      // ── Footer ────────────────────────────────────────────
      const foot = el('div', { class: 'it-print__foot' });
      const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      foot.appendChild(el('div', null, `Printed on ${today}. Confirm rulings with a qualified scholar of your madhab.`));
      foot.appendChild(el('div', { class: 'it-print__foot-small' }, 'hajjguide.net — a free planning aid'));
      root.appendChild(foot);

      return root;
    },

    renderDuaCard(dua) {
      const card = el('div', { class: 'dua-card' });
      const head = el('div', { class: 'dua-card__header' });
      head.appendChild(el('h3', { class: 'dua-card__title' }, dua.title));
      card.appendChild(head);

      if (dua.context) {
        card.appendChild(el('p', { class: 'dua-card__context' }, dua.context));
      }
      if (dua.arabic) {
        card.appendChild(el('div', { class: 'arabic dua-card__arabic' }, dua.arabic));
      }
      if (dua.transliteration && dua.transliteration !== '—') {
        card.appendChild(el('p', { class: 'transliteration' }, dua.transliteration));
      }
      if (dua.translation) {
        card.appendChild(el('p', { class: 'translation' }, dua.translation));
      }
      if (dua.source) {
        card.appendChild(el('p', { class: 'dua-card__source text-mute', style: { fontSize: 'var(--fs-xs)', fontStyle: 'italic', marginTop: '8px' } },
          'Source: ' + dua.source
        ));
      }

      return card;
    },

    /* ─── Day card builder for Itinerary ───────────────── */

    renderDayCard(day, idx) {
      const card = el('div', { class: 'day-card' });
      const head = el('button', {
        class: 'day-card__header',
        type: 'button',
        'aria-expanded': 'false',
      });

      // Date column: Gregorian primary + Hijri secondary
      const dateCol = el('span', { class: 'day-card__date-col' });
      dateCol.appendChild(el('span', { class: 'day-card__date' }, day.dateLabel || `Day ${idx + 1}`));
      // Add Hijri sub-label when we have a real Date
      if (day.date) {
        const hijri = Utils.formatHijri(day.date);
        if (hijri) {
          dateCol.appendChild(el('span', { class: 'day-card__date-hijri' }, hijri));
        }
      }
      head.appendChild(dateCol);

      head.appendChild(el('span', { class: 'day-card__title' }, day.title));
      head.appendChild(el('span', { class: 'day-card__location' }, day.location || ''));
      head.appendChild(el('span', { class: 'day-card__chevron' }, '⌄'));
      card.appendChild(head);

      const body = el('div', { class: 'day-card__body' });
      const inner = el('div', { class: 'day-card__inner' });

      if (day.description) {
        inner.appendChild(el('p', null, day.description));
      }
      if (day.actions && day.actions.length) {
        inner.appendChild(el('h4', { class: 'eyebrow' }, 'What to do'));
        const ul = el('ul', { style: { paddingLeft: '20px', lineHeight: '1.7' } });
        day.actions.forEach(a => ul.appendChild(el('li', null, a)));
        inner.appendChild(ul);
      }
      if (day.duaIds && day.duaIds.length) {
        inner.appendChild(el('h4', { class: 'eyebrow' }, 'Duas for today'));
        day.duaIds.forEach(id => {
          const dua = this.data.duas.find(d => d.id === id);
          if (dua) inner.appendChild(this.renderDuaCard(dua));
        });
      }
      if (day.note) {
        inner.appendChild(el('div', { class: 'callout callout--info' },
          el('p', { style: { margin: 0 } }, day.note)
        ));
      }

      // v2.8 — Custom stops (Ziyarat etc.) Inserted between the day's
      // built-in content and the Reflection textarea. Only shown for
      // real-date days (skip generic 5-Days-of-Hajj reference cards).
      if (day.date && window.Stops) {
        const dateIso = day.date.toISOString().slice(0, 10);
        inner.appendChild(this.renderStopsSection(dateIso));
      }

      // v2.7 — Reflection / journal section. Only shown when this is a real-date
      // day (skip the generic 5-Days-of-Hajj reference cards). One textarea per
      // day, auto-saves to Journal as the user types.
      if (day.date && window.Journal) {
        const dateIso = day.date.toISOString().slice(0, 10);
        const existing = Journal.get(dateIso);

        const reflWrap = el('div', { class: 'day-card__reflection' });
        const reflHead = el('div', { class: 'day-card__reflection-head' });
        reflHead.appendChild(el('h4', { class: 'eyebrow', style: { margin: 0 } }, 'Reflection'));
        const status = el('span', { class: 'day-card__reflection-status' }, '');
        reflHead.appendChild(status);
        reflWrap.appendChild(reflHead);

        const ta = el('textarea', {
          class: 'day-card__reflection-textarea',
          placeholder: 'What stayed with you today? Notes, duas accepted, lessons, gratitude…',
          rows: 4,
        });
        ta.value = (existing && existing.text) || '';

        const showSaved = () => {
          status.textContent = '✓ Saved';
          status.classList.add('is-visible');
          clearTimeout(status._t);
          status._t = setTimeout(() => status.classList.remove('is-visible'), 1400);
        };

        ta.addEventListener('input', () => {
          Journal.set(dateIso, ta.value, showSaved);
        });
        ta.addEventListener('blur', () => {
          // Force-flush on blur so the user always sees their writing persisted
          Journal.flush();
          showSaved();
        });

        reflWrap.appendChild(ta);
        inner.appendChild(reflWrap);
      }

      body.appendChild(inner);
      card.appendChild(body);

      head.addEventListener('click', () => {
        card.classList.toggle('is-open');
        head.setAttribute('aria-expanded', card.classList.contains('is-open') ? 'true' : 'false');
      });

      return card;
    },

    /**
     * v2.8 — Render the stops section for a given date (used inside day cards).
     *
     * Lists existing stops with edit/delete controls, plus a "+ Add a stop"
     * affordance that expands to an inline form (combobox + time inputs).
     *
     * The combobox uses the curated places list (data/ziyarat-places.json) but
     * also accepts free-text input. Saving uses Stops.add(); editing uses
     * Stops.update(); deleting uses Stops.remove().
     *
     * The whole section re-renders itself in place when the user makes a change,
     * so the parent day-card body never needs to know about state shifts.
     */
    renderStopsSection(dateIso) {
      const wrap = el('div', { class: 'day-card__stops' });
      const head = el('div', { class: 'day-card__stops-head' });
      head.appendChild(el('h4', { class: 'eyebrow', style: { margin: 0 } }, 'Your stops'));
      wrap.appendChild(head);

      const listHost = el('div', { class: 'day-card__stops-list' });
      wrap.appendChild(listHost);

      const formHost = el('div', { class: 'day-card__stops-form-host' });
      wrap.appendChild(formHost);

      // Re-render only the list + form, leaving the header alone
      const refresh = () => {
        listHost.innerHTML = '';
        const stops = Stops.forDate(dateIso);
        if (!stops.length) {
          listHost.appendChild(el('p', { class: 'day-card__stops-empty text-mute italic' },
            'No stops added for this day yet. Add Ziyarat visits, group activities, or anything else you want to remember.'
          ));
        } else {
          stops.forEach(stop => listHost.appendChild(this._renderStopRow(dateIso, stop, refresh)));
        }
        // Reset form area to the "+ Add a stop" button
        formHost.innerHTML = '';
        formHost.appendChild(this._renderAddStopAffordance(dateIso, formHost, refresh));
      };

      refresh();
      return wrap;
    },

    /**
     * v2.8 — Render a single stop as a read-only row with edit/delete buttons.
     * Clicking edit swaps it inline for a form.
     */
    _renderStopRow(dateIso, stop, refresh) {
      const row = el('div', { class: 'day-card__stop' });
      const main = el('div', { class: 'day-card__stop-main' });

      // Time chip on the left, if any
      const timeStr = Stops.formatTimeRange(stop);
      if (timeStr) {
        main.appendChild(el('span', { class: 'day-card__stop-time' }, timeStr));
      } else {
        // Placeholder dot to keep alignment consistent
        main.appendChild(el('span', { class: 'day-card__stop-time day-card__stop-time--empty' }, '·'));
      }

      const placeBlock = el('div', { class: 'day-card__stop-place' });
      placeBlock.appendChild(el('span', { class: 'day-card__stop-name' }, stop.place));
      // Show the curated description when picked from list
      if (stop.placeId && Stops.placesNow().length) {
        const known = Stops.placesNow().find(p => p.id === stop.placeId);
        if (known && known.description) {
          placeBlock.appendChild(el('span', { class: 'day-card__stop-desc' }, known.description));
        }
      }
      main.appendChild(placeBlock);
      row.appendChild(main);

      // Actions
      const actions = el('div', { class: 'day-card__stop-actions' });
      const editBtn = el('button', {
        type: 'button',
        class: 'day-card__stop-action',
        title: 'Edit stop',
        'aria-label': 'Edit stop',
      }, 'Edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Replace this row in place with a form
        const form = this._renderStopForm(dateIso, stop, refresh);
        row.replaceWith(form);
        // Focus the place field
        const inp = form.querySelector('.day-card__stop-place-input');
        if (inp) inp.focus();
      });
      actions.appendChild(editBtn);

      const delBtn = el('button', {
        type: 'button',
        class: 'day-card__stop-action day-card__stop-action--danger',
        title: 'Remove stop',
        'aria-label': 'Remove stop',
      }, 'Remove');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        Stops.remove(dateIso, stop.id);
        refresh();
      });
      actions.appendChild(delBtn);
      row.appendChild(actions);

      return row;
    },

    /**
     * v2.8 — The "+ Add a stop" button that expands to a form.
     * Returns a single element which is either the button (collapsed) or the
     * form (when expanded). Caller manages the host container.
     */
    _renderAddStopAffordance(dateIso, formHost, refresh) {
      const btn = el('button', {
        type: 'button',
        class: 'day-card__stops-add',
      }, '+ Add a stop');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        formHost.innerHTML = '';
        formHost.appendChild(this._renderStopForm(dateIso, null, refresh));
        const inp = formHost.querySelector('.day-card__stop-place-input');
        if (inp) inp.focus();
      });
      return btn;
    },

    /**
     * v2.8 — The inline edit/add form. If `existing` is provided, it's an edit;
     * otherwise it's a new-stop form. On save: persist + call refresh(). On
     * cancel: refresh() to restore the row or the "+ Add a stop" button.
     */
    _renderStopForm(dateIso, existing, refresh) {
      const form = el('div', { class: 'day-card__stop-form' });

      // Place input — combobox-style with a datalist for suggestions
      // datalist is HTML5 native, supports both picker AND free-text typing.
      const placeRow = el('div', { class: 'day-card__stop-form-row' });
      placeRow.appendChild(el('label', { class: 'day-card__stop-form-label' }, 'Place'));

      const datalistId = 'stops-places-' + Math.random().toString(36).slice(2, 8);
      const dl = el('datalist', { id: datalistId });

      // Group options by city for clarity. <datalist> doesn't support optgroups
      // but we can prefix the displayed values, which Chrome shows nicely.
      const placesByCity = (city) => Stops.placesNow().filter(p => p.city === city);
      const cityLabels = { madinah: 'Madinah', makkah: 'Makkah', other: 'Other' };
      ['madinah', 'makkah', 'other'].forEach(city => {
        placesByCity(city).forEach(p => {
          const opt = el('option', { value: p.name });
          opt.setAttribute('data-place-id', p.id);
          opt.setAttribute('data-city', city);
          // Show city as the displayed hint to disambiguate
          opt.setAttribute('label', cityLabels[city] || '');
          dl.appendChild(opt);
        });
      });

      const placeInput = el('input', {
        type: 'text',
        class: 'field__input day-card__stop-place-input',
        placeholder: 'Type or pick from list (e.g. Quba Mosque)',
        list: datalistId,
        autocomplete: 'off',
      });
      if (existing) placeInput.value = existing.place || '';
      placeRow.appendChild(placeInput);
      placeRow.appendChild(dl);
      form.appendChild(placeRow);

      // Times row
      const timesRow = el('div', { class: 'day-card__stop-form-times' });
      const startWrap = el('div', { class: 'day-card__stop-form-row' });
      startWrap.appendChild(el('label', { class: 'day-card__stop-form-label' }, 'Start (optional)'));
      const startInput = el('input', { type: 'time', class: 'field__input' });
      if (existing) startInput.value = existing.startTime || '';
      startWrap.appendChild(startInput);
      timesRow.appendChild(startWrap);

      const endWrap = el('div', { class: 'day-card__stop-form-row' });
      endWrap.appendChild(el('label', { class: 'day-card__stop-form-label' }, 'End (optional)'));
      const endInput = el('input', { type: 'time', class: 'field__input' });
      if (existing) endInput.value = existing.endTime || '';
      endWrap.appendChild(endInput);
      timesRow.appendChild(endWrap);
      form.appendChild(timesRow);

      // Buttons
      const btns = el('div', { class: 'day-card__stop-form-actions' });
      const saveBtn = el('button', {
        type: 'button',
        class: 'btn btn--primary day-card__stop-form-save',
      }, existing ? 'Save' : 'Add stop');
      const cancelBtn = el('button', {
        type: 'button',
        class: 'btn btn--ghost day-card__stop-form-cancel',
      }, 'Cancel');
      btns.appendChild(saveBtn);
      btns.appendChild(cancelBtn);
      form.appendChild(btns);

      // Validation status line (hidden until needed)
      const status = el('div', { class: 'day-card__stop-form-status' }, '');
      form.appendChild(status);

      // Resolve placeId from typed/picked place name
      const resolvePlaceId = (typedName) => {
        const t = (typedName || '').trim().toLowerCase();
        if (!t) return null;
        const match = Stops.placesNow().find(p => p.name.toLowerCase() === t);
        return match ? match.id : null;
      };

      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        refresh();
      });

      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const place = placeInput.value.trim();
        if (!place) {
          status.textContent = 'Please enter or pick a place.';
          status.classList.add('is-visible');
          placeInput.focus();
          return;
        }
        const start = startInput.value;
        const end = endInput.value;
        if (start && end && end < start) {
          status.textContent = 'End time is before start time. Adjust or leave one blank.';
          status.classList.add('is-visible');
          return;
        }
        const placeId = resolvePlaceId(place);
        if (existing) {
          Stops.update(dateIso, existing.id, { place, placeId, startTime: start, endTime: end });
        } else {
          Stops.add(dateIso, { place, placeId, startTime: start, endTime: end });
        }
        refresh();
      });

      // Pressing Enter in the place input submits
      placeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveBtn.click();
        }
      });

      return form;
    },

    /* ─── Build days list from user config ─────────────── */

    /**
     * v3.3 — Build the full day-by-day itinerary list.
     *
     * The major change in v3.3 is that this function is now driven by the
     * user's HOTEL DATES, not their flight dates. Previously, the
     * Madinah/Makkah split was a hardcoded heuristic ("first 3 days are
     * Madinah unless trip is short"). Now:
     *
     *  - Each day in the trip is checked against the user's actual hotel
     *    bookings to determine "In Madinah" vs "In Makkah" labelling.
     *  - The 5 Hajj days (8-12 Dhul Hijjah) are anchored to actual Hijri
     *    dates using Utils.toHijri(), regardless of where they fall in
     *    the trip. This was previously also flight-offset which misaligned
     *    when flight dates didn't match the Hajj period.
     *  - When hotels lack dates, we fall back to a sensible default split
     *    so the page never shows nothing.
     *
     * Returns an array of day objects with shape:
     *   { date, dateLabel, title, location, description, duaIds, actions, note }
     */
    buildItineraryDays() {
      const cfg = this.config || {};
      const out = cfg.outboundFlight;
      const ret = cfg.returnFlight;

      const startDate = out && out.date ? new Date(out.date) : null;
      const endDate   = ret && ret.date ? new Date(ret.date) : null;
      const hasFlights = !!(startDate && endDate);

      // ── Helpers ──────────────────────────────────────────────
      const isoOf = (d) => (d instanceof Date)
        ? d.toISOString().slice(0, 10)
        : (d ? String(d).slice(0, 10) : '');

      const sameIso = (a, b) => a && b && isoOf(a) === isoOf(b);

      // Returns true if `iso` falls within any hotel of `city` whose dates
      // are populated. Hotels with missing dates are skipped (they don't
      // claim any specific day; they're just notional accommodation).
      const inHotelRange = (city, iso) => {
        if (!iso) return false;
        const list = this.getHotels(city);
        for (const h of list) {
          if (!h || !h.fromDate || !h.toDate) continue;
          if (iso >= h.fromDate && iso <= h.toDate) return true;
        }
        return false;
      };

      // Are any hotels for this city configured with a `name`?
      const hasNamedHotels = (city) =>
        this.getHotels(city).some(h => h && h.name);

      // Are any hotels for this city configured with both fromDate AND toDate?
      const hasDatedHotels = (city) =>
        this.getHotels(city).some(h => h && h.fromDate && h.toDate);

      const madinahDated = hasDatedHotels('madinah');
      const makkahDated  = hasDatedHotels('makkah');

      // Earliest/latest dates across all hotels for each city. Used to detect
      // travel-day boundaries and to fall back when a date is "near" but not
      // strictly within a hotel range.
      const hotelExtremes = (city) => {
        const list = this.getHotels(city)
          .filter(h => h && h.fromDate && h.toDate);
        if (!list.length) return null;
        const froms = list.map(h => h.fromDate).sort();
        const tos   = list.map(h => h.toDate).sort();
        return { earliest: froms[0], latest: tos[tos.length - 1] };
      };

      const madinahRange = hotelExtremes('madinah');
      const makkahRange  = hotelExtremes('makkah');

      // Hajj phase data — Hajj days have stable templates regardless of
      // where they fall in the trip.
      const hajjData = (this.data && this.data.itinerary &&
                       this.data.itinerary.phases.find(p => p.id === 'hajj-days')) || null;
      const hajjDayList = hajjData ? hajjData.days : [];

      // Try to detect "is `date` 8/9/10/11/12 Dhul Hijjah?"
      // Returns the index 0-4 of the matching Hajj day, or -1.
      const hajjIndexFor = (date) => {
        if (!date || !Utils.toHijri) return -1;
        const h = Utils.toHijri(date);
        if (!h || !/Hijjah/i.test(h.month)) return -1;
        if (h.day >= 8 && h.day <= 12) return h.day - 8;
        return -1;
      };

      // ── Fallback: no flights at all ──────────────────────────
      // Show a generic 14-day reference itinerary so the user sees what
      // the app can do. Madinah and Makkah days use the (possibly named)
      // hotel for context; if no hotels, just say "Madinah" / "Makkah".
      if (!hasFlights) {
        return this._buildDefaultItinerary();
      }

      // ── Walk the trip day by day ─────────────────────────────
      const days = [];
      const totalDays = Math.max(1, daysBetween(startDate, endDate) + 1);

      // Counters for "Day N" labelling within a phase
      let madinahCounter = 0;
      let makkahCounter  = 0;
      let postHajjCounter = 0;

      // Did we already insert a "Travel to Makkah · Umrah" card?
      let umrahInserted = false;

      // Detect the day immediately AFTER the last Madinah hotel range
      // (or the day Makkah starts, or the overlap day if both happen on the
      // same date — i.e. the user's last Madinah night IS their first Makkah
      // night). That's the natural slot for the Travel-to-Makkah / Umrah day.
      const travelDayIso = (() => {
        // Case 1: Madinah-end and Makkah-start are the same day → that IS the travel day
        if (madinahRange && makkahRange &&
            madinahRange.latest === makkahRange.earliest) {
          return madinahRange.latest;
        }
        // Case 2: Distinct end and start with a gap → use Makkah-start
        // (user spends the gap day(s) travelling)
        if (makkahRange && makkahRange.earliest) {
          return makkahRange.earliest;
        }
        // Case 3: Madinah only (no Makkah) → day after Madinah ends
        if (madinahRange && madinahRange.latest) {
          const after = addDays(new Date(madinahRange.latest), 1);
          return isoOf(after);
        }
        return null;
      })();

      for (let i = 0; i < totalDays; i++) {
        const d = addDays(startDate, i);
        const iso = isoOf(d);
        const dateLabel = formatDate(d);

        // 1) Departure day (flight day) ──────────────────────────
        if (sameIso(d, startDate)) {
          const outByRoad = !!(out && out.byRoad);
          days.push({
            date: d,
            dateLabel,
            title: outByRoad ? 'Departure (by road)' : 'Departure',
            location: outByRoad
              ? 'Land crossing → KSA'
              : `${out.from || 'Home'} → ${out.to || 'MED/JED'}`,
            description: outByRoad
              ? 'Travelling overland into Saudi Arabia. Take ghusl before leaving home, recite the dua for leaving home and the traveller\'s dua. Be ready to enter Ihram if your route bypasses a designated miqat — confirm with your group leader.'
              : `Flight ${out.number || ''} departs at ${out.time || '—'}. Take ghusl before leaving home, recite the dua for leaving home and the traveller\'s dua. Begin the journey calmly.`,
            duaIds: ['leaving-home', 'travelers-dua', 'boarding-transport'],
            note: 'For Tamattu\' pilgrims, you do NOT need to be in Ihram on this leg if heading directly to Madinah. Ihram is donned later.',
          });
          continue;
        }

        // 2) Return day (flight day) ─────────────────────────────
        if (sameIso(d, endDate)) {
          const retByRoad = !!(ret && ret.byRoad);
          days.push({
            date: d,
            dateLabel,
            title: retByRoad ? 'Return Home (by road)' : 'Return Home',
            location: retByRoad
              ? 'Land crossing → home'
              : `${ret.from || 'JED'} → ${ret.to || 'Home'}`,
            description: retByRoad
              ? 'Travelling home overland. Recite the returning dua as you approach home.'
              : `Flight ${ret.number || ''} departs at ${ret.time || '—'}. Recite the returning dua as you approach home.`,
            duaIds: ['returning-home', 'travelers-dua'],
          });
          continue;
        }

        // 3) Day before return → Tawaf al-Wada ───────────────────
        if (sameIso(d, addDays(endDate, -1))) {
          days.push({
            date: d,
            dateLabel,
            title: 'Tawaf al-Wada',
            location: 'Masjid al-Haram',
            description: 'The Farewell Tawaf — the final ritual before leaving Makkah. Perform it as close to your departure as possible. After it, no extended stay or shopping should occur.',
            duaIds: ['multazam'],
            note: 'Wajib in Hanafi/Shafi\'i/Hanbali; sunnah in Maliki. Menstruating women are exempt.',
          });
          continue;
        }

        // 4) Hajj days (anchored to Hijri 8-12 Dhul Hijjah) ──────
        const hi = hajjIndexFor(d);
        if (hi >= 0 && hajjDayList[hi]) {
          const hd = hajjDayList[hi];
          const duaIds = [];
          if (hi === 0) duaIds.push('niyyah-hajj', 'talbiyah');
          if (hi === 1) duaIds.push('best-dua-arafah', 'arafah-comprehensive', 'mashar-al-haram');
          if (hi === 2) duaIds.push('rami-takbir');
          if (hi === 3 || hi === 4) duaIds.push('after-jamarah-sughra-wusta', 'rami-takbir');
          days.push({
            date: d,
            dateLabel,
            title: hd.hijri + ' · ' + hd.name,
            location: hd.location,
            description: hd.summary,
            duaIds,
          });
          continue;
        }

        // 5) Travel-to-Makkah / Umrah day ────────────────────────
        // The boundary day right after Madinah ends. Skip if we'd
        // already classify this as a Hajj day (handled above) or if
        // the user has no hotels at all (then we let the simple
        // logic below handle it).
        if (travelDayIso && iso === travelDayIso && !umrahInserted) {
          umrahInserted = true;
          days.push({
            date: d,
            dateLabel,
            title: 'Travel to Makkah · Umrah',
            location: 'Madinah → Dhul Hulayfah → Makkah',
            description: 'Stop at Dhul Hulayfah (Bir Ali) — the miqat — to enter Ihram. Make niyyah for Umrah, pray two rakahs of Ihram, begin Talbiyah. On reaching Makkah, perform Tawaf, Sa\'i and shorten/shave to release from Ihram.',
            duaIds: ['niyyah-umrah', 'talbiyah', 'first-sight-kabah', 'tawaf-start', 'rabbana-atina', 'maqam-ibrahim', 'zamzam', 'safa-marwah-verse', 'safa-marwah-summit'],
            note: 'After Umrah, you are out of Ihram until the 8th of Dhul Hijjah. Use this time to rest, perform additional voluntary Tawaf, and prepare for the 5 days.',
          });
          continue;
        }

        // 6) In Madinah ──────────────────────────────────────────
        if (madinahDated && inHotelRange('madinah', iso)) {
          madinahCounter++;
          const isFirstMadinahDay = madinahCounter === 1;
          days.push({
            date: d,
            dateLabel,
            title: isFirstMadinahDay ? 'Arrive in Madinah' : `In Madinah · Day ${madinahCounter}`,
            location: this.hotelNameForDate('madinah', d, 'Madinah'),
            description: isFirstMadinahDay
              ? 'Settle into your accommodation. Aim for the next prayer at Masjid an-Nabawi if time and energy allow. Visit the Rawdah and offer salaams at the Prophet\'s grave.'
              : 'Pray five daily prayers at Masjid an-Nabawi if possible. Each prayer there equals 1,000 elsewhere. Visit Masjid Quba (Saturday morning is sunnah).',
            duaIds: isFirstMadinahDay ? ['first-sight-kabah'] : [],
            actions: isFirstMadinahDay ? [
              'Check in and rest if exhausted from travel.',
              'Make ghusl or wudu before going to the mosque.',
              'Enter Masjid an-Nabawi with right foot, recite the dua for entering a mosque.',
              'Greet the Prophet ﷺ at the Rawdah (currently requires Nusuk app booking).',
            ] : null,
          });
          continue;
        }

        // 7) In Makkah ───────────────────────────────────────────
        if (makkahDated && inHotelRange('makkah', iso)) {
          makkahCounter++;
          // Decide if it's pre-Hajj rest, post-Hajj recovery, or just a Makkah day.
          // We can know "post-Hajj" by checking if iso > 12-Dhul-Hijjah-equivalent.
          // Simpler: track whether we've passed the Hajj days yet.
          const passedHajj = days.some(x => x.title && /Yawm at-Tashreeq|Tashreeq|Yawm an-Nahr/i.test(x.title));
          const hasUmrahed = umrahInserted;
          const isFirstPostHajj = passedHajj && postHajjCounter === 0;
          const isFirstMakkah = !hasUmrahed && makkahCounter === 1;

          let title, description, duaIds = [];
          if (isFirstPostHajj) {
            postHajjCounter++;
            title = 'Recovery in Makkah';
            description = 'You have completed the rites. Rest, reflect, and maintain ibadah at the Haram.';
            duaIds = ['multazam'];
          } else if (passedHajj) {
            postHajjCounter++;
            title = `In Makkah · Day ${postHajjCounter}`;
            description = 'Continue daily prayers at the Haram. Voluntary Umrah from Tan\'eem or Ji\'irana is a popular option.';
          } else if (isFirstMakkah) {
            // Arrived in Makkah but didn't pass through a separate "Travel + Umrah" day.
            // This happens when there's no Madinah hotel and the user goes straight to Makkah.
            title = 'Arrive in Makkah';
            description = 'Settle into your accommodation. Walk to the Haram, identify your group\'s meeting points, locate the entrances closest to your hotel.';
            duaIds = ['first-sight-kabah'];
          } else {
            // Pre-Hajj rest day in Makkah after Umrah — fires only ONCE,
            // on the very first Makkah day after Umrah was inserted.
            const isRestDay = umrahInserted && makkahCounter === 1;
            title = isRestDay ? 'Rest in Makkah' : `In Makkah · Day ${makkahCounter}`;
            description = isRestDay
              ? 'A day to recover and orient yourself. Walk to the Haram, identify your group\'s meeting points, locate the entrances closest to your hotel.'
              : 'Continue ibadah at the Haram. Voluntary Tawaf and additional Umrah are popular at this time.';
            if (isRestDay) {
              days.push({
                date: d,
                dateLabel,
                title,
                location: this.hotelNameForDate('makkah', d, 'Makkah'),
                description,
                actions: [
                  'Visit the Haram for at least one prayer.',
                  'Voluntary Tawaf is highly rewarding in this period.',
                  'Drink Zamzam abundantly.',
                  'Confirm Mina arrangements with your group leader.',
                ],
              });
              continue;
            }
          }
          days.push({
            date: d,
            dateLabel,
            title,
            location: this.hotelNameForDate('makkah', d, 'Makkah'),
            description,
            duaIds,
          });
          continue;
        }

        // 8) Fallback — day in trip that's neither in Madinah nor Makkah
        //    nor a flight/Hajj/Wada day. There are two sub-cases:
        //
        //    (a) After the Travel-to-Makkah day already fired, remaining
        //        unclaimed days are de-facto in Makkah. Treat as such even
        //        when the user hasn't entered a Makkah hotel range. They
        //        get the same Makkah day-card treatment, just without a
        //        named hotel in the location field.
        //
        //    (b) Before any Madinah/Makkah anchor — typically the user
        //        only configured one city's hotel and there's a gap. Show
        //        a neutral placeholder.
        if (umrahInserted) {
          makkahCounter++;
          const isRestDay = makkahCounter === 1;
          days.push({
            date: d,
            dateLabel,
            title: isRestDay ? 'Rest in Makkah' : `In Makkah · Day ${makkahCounter}`,
            location: this.firstHotelName('makkah', 'Makkah'),
            description: isRestDay
              ? 'A day to recover and orient yourself. Walk to the Haram, identify your group\'s meeting points, locate the entrances closest to your hotel.'
              : 'Continue ibadah at the Haram. Voluntary Tawaf and additional Umrah are popular at this time.',
            duaIds: [],
            actions: isRestDay ? [
              'Visit the Haram for at least one prayer.',
              'Voluntary Tawaf is highly rewarding in this period.',
              'Drink Zamzam abundantly.',
              'Confirm Mina arrangements with your group leader.',
            ] : null,
          });
          continue;
        }
        days.push({
          date: d,
          dateLabel,
          title: 'Day in Saudi Arabia',
          location: 'Travel / between cities',
          description: 'A day not yet anchored to a specific city. Add or adjust your accommodation dates in Settings to see the right details for this day.',
          duaIds: [],
        });
      }

      // If the user has no hotel dates configured at all, the loop above
      // produces a row of "Day in Saudi Arabia" cards which is not useful.
      // Detect that and substitute a sensible default split so the page
      // still tells a story. The Itinerary tab's banner separately tells
      // them to add hotels.
      if (!madinahDated && !makkahDated) {
        return this._buildDefaultItinerary();
      }

      return days;
    },

    /**
     * v3.3 — Build a generic reference itinerary used when the user hasn't
     * provided hotel dates (or even flight dates). Same shape as the live
     * itinerary so the rest of the app renders correctly. The Itinerary
     * tab shows a callout encouraging the user to add their accommodation
     * dates so this generic structure can become personalised.
     */
    _buildDefaultItinerary() {
      const cfg = this.config || {};
      const out = cfg.outboundFlight;
      const ret = cfg.returnFlight;
      const startDate = out && out.date ? new Date(out.date) : null;
      const endDate   = ret && ret.date ? new Date(ret.date) : null;

      // If we have flight dates but no hotels, we still know the trip length.
      const totalDays = (startDate && endDate)
        ? Math.max(1, daysBetween(startDate, endDate) + 1)
        : 14;

      const days = [];
      const offset = (n) => startDate ? addDays(startDate, n) : null;
      const lbl = (d) => d ? formatDate(d) : '';

      // Departure
      const day0 = offset(0);
      days.push({
        date: day0,
        dateLabel: lbl(day0) || 'Day 1',
        title: 'Departure',
        location: out && out.from ? `${out.from} → ${out.to || 'KSA'}` : 'Travel',
        description: out && out.number
          ? `Flight ${out.number} departs at ${out.time || '—'}. Take ghusl before leaving home, recite the dua for leaving home and the traveller\'s dua.`
          : 'Take ghusl before leaving home, recite the dua for leaving home and the traveller\'s dua.',
        duaIds: ['leaving-home', 'travelers-dua', 'boarding-transport'],
        note: 'For Tamattu\' pilgrims, you do NOT need to be in Ihram on this leg if heading directly to Madinah. Ihram is donned later.',
      });

      // Madinah days — first ~3
      const madinahDays = totalDays >= 12 ? 3 : Math.max(1, Math.floor(totalDays / 4));
      for (let i = 0; i < madinahDays; i++) {
        const d = offset(i + 1);
        days.push({
          date: d,
          dateLabel: lbl(d) || `Madinah Day ${i + 1}`,
          title: i === 0 ? 'Arrive in Madinah' : `In Madinah · Day ${i + 1}`,
          location: this.firstHotelName('madinah', 'Madinah'),
          description: i === 0
            ? 'Settle into your accommodation. Aim for the next prayer at Masjid an-Nabawi if time and energy allow. Visit the Rawdah and offer salaams at the Prophet\'s grave.'
            : 'Pray five daily prayers at Masjid an-Nabawi if possible. Each prayer there equals 1,000 elsewhere. Visit Masjid Quba (Saturday morning is sunnah).',
          duaIds: i === 0 ? ['first-sight-kabah'] : [],
          actions: i === 0 ? [
            'Check in and rest if exhausted from travel.',
            'Make ghusl or wudu before going to the mosque.',
            'Enter Masjid an-Nabawi with right foot, recite the dua for entering a mosque.',
            'Greet the Prophet ﷺ at the Rawdah (currently requires Nusuk app booking).',
          ] : null,
        });
      }

      // Travel + Umrah
      const offsetUmrah = 1 + madinahDays;
      const dUmrah = offset(offsetUmrah);
      days.push({
        date: dUmrah,
        dateLabel: lbl(dUmrah) || 'Travel & Umrah Day',
        title: 'Travel to Makkah · Umrah',
        location: 'Madinah → Dhul Hulayfah → Makkah',
        description: 'Stop at Dhul Hulayfah (Bir Ali) — the miqat — to enter Ihram. Make niyyah for Umrah, pray two rakahs of Ihram, begin Talbiyah. On reaching Makkah, perform Tawaf, Sa\'i and shorten/shave to release from Ihram.',
        duaIds: ['niyyah-umrah', 'talbiyah', 'first-sight-kabah', 'tawaf-start', 'rabbana-atina', 'maqam-ibrahim', 'zamzam', 'safa-marwah-verse', 'safa-marwah-summit'],
        note: 'After Umrah, you are out of Ihram until the 8th of Dhul Hijjah. Use this time to rest, perform additional voluntary Tawaf, and prepare for the 5 days.',
      });

      // Rest day in Makkah
      const dRest = offset(offsetUmrah + 1);
      days.push({
        date: dRest,
        dateLabel: lbl(dRest) || 'Rest Day',
        title: 'Rest in Makkah',
        location: this.firstHotelName('makkah', 'Makkah'),
        description: 'A day to recover and orient yourself. Walk to the Haram, identify your group\'s meeting points, locate the entrances closest to your hotel.',
        actions: [
          'Visit the Haram for at least one prayer.',
          'Voluntary Tawaf is highly rewarding in this period.',
          'Drink Zamzam abundantly.',
          'Confirm Mina arrangements with your group leader.',
        ],
      });

      // 5 Hajj days (always at fixed positions in the default fallback)
      const hajjStart = offsetUmrah + 2;
      const hajjData = (this.data && this.data.itinerary &&
                       this.data.itinerary.phases.find(p => p.id === 'hajj-days')) || null;
      const hajjDayList = hajjData ? hajjData.days : [];
      hajjDayList.forEach((hd, i) => {
        const d = offset(hajjStart + i);
        const duaIds = [];
        if (i === 0) duaIds.push('niyyah-hajj', 'talbiyah');
        if (i === 1) duaIds.push('best-dua-arafah', 'arafah-comprehensive', 'mashar-al-haram');
        if (i === 2) duaIds.push('rami-takbir');
        if (i === 3 || i === 4) duaIds.push('after-jamarah-sughra-wusta', 'rami-takbir');
        days.push({
          date: d,
          dateLabel: lbl(d) || `Hajj Day ${i + 1}`,
          title: hd.hijri + ' · ' + hd.name,
          location: hd.location,
          description: hd.summary,
          duaIds,
        });
      });

      // Post-Hajj Makkah days — fill gap before Wada/return
      const postStart = hajjStart + 5;
      const remaining = endDate
        ? Math.max(0, daysBetween(startDate, endDate) - postStart - 1)
        : 4;
      for (let i = 0; i < Math.min(remaining, 6); i++) {
        const d = offset(postStart + i);
        days.push({
          date: d,
          dateLabel: lbl(d) || `Makkah Post-Hajj Day ${i + 1}`,
          title: i === 0 ? 'Recovery in Makkah' : `In Makkah · Day ${i + 1}`,
          location: this.firstHotelName('makkah', 'Makkah'),
          description: i === 0
            ? 'You have completed the rites. Rest, reflect, and maintain ibadah at the Haram.'
            : 'Continue daily prayers at the Haram. Voluntary Umrah from Tan\'eem or Ji\'irana is a popular option.',
          duaIds: i === 0 ? ['multazam'] : [],
        });
      }

      // Wada + return (only if we have an end date)
      if (endDate) {
        const dDayBefore = addDays(endDate, -1);
        days.push({
          date: dDayBefore,
          dateLabel: lbl(dDayBefore),
          title: 'Tawaf al-Wada',
          location: 'Masjid al-Haram',
          description: 'The Farewell Tawaf — the final ritual before leaving Makkah. Perform it as close to your departure as possible. After it, no extended stay or shopping should occur.',
          duaIds: ['multazam'],
          note: 'Wajib in Hanafi/Shafi\'i/Hanbali; sunnah in Maliki. Menstruating women are exempt.',
        });
        const retByRoad = !!(ret && ret.byRoad);
        days.push({
          date: endDate,
          dateLabel: lbl(endDate),
          title: retByRoad ? 'Return Home (by road)' : 'Return Home',
          location: retByRoad
            ? 'Land crossing → home'
            : (ret && ret.from ? `${ret.from} → ${ret.to || 'Home'}` : 'Travel'),
          description: retByRoad
            ? 'Travelling home overland. Recite the returning dua as you approach home.'
            : (ret && ret.number
              ? `Flight ${ret.number} departs at ${ret.time || '—'}. Recite the returning dua as you approach home.`
              : 'Recite the returning dua as you approach home.'),
          duaIds: ['returning-home', 'travelers-dua'],
        });
      }

      return days;
    },

    /* ─── Madhab-aware essentials ─────────────────────── */

    essentialsByMadhab(m) {
      const data = {
        hanafi: [
          {
            title: 'The 3 Fard',
            subtitle: 'Without these, Hajj is invalid.',
            items: [
              'Ihram (intention + Talbiyah at the Miqat)',
              'Wuquf at Arafah (any moment between Zawal of 9th and Fajr of 10th)',
              'Tawaf al-Ziyarah (within the days of Nahr — by sunset of 12th)',
            ]
          },
          {
            title: 'The Wajib Acts',
            subtitle: 'Missing any incurs a dam (sacrifice).',
            items: [
              'Sa\'i between Safa and Marwah',
              'Stop at Muzdalifah after Fajr',
              'Rami of Jamarat (10th, 11th, 12th)',
              'Halq or Taqsir',
              'Tawaf al-Wada (for non-residents)',
              'Sacrifice for Tamattu\' / Qiran',
              'Order of rituals on the 10th',
            ]
          }
        ],
        shafi: [
          {
            title: 'The Arkan (Pillars)',
            subtitle: 'All required for Hajj to be valid.',
            items: [
              'Ihram',
              'Wuquf at Arafah',
              'Tawaf al-Ifadah',
              'Sa\'i between Safa and Marwah',
              'Halq or Taqsir',
              'Order between these arkan',
            ]
          },
          {
            title: 'The Wajibat',
            subtitle: 'Missing any incurs a dam.',
            items: [
              'Ihram from the Miqat',
              'Stop at Muzdalifah',
              'Stay overnight in Mina (11th, 12th, 13th)',
              'Rami of all three Jamarat',
              'Tawaf al-Wada',
            ]
          }
        ],
        maliki: [
          {
            title: 'The Arkan',
            subtitle: 'Pillars without which Hajj is invalid.',
            items: [
              'Ihram',
              'Wuquf at Arafah (must include part of the night)',
              'Tawaf al-Ifadah',
              'Sa\'i between Safa and Marwah',
            ]
          },
          {
            title: 'The Wajibat',
            subtitle: 'Missing any incurs a dam.',
            items: [
              'Ihram from the Miqat',
              'Stop at Muzdalifah',
              'Stay in Mina (nights of 11th, 12th, 13th)',
              'Rami of all three Jamarat',
              'Halq or Taqsir',
              'Combining day and night at Arafah',
            ]
          }
        ],
        hanbali: [
          {
            title: 'The Arkan',
            subtitle: 'All required for valid Hajj.',
            items: [
              'Ihram',
              'Wuquf at Arafah',
              'Tawaf al-Ifadah',
              'Sa\'i between Safa and Marwah',
            ]
          },
          {
            title: 'The Wajibat',
            subtitle: 'Missing any incurs a dam.',
            items: [
              'Ihram from the Miqat',
              'Wuquf until sunset for those at Arafah during the day',
              'Stay overnight at Muzdalifah',
              'Stay overnight in Mina',
              'Rami of all three Jamarat',
              'Halq or Taqsir',
              'Tawaf al-Wada',
            ]
          }
        ]
      };
      return data[m] || data.hanafi;
    },

    rulingsForHajjDay(idx, madhab) {
      // Hand-picked relevance per day index (0=8th, 1=9th, 2=10th, 3=11th, 4=12th)
      const map = {
        0: ['ihram-niyyah-place', 'qasr-traveler', 'takbir-tashreeq'],
        1: ['wuquf-arafah-time', 'combining-prayers-arafah', 'combining-prayers-muzdalifah', 'muzdalifah-overnight'],
        2: ['rami-order-day-10', 'sacrifice-tamattu-qiran', 'halq-preferred', 'taqsir-length', 'tawaf-ziyarah-deadline'],
        3: ['rami-timing-11-12'],
        4: ['rami-timing-11-12', 'leaving-mina-12th', 'tawaf-wada'],
      };
      const ids = map[idx] || [];
      return this.data.rulings.filter(r => ids.includes(r.id));
    },

    /* ─── Packing data ───────────────────────────────── */

    packingData() {
      return [
        {
          title: 'Documents',
          items: [
            { id: 'passport', label: 'Passport', hint: '6+ months validity from return date.' },
            { id: 'visa', label: 'Hajj visa printout' },
            { id: 'flight-tickets', label: 'Flight tickets (printed + digital)' },
            { id: 'vaccination-cert', label: 'Vaccination certificate', hint: 'Meningitis ACWY mandatory.' },
            { id: 'medical-prescriptions', label: 'Medical prescriptions in original packaging' },
            { id: 'travel-insurance', label: 'Travel insurance details' },
            { id: 'hotel-bookings', label: 'Hotel & operator confirmations' },
            { id: 'id-copies', label: 'Photocopies of all documents (kept separately)' },
            { id: 'cards-cash', label: 'Bank cards + emergency cash (Riyal + home currency)' },
            { id: 'emergency-card', label: 'Emergency contact card', hint: 'Print from Overview tab.' },
          ]
        },
        {
          title: 'Ihram (Men)',
          items: [
            { id: 'ihram-set-1', label: 'Two unstitched white cloths (izar + rida)' },
            { id: 'ihram-set-2', label: 'Spare set of Ihram cloths' },
            { id: 'ihram-belt', label: 'Ihram belt with pockets' },
            { id: 'flip-flops', label: 'Backless sandals or flip-flops', hint: 'Heel must be exposed.' },
            { id: 'unscented-soap-men', label: 'Unscented soap & shampoo' },
            { id: 'safety-pins', label: 'Safety pins (to secure ihram)' },
            { id: 'small-bag', label: 'Small drawstring bag for shoes when entering Haram' },
            { id: 'umbrella', label: 'Compact umbrella', hint: 'Permitted for shade in Ihram.' },
          ]
        },
        {
          title: 'Ihram (Women)',
          items: [
            { id: 'modest-clothing-1', label: 'Two sets of modest, loose-fitting clothing' },
            { id: 'modest-clothing-2', label: 'Long abayas (preferably white or light)' },
            { id: 'hijabs', label: 'Several hijabs (lightweight, breathable)' },
            { id: 'face-veil', label: 'Face-veil with frame (Hanafi)', hint: 'Must not touch the face — see madhab differences.' },
            { id: 'comfortable-shoes-w', label: 'Comfortable closed-toe walking shoes' },
            { id: 'unscented-soap-w', label: 'Unscented soap & shampoo' },
            { id: 'sanitary-supplies', label: 'Sanitary products (extra)', hint: 'Stress can disrupt cycles.' },
            { id: 'safety-pins-w', label: 'Safety pins' },
          ]
        },
        {
          title: 'Clothing & general',
          items: [
            { id: 'undergarments', label: 'Undergarments (7+ sets)' },
            { id: 'socks', label: 'Cotton socks' },
            { id: 'sleepwear', label: 'Light sleepwear' },
            { id: 'jacket', label: 'Light jacket / shawl', hint: 'For air-conditioned spaces and cool nights.' },
            { id: 'walking-shoes', label: 'Comfortable walking shoes (broken in)' },
            { id: 'sunglasses', label: 'Sunglasses' },
            { id: 'cap-hat', label: 'Cap or hat for between rituals' },
            { id: 'laundry-bag', label: 'Laundry bag' },
          ]
        },
        {
          title: 'Toiletries',
          items: [
            { id: 'toothbrush-paste', label: 'Toothbrush & toothpaste' },
            { id: 'miswak', label: 'Miswak' },
            { id: 'unscented-deodorant', label: 'Unscented deodorant' },
            { id: 'unscented-lotion', label: 'Unscented lotion / Vaseline', hint: 'Helps with chafing.' },
            { id: 'sunscreen', label: 'Sunscreen (high SPF)' },
            { id: 'tissues', label: 'Tissues / wet wipes' },
            { id: 'small-towel', label: 'Quick-dry small towel' },
            { id: 'nail-clippers', label: 'Nail clippers (for after Hajj)' },
            { id: 'razor', label: 'Razor / clippers (for halq)' },
            { id: 'mirror', label: 'Small travel mirror' },
            { id: 'lip-balm', label: 'Lip balm (unscented)' },
            { id: 'shampoo-bar', label: 'Shampoo bar (saves space)' },
          ]
        },
        {
          title: 'Medical kit',
          items: [
            { id: 'painkillers', label: 'Paracetamol / ibuprofen' },
            { id: 'cold-flu', label: 'Cold & flu medication', hint: '"Hajj cough" is widespread.' },
            { id: 'rehydration', label: 'Oral rehydration salts (Dioralyte)', hint: 'Critical for heat.' },
            { id: 'antidiarrheal', label: 'Anti-diarrhoeal (Imodium)' },
            { id: 'antiseptic', label: 'Antiseptic cream' },
            { id: 'plasters', label: 'Plasters & blister patches' },
            { id: 'hand-sanitiser', label: 'Hand sanitiser' },
            { id: 'face-masks', label: 'Face masks (10+)' },
            { id: 'throat-lozenges', label: 'Throat lozenges' },
            { id: 'allergy-meds', label: 'Allergy / antihistamine' },
            { id: 'inhaler', label: 'Inhaler (if asthmatic)' },
            { id: 'multivitamin', label: 'Multivitamin' },
            { id: 'electrolyte-tabs', label: 'Electrolyte tablets' },
            { id: 'thermometer', label: 'Small thermometer' },
          ]
        },
        {
          title: 'Tech & money',
          items: [
            { id: 'phone', label: 'Phone (charged + unlocked)' },
            { id: 'charger', label: 'Phone charger' },
            { id: 'powerbank', label: 'Power bank (10000+ mAh)' },
            { id: 'adapter', label: 'UK→Saudi adapter (Type G similar but check)' },
            { id: 'headphones', label: 'Headphones (for audio Quran)' },
            { id: 'sim-card', label: 'Saudi SIM or roaming plan' },
            { id: 'small-notebook', label: 'Small notebook & pen' },
            { id: 'cash-belt', label: 'Money belt (worn under clothing)' },
            { id: 'small-wallet', label: 'Small everyday wallet' },
            { id: 'change-pouch', label: 'Pouch for small change' },
          ]
        },
        {
          title: 'Mina bag (small bag for tents)',
          items: [
            { id: 'mina-mat', label: 'Lightweight prayer mat' },
            { id: 'mina-blanket', label: 'Light blanket / sheet' },
            { id: 'mina-pillow', label: 'Small inflatable pillow' },
            { id: 'mina-water', label: 'Water bottle with built-in filter' },
            { id: 'mina-snacks', label: 'Energy bars, dates, dry snacks' },
            { id: 'mina-quran', label: 'Small Quran or app' },
            { id: 'mina-tasbih', label: 'Tasbih (digital or beads)' },
            { id: 'mina-pebble-bag', label: 'Pebble bag (49 stones for full Hajj, 70 if 13th included)' },
            { id: 'mina-flashlight', label: 'Small flashlight (for Muzdalifah pebble collection)' },
            { id: 'mina-meds', label: 'Daily meds in pouch' },
            { id: 'mina-toiletries', label: 'Travel toiletries' },
            { id: 'mina-spare-clothes', label: 'Spare set of clothes' },
          ]
        },
        {
          title: 'Don\'t forget',
          items: [
            { id: 'will', label: 'Updated will (left with trusted person)' },
            { id: 'debts-cleared', label: 'Outstanding debts settled' },
            { id: 'forgiveness', label: 'Asked forgiveness from family & friends' },
            { id: 'sadaqah', label: 'Sadaqah given before departure' },
            { id: 'halal-meat', label: 'Confirmed halal meat at hotel / planned alternatives' },
            { id: 'qiblah-app', label: 'Qiblah-finder app installed' },
            { id: 'translator-app', label: 'Translator app (Arabic) installed' },
            { id: 'offline-maps', label: 'Offline Google Maps for Makkah & Madinah' },
            { id: 'family-info', label: 'Left family with all contacts and itinerary' },
            { id: 'haircut-pre', label: 'Trim hair / nails before Ihram' },
          ]
        }
      ];
    }
  };

  global.Guide = Guide;
})(window);
