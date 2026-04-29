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
      this.apiKey = (window.APP_CONFIG && window.APP_CONFIG.googleMapsApiKey) || null;
      if (!this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        return;
      }
      this.loadPlacesScript();
    },

    /**
     * Load Google Places JS for autocomplete (used during onboarding).
     */
    loadPlacesScript() {
      if (this.placesLoaded || !this.apiKey) return;
      if (!(window.APP_CONFIG && window.APP_CONFIG.enablePlacesAutocomplete)) return;

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(this.apiKey)}&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.placesLoaded = true;
        if (window.google && window.google.maps && window.google.maps.places) {
          this.autocompleteService = new google.maps.places.AutocompleteService();
          // PlacesService needs a DOM node (any will do)
          const dummy = document.createElement('div');
          this.placesService = new google.maps.places.PlacesService(dummy);
        }
      };
      script.onerror = () => console.warn('Maps: failed to load Google Places');
      document.head.appendChild(script);
    },

    /**
     * Attach autocomplete to an <input> element.
     * onSelect receives { name, address, placeId, lat, lng }
     */
    attachAutocomplete(input, region, onSelect) {
      // If Places hasn't loaded, retry after a short delay
      if (!this.placesLoaded || !window.google) {
        setTimeout(() => this.attachAutocomplete(input, region, onSelect), 1000);
        return;
      }

      const center = region === 'madinah'
        ? { lat: 24.4672, lng: 39.6112 }   // Masjid an-Nabawi
        : { lat: 21.4225, lng: 39.8262 };  // Masjid al-Haram

      const ac = new google.maps.places.Autocomplete(input, {
        types: ['lodging', 'establishment'],
        bounds: new google.maps.LatLngBounds(
          { lat: center.lat - 0.05, lng: center.lng - 0.05 },
          { lat: center.lat + 0.05, lng: center.lng + 0.05 },
        ),
        strictBounds: false,
        fields: ['name', 'formatted_address', 'place_id', 'geometry'],
      });

      ac.addListener('place_changed', () => {
        const p = ac.getPlace();
        if (!p || !p.geometry) return;
        onSelect({
          name: p.name || '',
          address: p.formatted_address || '',
          placeId: p.place_id || '',
          lat: p.geometry.location.lat(),
          lng: p.geometry.location.lng(),
        });
      });
    },

    /**
     * Build an embed iframe URL for a place.
     * Uses Maps Embed API (free, no quota).
     */
    embedUrlForPlace(place) {
      if (!this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') return null;
      if (place.placeId) {
        return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(this.apiKey)}&q=place_id:${encodeURIComponent(place.placeId)}`;
      }
      if (place.lat && place.lng) {
        return `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(this.apiKey)}&center=${place.lat},${place.lng}&zoom=15`;
      }
      if (place.name) {
        return `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(this.apiKey)}&q=${encodeURIComponent(place.name)}`;
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

    // Pre-defined holy site coordinates
    PLACES: {
      masjidAlHaram: {
        name: 'Masjid al-Haram',
        placeId: 'ChIJlfO6QSJDwxURf2t01-yzqAM',
        lat: 21.4225, lng: 39.8262,
      },
      masjidAnNabawi: {
        name: 'Masjid an-Nabawi',
        placeId: 'ChIJsRDOZXg-3RUR3Em26VuFM2I',
        lat: 24.4672, lng: 39.6112,
      },
      mina: { name: 'Mina', lat: 21.4133, lng: 39.8933 },
      arafah: { name: 'Mount Arafat (Jabal ar-Rahmah)', lat: 21.3548, lng: 39.9847 },
      muzdalifah: { name: 'Muzdalifah', lat: 21.3833, lng: 39.9367 },
      jamarat: { name: 'Jamarat', lat: 21.4225, lng: 39.8742 },
      masjidQuba: { name: 'Masjid Quba', lat: 24.4393, lng: 39.6175 },
      uhud: { name: 'Mount Uhud', lat: 24.5022, lng: 39.6128 },
    },
  };

  global.Maps = Maps;
})(window);
