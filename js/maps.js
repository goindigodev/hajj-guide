/* =============================================================
   MAPS — Google Maps Embed + Places Autocomplete
   Loads lazily. Falls back gracefully without an API key.
   ============================================================= */

(function (global) {
  'use strict';

  const Maps = {
    apiKey: null,
    placesLoaded: false,
    autocompleteService: null,
    placesService: null,

    init() {
      this._refreshKey();
      if (!this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        // Try again shortly — config.js may still be loading
        setTimeout(() => this.init(), 500);
        return;
      }
      this.loadPlacesScript();
    },

    /**
     * Re-read the API key from window.APP_CONFIG.
     * Called before any operation in case config.js arrived late.
     */
    _refreshKey() {
      this.apiKey = (window.APP_CONFIG && window.APP_CONFIG.googleMapsApiKey) || null;
      return this.apiKey;
    },

    /**
     * Load Google Places JS for autocomplete (used during onboarding).
     * Uses the modern API surface — google.maps.importLibrary('places').
     */
    loadPlacesScript() {
      if (this.placesLoaded || !this.apiKey) return;
      if (!(window.APP_CONFIG && window.APP_CONFIG.enablePlacesAutocomplete)) return;

      // Use Google's official inline-bootstrap loader so importLibrary works.
      // This is idempotent — Google's loader handles double-calls.
      if (!window.google || !window.google.maps || !window.google.maps.importLibrary) {
        const apiKey = this.apiKey;
        ((g) => {
          let h, a, k, p = 'The Google Maps JavaScript API', c = 'google',
              l = 'importLibrary', q = '__ib__', m = document, b = window;
          b = b[c] || (b[c] = {});
          const d = b.maps || (b.maps = {}), r = new Set(),
                e = new URLSearchParams(),
                u = () => h || (h = new Promise(async (f, n) => {
                  await (a = m.createElement('script'));
                  e.set('libraries', [...r] + '');
                  for (k in g) e.set(k.replace(/[A-Z]/g, t => '_' + t[0].toLowerCase()), g[k]);
                  e.set('callback', c + '.maps.' + q);
                  a.src = `https://maps.googleapis.com/maps/api/js?` + e;
                  d[q] = f;
                  a.onerror = () => h = n(Error(p + ' could not load.'));
                  a.nonce = m.querySelector('script[nonce]')?.nonce || '';
                  m.head.append(a);
                }));
          d[l] ? console.warn(p + ' only loads once. Ignoring:', g) :
                 d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
        })({ key: apiKey, v: 'weekly' });
      }

      // Mark loaded after the places library is fetched.
      google.maps.importLibrary('places').then(() => {
        this.placesLoaded = true;
      }).catch(err => {
        console.warn('Maps: failed to load Places library', err);
      });
    },

    /**
     * Attach autocomplete to a wrapper element.
     * Replaces the wrapper's child <input> with a PlaceAutocompleteElement.
     * onSelect receives { name, address, placeId, lat, lng }.
     */
    async attachAutocomplete(input, region, onSelect) {
      // If Places hasn't loaded, retry after a short delay
      if (!this.placesLoaded || !window.google || !google.maps.places ||
          !google.maps.places.PlaceAutocompleteElement) {
        setTimeout(() => this.attachAutocomplete(input, region, onSelect), 500);
        return;
      }

      const center = region === 'madinah'
        ? { lat: 24.4672, lng: 39.6112 }   // Masjid an-Nabawi
        : { lat: 21.4225, lng: 39.8262 };  // Masjid al-Haram

      try {
        // Create the new web component
        const ac = new google.maps.places.PlaceAutocompleteElement({
          locationBias: {
            radius: 8000, // 8 km — Mecca/Medina central area
            center: center,
          },
          includedPrimaryTypes: ['lodging'],
        });

        // Carry over placeholder + class for styling parity
        const placeholder = input.getAttribute('placeholder') || '';
        const initialValue = input.value || '';
        if (placeholder) ac.setAttribute('placeholder', placeholder);

        // Replace the input with the new element
        input.parentNode.replaceChild(ac, input);

        // If there was a previous value, the new element doesn't carry it —
        // best we can do is show it via shadow DOM after mount.
        if (initialValue) {
          // Try to set the inner input value once the shadow DOM is ready
          setTimeout(() => {
            try {
              const innerInput = ac.shadowRoot && ac.shadowRoot.querySelector('input');
              if (innerInput) innerInput.value = initialValue;
            } catch (e) { /* best effort */ }
          }, 100);
        }

        // Listen for place selection
        ac.addEventListener('gmp-select', async (event) => {
          try {
            const placePrediction = event.placePrediction;
            if (!placePrediction) return;
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'location', 'id'],
            });
            const loc = place.location;
            onSelect({
              name: place.displayName || '',
              address: place.formattedAddress || '',
              placeId: place.id || '',
              lat: loc ? (typeof loc.lat === 'function' ? loc.lat() : loc.lat) : null,
              lng: loc ? (typeof loc.lng === 'function' ? loc.lng() : loc.lng) : null,
            });
          } catch (err) {
            console.warn('Maps: gmp-select handler failed', err);
          }
        });
      } catch (err) {
        console.warn('Maps: failed to attach PlaceAutocompleteElement', err);
      }
    },

    /**
     * Build an embed iframe URL for a place.
     * Uses Maps Embed API (free, no quota).
     */
    embedUrlForPlace(place) {
      this._refreshKey();
      if (!this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') return null;
      // 1. Verified placeId (from Places autocomplete) — most accurate
      if (place.placeId) {
        return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(this.apiKey)}&q=place_id:${encodeURIComponent(place.placeId)}`;
      }
      // 2. Named place — search query with name shows a labelled marker
      if (place.name) {
        return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(this.apiKey)}&q=${encodeURIComponent(place.name)}`;
      }
      // 3. Coordinates only — last resort, no marker label
      if (place.lat && place.lng) {
        return `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(this.apiKey)}&center=${place.lat},${place.lng}&zoom=15`;
      }
      return null;
    },

    /**
     * Build directions embed (walking) between two locations.
     */
    directionsUrl(origin, destination) {
      if (!this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') return null;
      const o = origin.placeId ? `place_id:${origin.placeId}`
              : origin.lat ? `${origin.lat},${origin.lng}`
              : origin.name;
      const d = destination.placeId ? `place_id:${destination.placeId}`
              : destination.lat ? `${destination.lat},${destination.lng}`
              : destination.name;
      return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(this.apiKey)}&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&mode=walking`;
    },

    /**
     * Build a regular Google Maps URL (for "Open in Maps" links).
     */
    externalUrlForPlace(place) {
      if (place.placeId) {
        return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(place.placeId)}`;
      }
      if (place.lat && place.lng) {
        return `https://www.google.com/maps/?q=${place.lat},${place.lng}`;
      }
      if (place.name) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
      }
      return null;
    },

    /**
     * Calculate haversine distance in km between two points
     */
    haversine(a, b) {
      if (!a.lat || !b.lat) return null;
      const toRad = x => x * Math.PI / 180;
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const x = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);
      return 2 * R * Math.asin(Math.sqrt(x));
    },

    /**
     * Render an embed iframe into a container.
     */
    renderEmbed(container, place, options) {
      const opts = options || {};
      const url = this.embedUrlForPlace(place);
      container.innerHTML = '';
      container.classList.add('map-embed');
      container.setAttribute('data-place-name', place.name || '');

      if (!url) {
        const placeholder = Utils.el('div', { class: 'map-embed__placeholder' },
          Utils.el('p', null, place.name || 'No location set'),
          Utils.el('p', { style: { fontSize: '13px' } }, 'Map preview unavailable. Add Google Maps API key to enable.')
        );
        container.appendChild(placeholder);
        return;
      }

      const iframe = Utils.el('iframe', {
        src: url,
        loading: 'lazy',
        referrerpolicy: 'no-referrer-when-downgrade',
        allowfullscreen: '',
      });
      container.appendChild(iframe);

      // External link
      const ext = this.externalUrlForPlace(place);
      if (ext && opts.showOpenLink !== false) {
        const link = Utils.el('a', {
          href: ext, target: '_blank', rel: 'noopener',
          style: { display: 'block', textAlign: 'right', fontSize: '13px', marginTop: '4px', color: 'var(--green)' }
        }, '↗ Open in Google Maps');
        container.parentElement && container.parentElement.appendChild(link);
      }
    },

    // Pre-defined holy site coordinates.
    // We deliberately don't include placeIds here — the embed renders cleanly
    // from lat/lng + name, and unverified placeIds risk pointing to wrong locations.
    // User-added hotels DO carry placeIds (set at runtime by Places autocomplete).
    PLACES: {
      masjidAlHaram: {
        name: 'Masjid al-Haram, Mecca',
        lat: 21.4225, lng: 39.8262,
      },
      masjidAnNabawi: {
        name: 'Al-Masjid an-Nabawi, Medina',
        lat: 24.4672, lng: 39.6112,
      },
      mina: { name: 'Mina, Mecca', lat: 21.4133, lng: 39.8933 },
      arafah: { name: 'Mount Arafat (Jabal ar-Rahmah)', lat: 21.3548, lng: 39.9847 },
      muzdalifah: { name: 'Muzdalifah, Mecca', lat: 21.3833, lng: 39.9367 },
      jamarat: { name: 'Jamarat Bridge, Mina', lat: 21.4225, lng: 39.8742 },
      masjidQuba: { name: 'Quba Mosque, Medina', lat: 24.4393, lng: 39.6175 },
      uhud: { name: 'Mount Uhud, Medina', lat: 24.5022, lng: 39.6128 },
    },
  };

  global.Maps = Maps;
})(window);
