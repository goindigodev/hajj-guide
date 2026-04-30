/* =============================================================
   STOPS — User-added itinerary stops (Ziyarat etc.)
   - Many stops per ISO date.
   - Each stop: { id, place, placeId (optional), startTime, endTime }
     - id: unique within the date
     - place: display name (free text or curated name)
     - placeId: optional id from data/ziyarat-places.json (null for free text)
     - startTime/endTime: 'HH:MM' strings, optional
   - Stored at Store.stops as { 'YYYY-MM-DD': [stop, ...] }
   ============================================================= */

(function (global) {
  'use strict';

  const Stops = {
    _places: null,          // loaded from data/ziyarat-places.json
    _placesPromise: null,   // de-dupe concurrent loads

    /**
     * Lazy-load the curated places list. Returns a Promise that resolves to
     * the array of place objects. Cached after first load.
     */
    loadPlaces() {
      if (this._places) return Promise.resolve(this._places);
      if (this._placesPromise) return this._placesPromise;
      this._placesPromise = fetch('./data/ziyarat-places.json')
        .then(r => r.ok ? r.json() : { places: [] })
        .then(d => {
          this._places = (d && d.places) || [];
          return this._places;
        })
        .catch(() => {
          this._places = [];
          return this._places;
        });
      return this._placesPromise;
    },

    /**
     * Synchronous accessor — returns the cached list or [] if not yet loaded.
     */
    placesNow() {
      return this._places || [];
    },

    /**
     * Get all stops for a date (chronological by startTime if set).
     * Returns [] if no stops.
     */
    forDate(dateIso) {
      const state = (typeof Store !== 'undefined') ? Store.get() : null;
      if (!state || !state.stops || !state.stops[dateIso]) return [];
      const arr = state.stops[dateIso].slice();
      arr.sort((a, b) => {
        const at = a.startTime || '99:99';
        const bt = b.startTime || '99:99';
        if (at !== bt) return at.localeCompare(bt);
        return (a.place || '').localeCompare(b.place || '');
      });
      return arr;
    },

    /**
     * Add a new stop to a date. Returns the new stop's id.
     */
    add(dateIso, stop) {
      if (!dateIso || !stop || !stop.place) return null;
      const state = Store.get() || {};
      const stops = state.stops ? { ...state.stops } : {};
      const list = stops[dateIso] ? stops[dateIso].slice() : [];
      const newStop = {
        id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        place: String(stop.place).trim(),
        placeId: stop.placeId || null,
        startTime: stop.startTime || '',
        endTime: stop.endTime || '',
      };
      list.push(newStop);
      stops[dateIso] = list;
      Store.set({ stops });
      return newStop.id;
    },

    /**
     * Update an existing stop by id. Pass partial fields.
     * Returns true if found and updated, false otherwise.
     */
    update(dateIso, stopId, patch) {
      if (!dateIso || !stopId) return false;
      const state = Store.get() || {};
      const stops = state.stops ? { ...state.stops } : {};
      const list = stops[dateIso] ? stops[dateIso].slice() : [];
      const idx = list.findIndex(s => s.id === stopId);
      if (idx < 0) return false;
      const merged = {
        ...list[idx],
        place: patch.place !== undefined ? String(patch.place).trim() : list[idx].place,
        placeId: patch.placeId !== undefined ? patch.placeId : list[idx].placeId,
        startTime: patch.startTime !== undefined ? patch.startTime : list[idx].startTime,
        endTime: patch.endTime !== undefined ? patch.endTime : list[idx].endTime,
      };
      // If the resulting place is empty, treat as a delete (storage hygiene)
      if (!merged.place) {
        list.splice(idx, 1);
      } else {
        list[idx] = merged;
      }
      if (list.length) stops[dateIso] = list;
      else delete stops[dateIso];
      Store.set({ stops });
      return true;
    },

    /**
     * Remove a stop by id.
     */
    remove(dateIso, stopId) {
      if (!dateIso || !stopId) return false;
      const state = Store.get() || {};
      const stops = state.stops ? { ...state.stops } : {};
      const list = stops[dateIso] ? stops[dateIso].slice() : [];
      const idx = list.findIndex(s => s.id === stopId);
      if (idx < 0) return false;
      list.splice(idx, 1);
      if (list.length) stops[dateIso] = list;
      else delete stops[dateIso];
      Store.set({ stops });
      return true;
    },

    /**
     * Total number of stops across all dates.
     */
    count() {
      const state = (typeof Store !== 'undefined') ? Store.get() : null;
      if (!state || !state.stops) return 0;
      let n = 0;
      Object.values(state.stops).forEach(arr => { n += (arr && arr.length) || 0; });
      return n;
    },

    /**
     * Format a stop's time range for display: "09:00 – 11:00", "From 09:00", "Until 11:00", or ''.
     */
    formatTimeRange(stop) {
      if (!stop) return '';
      const s = (stop.startTime || '').trim();
      const e = (stop.endTime || '').trim();
      if (s && e) return `${s} – ${e}`;
      if (s) return `From ${s}`;
      if (e) return `Until ${e}`;
      return '';
    },
  };

  global.Stops = Stops;
})(window);
