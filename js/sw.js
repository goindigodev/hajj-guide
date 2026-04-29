/* =============================================================
   SERVICE WORKER — Enables full offline operation
   Cache-first strategy for static assets; network-first for data.
   ============================================================= */

const STATIC_CACHE = 'hajj-static-v1';
const DATA_CACHE = 'hajj-data-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './css/styles.css',
  './css/print.css',
  './js/utils.js',
  './js/store.js',
  './js/maps.js',
  './js/audio.js',
  './js/notes.js',
  './js/fontsize.js',
  './js/print.js',
  './js/onboarding.js',
  './js/guide.js',
  './js/app.js',
  './data/duas.json',
  './data/rulings.json',
  './data/itinerary-template.json',
  './manifest.json',
  // Fonts via Google Fonts will be cached on first request
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        // Don't fail install if some assets are missing
        console.warn('SW: some assets failed to cache', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(n => n !== STATIC_CACHE && n !== DATA_CACHE && n !== 'hajj-audio-v1')
          .map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Don't intercept Google Maps / Places API calls
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) {
    return;
  }

  // Don't intercept audio files (handled by Audio module's own cache)
  if (event.request.destination === 'audio' || url.pathname.endsWith('.mp3')) {
    return;
  }

  // For data files: network-first, fall back to cache
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (HTML, CSS, JS, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        // Only cache successful same-origin GETs
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // Last-resort offline page
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
