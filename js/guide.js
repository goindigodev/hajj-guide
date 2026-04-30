/* =============================================================
   GUIDE — Renders all tab content from data files + user config.
   Single source of truth for the personalised guide.
   ============================================================= */

(function (global) {
  'use strict';

  const { el, $, $$, escapeHtml, formatDate, addDays, daysBetween, slugify } = Utils;

  // ─── Tab definitions ──────────────────────────────────────
  const TABS = [
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

      this.render();
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
        case 'settings':    return this.tabSettings();
      }
      return el('div');
    },

    switchTab(id) {
      this.currentTab = id;
      $$('.tab-content').forEach(t => t.classList.toggle('is-active', t.id === `tab-${id}`));
      $$('.tab-nav__btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === id));
      // Update notes section context
      if (window.Notes && Notes.setSection) {
        const tabDef = TABS.find(t => t.id === id);
        Notes.setSection(id, tabDef ? tabDef.title : id);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /* ─── TABS ────────────────────────────────────────────── */

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
          'Print this section and keep a copy in each bag. ',
          el('a', { href: '#', onclick: e => { e.preventDefault(); window.Print && Print.printActiveTab(); } }, 'Print')
        ));
        wrap.appendChild(this.renderEmergencyCard());
      }

      return wrap;
    },

    tabItinerary() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Your Itinerary'));
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

    tabSettings() {
      const wrap = el('div');
      wrap.appendChild(el('h1', null, 'Settings'));
      wrap.appendChild(el('p', { class: 'lead' },
        'Adjust your preferences and trip details.'
      ));

      const grid = el('div', { class: 'settings-grid' });

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
      body.appendChild(inner);
      card.appendChild(body);

      head.addEventListener('click', () => {
        card.classList.toggle('is-open');
        head.setAttribute('aria-expanded', card.classList.contains('is-open') ? 'true' : 'false');
      });

      return card;
    },

    /* ─── Build days list from user config ─────────────── */

    buildItineraryDays() {
      const cfg = this.config;
      const out = cfg.outboundFlight;
      const ret = cfg.returnFlight;

      // Try to find Hajj day 8 from flight date — assume user has scheduled around it.
      // Without complex Hijri math we just use day offsets from departure.
      // Generic structure: arrive → Madinah → travel → Makkah/Umrah → 5 Hajj days → Makkah → home
      const startDate = out && out.date ? new Date(out.date) : null;
      const endDate = ret && ret.date ? new Date(ret.date) : null;
      const hasFlights = !!(startDate && endDate);

      // Fallback example length 14 days
      const totalDays = hasFlights ? Math.max(1, daysBetween(startDate, endDate) + 1) : 14;

      // Phases sized proportionally
      const days = [];
      const day1 = startDate ? formatDate(startDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Day 1';

      // Departure
      const outByRoad = !!(out && out.byRoad);
      days.push({
        date: startDate || null,
        dateLabel: day1,
        title: outByRoad ? 'Departure (by road)' : 'Departure',
        location: outByRoad
          ? 'Land crossing → KSA'
          : (hasFlights ? `${out.from || 'Home'} → ${out.to || 'MED/JED'}` : 'Travel'),
        description: outByRoad
          ? 'Travelling overland into Saudi Arabia. Take ghusl before leaving home, recite the dua for leaving home and the traveller\'s dua. Be ready to enter Ihram if your route bypasses a designated miqat — confirm with your group leader.'
          : (hasFlights
            ? `Flight ${out.number || ''} departs at ${out.time || '—'}. Take ghusl before leaving home, recite the dua for leaving home and the traveller\'s dua. Begin the journey calmly.`
            : 'Take ghusl before leaving home, recite the dua for leaving home and the traveller\'s dua.'),
        duaIds: ['leaving-home', 'travelers-dua', 'boarding-transport'],
        note: 'For Tamattu\' pilgrims, you do NOT need to be in Ihram on this leg if heading directly to Madinah. Ihram is donned later.',
      });

      // Madinah days (estimate first ~3 days unless trip is short)
      const madinahDays = totalDays >= 12 ? 3 : Math.max(1, Math.floor(totalDays / 4));
      for (let i = 0; i < madinahDays; i++) {
        const d = startDate ? addDays(startDate, i + 1) : null;
        days.push({
          date: d,
          dateLabel: d ? formatDate(d) : `Madinah Day ${i + 1}`,
          title: i === 0 ? 'Arrive in Madinah' : `In Madinah · Day ${i + 1}`,
          location: this.hotelNameForDate('madinah', d, 'Madinah'),
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

      // Travel to Makkah + Umrah
      const offsetUmrah = 1 + madinahDays;
      const dUmrah = startDate ? addDays(startDate, offsetUmrah) : null;
      days.push({
        date: dUmrah,
        dateLabel: dUmrah ? formatDate(dUmrah) : 'Travel & Umrah Day',
        title: 'Travel to Makkah · Umrah',
        location: 'Madinah → Dhul Hulayfah → Makkah',
        description: 'Stop at Dhul Hulayfah (Bir Ali) — the miqat — to enter Ihram. Make niyyah for Umrah, pray two rakahs of Ihram, begin Talbiyah. On reaching Makkah, perform Tawaf, Sa\'i and shorten/shave to release from Ihram.',
        duaIds: ['niyyah-umrah', 'talbiyah', 'first-sight-kabah', 'tawaf-start', 'rabbana-atina', 'maqam-ibrahim', 'zamzam', 'safa-marwah-verse', 'safa-marwah-summit'],
        note: 'After Umrah, you are out of Ihram until the 8th of Dhul Hijjah. Use this time to rest, perform additional voluntary Tawaf, and prepare for the 5 days.',
      });

      // Rest day
      const dRest = startDate ? addDays(startDate, offsetUmrah + 1) : null;
      days.push({
        date: dRest,
        dateLabel: dRest ? formatDate(dRest) : 'Rest Day',
        title: 'Rest in Makkah',
        location: this.hotelNameForDate('makkah', dRest, 'Makkah'),
        description: 'A day to recover and orient yourself. Walk to the Haram, identify your group\'s meeting points, locate the entrances closest to your hotel.',
        actions: [
          'Visit the Haram for at least one prayer.',
          'Voluntary Tawaf is highly rewarding in this period.',
          'Drink Zamzam abundantly.',
          'Confirm Mina arrangements with your group leader.',
        ],
      });

      // The 5 Hajj days
      const hajjStart = offsetUmrah + 2;
      const hajjDays = this.data.itinerary.phases.find(p => p.id === 'hajj-days').days;
      hajjDays.forEach((hd, i) => {
        const d = startDate ? addDays(startDate, hajjStart + i) : null;
        const duaIds = [];
        if (i === 0) duaIds.push('niyyah-hajj', 'talbiyah');
        if (i === 1) duaIds.push('best-dua-arafah', 'arafah-comprehensive', 'mashar-al-haram');
        if (i === 2) duaIds.push('rami-takbir');
        if (i === 3 || i === 4) duaIds.push('after-jamarah-sughra-wusta', 'rami-takbir');
        days.push({
          date: d,
          dateLabel: d ? formatDate(d) : `Hajj Day ${i + 1}`,
          title: hd.hijri + ' · ' + hd.name,
          location: hd.location,
          description: hd.summary,
          duaIds: duaIds,
        });
      });

      // Post-Hajj Makkah days fill the gap.
      // We need to reserve the last 2 days for Tawaf al-Wada (day before flight)
      // and Return Home (flight day) when endDate is known.
      const postStart = hajjStart + 5;
      const remaining = endDate
        ? Math.max(0, daysBetween(startDate, endDate) - postStart - 1) // leave 1 day for Wada (return is endDate itself)
        : 4;

      for (let i = 0; i < Math.min(remaining, 6); i++) {
        const d = startDate ? addDays(startDate, postStart + i) : null;
        days.push({
          date: d,
          dateLabel: d ? formatDate(d) : `Makkah Post-Hajj Day ${i + 1}`,
          title: i === 0 ? 'Recovery in Makkah' : `In Makkah · Day ${i + 1}`,
          location: this.hotelNameForDate('makkah', d, 'Makkah'),
          description: i === 0
            ? 'You have completed the rites. Rest, reflect, and maintain ibadah at the Haram.'
            : 'Continue daily prayers at the Haram. Voluntary Umrah from Tan\'eem or Ji\'irana is a popular option.',
          duaIds: i === 0 ? ['multazam'] : [],
        });
      }

      // Wada + return
      if (endDate) {
        const dDayBefore = addDays(endDate, -1);
        days.push({
          date: dDayBefore,
          dateLabel: formatDate(dDayBefore),
          title: 'Tawaf al-Wada',
          location: 'Masjid al-Haram',
          description: 'The Farewell Tawaf — the final ritual before leaving Makkah. Perform it as close to your departure as possible. After it, no extended stay or shopping should occur.',
          duaIds: ['multazam'],
          note: 'Wajib in Hanafi/Shafi\'i/Hanbali; sunnah in Maliki. Menstruating women are exempt.',
        });
        const retByRoad = !!(ret && ret.byRoad);
        days.push({
          date: endDate,
          dateLabel: formatDate(endDate),
          title: retByRoad ? 'Return Home (by road)' : 'Return Home',
          location: retByRoad
            ? 'Land crossing → home'
            : (hasFlights ? `${ret.from || 'JED'} → ${ret.to || 'Home'}` : 'Travel'),
          description: retByRoad
            ? 'Travelling home overland. Recite the returning dua as you approach home.'
            : (hasFlights
              ? `Flight ${ret.number || ''} departs at ${ret.time || '—'}. Recite the returning dua as you approach home.`
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
