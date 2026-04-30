/* =============================================================
   UTILS
   ============================================================= */

(function (global) {
  'use strict';

  const Utils = {
    /**
     * Safely select element(s)
     */
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },

    /**
     * Create element with attrs and children
     */
    el(tag, attrs, ...children) {
      const node = document.createElement(tag);
      if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
          if (k === 'class') node.className = v;
          else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
          else if (k.startsWith('on') && typeof v === 'function') {
            node.addEventListener(k.slice(2).toLowerCase(), v);
          } else if (k === 'html') node.innerHTML = v;
          else if (v !== null && v !== undefined && v !== false) {
            node.setAttribute(k, v === true ? '' : v);
          }
        }
      }
      for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        if (Array.isArray(child)) {
          child.forEach(c => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
        } else if (typeof child === 'string' || typeof child === 'number') {
          node.appendChild(document.createTextNode(String(child)));
        } else {
          node.appendChild(child);
        }
      }
      return node;
    },

    /**
     * Format a Date as "Wed 20 May"
     */
    formatDate(date, opts) {
      if (!date) return '';
      const d = (date instanceof Date) ? date : new Date(date);
      if (isNaN(d.getTime())) return '';
      const o = opts || { weekday: 'short', day: 'numeric', month: 'short' };
      return d.toLocaleDateString('en-GB', o);
    },

    /**
     * Format time string
     */
    formatTime(timeStr) {
      if (!timeStr) return '';
      // Accept "HH:MM" or full date
      if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    },

    /**
     * Add days to a Date and return new Date
     */
    addDays(date, n) {
      const d = (date instanceof Date) ? new Date(date.getTime()) : new Date(date);
      d.setDate(d.getDate() + n);
      return d;
    },

    /**
     * Days difference between two dates
     */
    daysBetween(a, b) {
      const da = new Date(a); da.setHours(0,0,0,0);
      const db = new Date(b); db.setHours(0,0,0,0);
      return Math.round((db - da) / 86400000);
    },

    /**
     * v2.2 — Convert a Gregorian Date to a Hijri date object using the
     * Saudi Umm al-Qura calendar, via the browser's built-in Intl API.
     * Returns { day, month, monthName, year } or null if the date is invalid
     * or the browser doesn't support the calendar.
     */
    toHijri(date) {
      try {
        const d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) return null;
        const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        // Returns parts like [day, month name, year]
        const parts = fmt.formatToParts(d);
        const get = (type) => {
          const p = parts.find(x => x.type === type);
          return p ? p.value : '';
        };
        const dayStr   = get('day');
        const monthStr = get('month');     // e.g. "Dhuʻl-Hijjah"
        const yearStr  = get('year').replace(/[^\d]/g, '');
        return {
          day: parseInt(dayStr, 10) || 0,
          month: monthStr,
          year: parseInt(yearStr, 10) || 0,
        };
      } catch (e) {
        return null;
      }
    },

    /**
     * v2.2 — Format a Gregorian Date as a short Hijri string like
     * "8 Dhul Hijjah 1447". The Intl API returns "Dhuʻl-Hijjah" with a
     * curly ʻ which we replace with a plain apostrophe for readability.
     */
    formatHijri(date) {
      const h = this.toHijri(date);
      if (!h) return '';
      // Intl returns slightly varying transliterations across browsers
      // (e.g. "Dhuʻl-Hijjah", "Dhu'l-Hijjah", "Dhuʼl Hijjah"). Normalise
      // common variants to the spellings most familiar to English-speaking
      // pilgrims.
      let month = h.month
        .replace(/[ʻʼʿ‘’]/g, '\u2019')          // standardise quote characters
        .replace(/Dhu\u2019l[- ]Hijjah/i, 'Dhul Hijjah')
        .replace(/Dhu\u2019l[- ]Qa\u2019?dah/i, "Dhul Qa'dah")
        .replace(/Dhu\u2019l[- ]Qi\u2019?dah/i, "Dhul Qa'dah")  // alt spelling
        .replace(/Rabi\u2019\s*I\b/i,  'Rabi I')
        .replace(/Rabi\u2019\s*II\b/i, 'Rabi II')
        .replace(/Jumada\s*I\b/i,      'Jumada I')
        .replace(/Jumada\s*II\b/i,     'Jumada II');
      return `${h.day} ${month} ${h.year}`;
    },

    /**
     * v2.2 — Are any of the given Gregorian dates within the 8-13 Dhul Hijjah window?
     * Used to detect whether the user's flights actually contain the Hajj period.
     */
    containsHajjPeriod(startDate, endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
        // Walk day-by-day (max 60 days for sanity)
        const oneDay = 86400000;
        let d = new Date(start.getTime());
        for (let i = 0; i < 60 && d <= end; i++) {
          const h = this.toHijri(d);
          if (h && /Hijjah/i.test(h.month) && h.day >= 8 && h.day <= 13) {
            return true;
          }
          d = new Date(d.getTime() + oneDay);
        }
        return false;
      } catch (e) {
        return null;
      }
    },

    /**
     * v2.4 — Validate hotel date ranges for a given city.
     * Takes the hotels array and (optionally) the user's overall trip window
     * (outboundDate, returnDate as ISO yyyy-mm-dd strings or Date objects).
     * Returns an array of warning objects: { level: 'warn' | 'info', message: string, hotelIndices: number[] }.
     * An empty array means everything looks fine.
     *
     * Detected issues:
     *   - Single hotel: toDate before fromDate
     *   - Two hotels overlap (user is in two places at once)
     *   - Two consecutive hotels have a gap night
     *   - Hotel range extends outside the flight window
     *   - The combined hotels don't cover every night between flights (city-specific)
     *
     * Note: this validates WITHIN a city. Caller decides which window to pass.
     * For multi-city pilgrims, run twice — once for Madinah, once for Makkah.
     */
    validateHotelDateRanges(hotels, options) {
      const opts = options || {};
      const warnings = [];
      // Filter out incomplete entries — only validate hotels with both dates
      const named = (hotels || [])
        .map((h, i) => ({ ...h, _idx: i }))
        .filter(h => h && h.name);
      const dated = named.filter(h => h.fromDate && h.toDate);

      // Local i18n shortcut. Falls back to English string with template-literal-style
      // substitution if I18n isn't loaded (or the key is missing).
      const tt = (key, fallback, params) =>
        (window.I18n ? window.I18n.t(key, params) : fallback) || fallback;

      // 1. Single-hotel reverse-order check (treat each hotel independently first)
      named.forEach(h => {
        if (h.fromDate && h.toDate && h.toDate < h.fromDate) {
          warnings.push({
            level: 'warn',
            message: tt('onboarding.validation.warnReverse',
              `${h.name}: check-out date (${h.toDate}) is before check-in date (${h.fromDate}).`,
              { name: h.name, to: h.toDate, from: h.fromDate }),
            hotelIndices: [h._idx],
          });
        }
      });

      // Sort by fromDate for adjacency checks
      const sorted = dated.slice().sort((a, b) =>
        a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : 0
      );

      // 2. Overlap + 3. Gap (between consecutive hotels)
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (a.toDate && b.fromDate) {
          if (b.fromDate < a.toDate) {
            warnings.push({
              level: 'warn',
              message: tt('onboarding.validation.warnOverlap',
                `${a.name} (until ${a.toDate}) overlaps with ${b.name} (from ${b.fromDate}). You can\'t be in two hotels at once.`,
                { a: a.name, aTo: a.toDate, b: b.name, bFrom: b.fromDate }),
              hotelIndices: [a._idx, b._idx],
            });
          } else if (b.fromDate > a.toDate) {
            // Compute the gap days
            const gap = this._daysBetweenIso(a.toDate, b.fromDate) - 1;
            if (gap > 0) {
              const key = gap === 1 ? 'onboarding.validation.warnGap' : 'onboarding.validation.warnGapPlural';
              warnings.push({
                level: 'warn',
                message: tt(key,
                  `Gap of ${gap} night${gap === 1 ? '' : 's'} between ${a.name} (ends ${a.toDate}) and ${b.name} (starts ${b.fromDate}). Where are you sleeping in between?`,
                  { n: gap, a: a.name, aTo: a.toDate, b: b.name, bFrom: b.fromDate }),
                hotelIndices: [a._idx, b._idx],
              });
            }
            // gap === 0 means b.fromDate is exactly the day after a.toDate (e.g.
            // checkout 25 May, check-in 26 May) — clean handoff, no warning.
          }
        }
      }

      // 4. Outside flight window (if window provided)
      if (opts.outboundDate || opts.returnDate) {
        const outIso = this._toIso(opts.outboundDate);
        const retIso = this._toIso(opts.returnDate);
        named.forEach(h => {
          if (outIso && h.fromDate && h.fromDate < outIso) {
            warnings.push({
              level: 'info',
              message: tt('onboarding.validation.infoBeforeOutbound',
                `${h.name} starts (${h.fromDate}) before your outbound flight (${outIso}). Is the date correct?`,
                { name: h.name, from: h.fromDate, outbound: outIso }),
              hotelIndices: [h._idx],
            });
          }
          if (retIso && h.toDate && h.toDate > retIso) {
            warnings.push({
              level: 'info',
              message: tt('onboarding.validation.infoAfterReturn',
                `${h.name} ends (${h.toDate}) after your return flight (${retIso}). Is the date correct?`,
                { name: h.name, to: h.toDate, return: retIso }),
              hotelIndices: [h._idx],
            });
          }
        });
      }

      // 5. Coverage — does the combined hotel window cover the city's expected nights?
      // Caller passes optional cityWindow {start, end} for coverage check; we don't
      // try to infer it from the trip itinerary here (too many assumptions).
      if (opts.cityWindow && opts.cityWindow.start && opts.cityWindow.end) {
        const winStart = this._toIso(opts.cityWindow.start);
        const winEnd   = this._toIso(opts.cityWindow.end);
        if (winStart && winEnd && dated.length) {
          // Build a set of covered ISO dates
          const covered = new Set();
          dated.forEach(h => {
            const start = h.fromDate;
            const end = h.toDate;
            if (!start || !end) return;
            let d = new Date(start);
            const stop = new Date(end);
            // Cover every night from start to (end - 1) — checkout day's night is at
            // the next hotel. So nights covered = [fromDate, toDate-1].
            // For the last hotel of a city before moving on, "toDate" is checkout.
            for (let i = 0; i < 60 && d < stop; i++) {
              covered.add(d.toISOString().slice(0, 10));
              d.setDate(d.getDate() + 1);
            }
          });
          // Walk the expected window and find missing nights
          const missing = [];
          let cursor = new Date(winStart);
          const winStop = new Date(winEnd);
          for (let i = 0; i < 60 && cursor < winStop; i++) {
            const iso = cursor.toISOString().slice(0, 10);
            if (!covered.has(iso)) missing.push(iso);
            cursor.setDate(cursor.getDate() + 1);
          }
          if (missing.length) {
            const previewDates = missing.slice(0, 3).join(', ');
            const more = missing.length > 3 ? ` (+${missing.length - 3} more)` : '';
            warnings.push({
              level: 'info',
              message: `${missing.length} night${missing.length === 1 ? '' : 's'} not covered by any hotel: ${previewDates}${more}.`,
              hotelIndices: [],
            });
          }
        }
      }

      return warnings;
    },

    /** Internal helper: integer days between two ISO yyyy-mm-dd strings (b - a). */
    _daysBetweenIso(a, b) {
      const da = new Date(a + 'T00:00:00Z');
      const db = new Date(b + 'T00:00:00Z');
      return Math.round((db - da) / 86400000);
    },

    /** Internal helper: normalise to ISO yyyy-mm-dd (Date or string in). */
    _toIso(v) {
      if (!v) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      const s = String(v);
      // If looks like ISO already, return first 10 chars
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      // Try to parse
      const d = new Date(s);
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    },

    /**
     * Debounce
     */
    debounce(fn, wait) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    /**
     * Escape HTML for safe insertion
     */
    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Fetch JSON with error handling
     */
    async fetchJSON(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      return res.json();
    },

    /**
     * Slug generator
     */
    slugify(str) {
      return String(str || '')
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    },

    /**
     * Smooth scroll to element
     */
    scrollToEl(el, offset) {
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.pageYOffset - (offset || 80);
      window.scrollTo({ top, behavior: 'smooth' });
    },

    /**
     * Toast/announce a message briefly
     */
    toast(message, type) {
      const t = document.createElement('div');
      t.className = `toast toast--${type || 'info'}`;
      t.textContent = message;
      Object.assign(t.style, {
        position: 'fixed',
        bottom: '90px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1f3529',
        color: '#fbf7ec',
        padding: '12px 20px',
        borderRadius: '4px',
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '15px',
        zIndex: '200',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        opacity: '0',
        transition: 'opacity 0.2s',
      });
      document.body.appendChild(t);
      requestAnimationFrame(() => { t.style.opacity = '1'; });
      setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 250);
      }, 2400);
    }
  };

  global.Utils = Utils;
})(window);
