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
