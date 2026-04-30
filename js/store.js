/* =============================================================
   STORE — Persistent state via localStorage
   Single source of truth for user config, notes, packing, fontsize.
   ============================================================= */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'hajj-companion-v1';

  // Default state shape
  const DEFAULT_STATE = {
    onboarded: false,
    config: {
      // Trip basics
      outboundFlight: { number: '', date: '', time: '', from: '', to: 'MED', byRoad: false },
      returnFlight: { number: '', date: '', time: '', from: 'JED', to: '', byRoad: false },

      // Religious settings
      madhab: 'hanafi', // hanafi | shafi | maliki | hanbali

      // Operator
      operator: { name: '', contactName: '', contactPhone: '', emergencyPhone: '' },

      // Accommodation (place_id from Places API + manual fallback).
      // v2.2 — supports multiple hotels per city, each with a date range.
      // Existing single-hotel data is migrated on load (see migrate() below).
      // Each entry: { name, address, placeId, lat, lng, fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD' }
      madinahHotels: [],
      makkahHotels: [],

      // v2.2 — Mina camp details. Pilgrims either stay inside the Mina valley
      // (in a tent, by zone) or in Aziziyah (residential district adjacent to
      // Mina, used in "shifting" packages). All optional.
      minaCamp: {
        type: '',     // 'mina' | 'aziziyah' | 'unsure' | ''
        zone: '',     // only meaningful when type === 'mina': 'A' | 'B' | 'C' | 'D' | 'unknown'
        area: '',     // free text — e.g. "Muaisim", "Al-Kabsh", "Camp 12B"
      },

      // Group info
      groupSize: 1,
      groupContacts: [], // [{name, phone}]
    },
    preferences: {
      fontSize: 1, // 0=A-, 1=A, 2=A+, 3=A++
    },
    notes: {}, // { sectionId: "user notes" }
    packing: {}, // { itemId: true|false }
    audioCache: {}, // { duaId: true } — which audios have been downloaded
    journal: {}, // v2.7 — { 'YYYY-MM-DD': { text: "...", updatedAt: 1234567890 } }
  };

  // Deep merge for partial updates
  function merge(target, source) {
    for (const key of Object.keys(source || {})) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = merge(target[key] || {}, source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // In-memory fallback if localStorage unavailable
  let memoryState = null;
  let storageAvailable = (() => {
    try {
      const k = '__hajj_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function load() {
    if (!storageAvailable) {
      return memoryState ? memoryState : JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const parsed = JSON.parse(raw);
      // v2.2 — migrate legacy schema before merging
      migrate(parsed);
      // Merge into default to handle schema additions
      return merge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
    } catch (e) {
      console.warn('Store: failed to parse, using defaults', e);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  /**
   * v2.2 — Migrate legacy state shapes in place. Idempotent: running it twice
   * on the same object is a no-op. Each migration block converts old → new
   * and removes the old field so subsequent loads see the new shape.
   */
  function migrate(state) {
    if (!state || !state.config) return;
    const c = state.config;

    // 1. Single hotel → array of hotels (v2.1 → v2.2)
    if (c.madinahHotel && !c.madinahHotels) {
      c.madinahHotels = c.madinahHotel.name
        ? [{
            name: c.madinahHotel.name || '',
            address: c.madinahHotel.address || '',
            placeId: c.madinahHotel.placeId || '',
            lat: c.madinahHotel.lat || null,
            lng: c.madinahHotel.lng || null,
            fromDate: '',
            toDate: '',
          }]
        : [];
      delete c.madinahHotel;
    }
    if (c.makkahHotel && !c.makkahHotels) {
      c.makkahHotels = c.makkahHotel.name
        ? [{
            name: c.makkahHotel.name || '',
            address: c.makkahHotel.address || '',
            placeId: c.makkahHotel.placeId || '',
            lat: c.makkahHotel.lat || null,
            lng: c.makkahHotel.lng || null,
            fromDate: '',
            toDate: '',
          }]
        : [];
      delete c.makkahHotel;
    }
  }

  function save(state) {
    if (!storageAvailable) {
      memoryState = state;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Store: failed to save', e);
      memoryState = state;
    }
  }

  // Public API
  const Store = {
    get() { return load(); },

    set(partial) {
      const current = load();
      const updated = merge(current, partial);
      save(updated);
      this._emit('change', updated);
      return updated;
    },

    reset() {
      if (storageAvailable) {
        localStorage.removeItem(STORAGE_KEY);
      }
      memoryState = null;
      this._emit('change', this.get());
    },

    // ── Subscribers
    _listeners: {},
    on(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
      return () => {
        this._listeners[event] = this._listeners[event].filter(x => x !== fn);
      };
    },
    _emit(event, payload) {
      (this._listeners[event] || []).forEach(fn => {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    },

    // ── Convenience accessors
    getConfig() { return this.get().config; },
    getMadhab() { return this.get().config.madhab; },
    isOnboarded() { return this.get().onboarded; },

    setNote(sectionId, value) {
      const s = this.get();
      s.notes[sectionId] = value;
      save(s);
      this._emit('note', { sectionId, value });
    },
    getNote(sectionId) { return this.get().notes[sectionId] || ''; },

    togglePacking(itemId) {
      const s = this.get();
      s.packing[itemId] = !s.packing[itemId];
      save(s);
      this._emit('packing', s.packing);
      return s.packing[itemId];
    },
    getPacking() { return this.get().packing; },

    setFontSize(level) {
      const s = this.get();
      s.preferences.fontSize = level;
      save(s);
      this._emit('fontsize', level);
    },

    markAudioDownloaded(duaId) {
      const s = this.get();
      s.audioCache[duaId] = true;
      save(s);
    },
  };

  global.Store = Store;
})(window);
