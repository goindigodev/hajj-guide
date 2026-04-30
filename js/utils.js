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
      // Normalise the ʻ ʼ characters that Intl returns
      const month = h.month
        .replace(/ʻ|ʼ|ʿ/g, '\u2019')
        .replace(/Dhu\u2019l[- ]Hijjah/i, 'Dhul Hijjah')
        .replace(/Dhu\u2019l[- ]Qa\u2019dah/i, "Dhul Qa'dah");
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
