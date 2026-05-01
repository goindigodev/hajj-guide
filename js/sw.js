/* =============================================================
   SERVICE WORKER — Enables full offline operation
   Cache-first strategy for static assets; network-first for data.

   v3.6 — Versioned cache names so each release invalidates previous
   caches. To ship a new version, bump BUILD_VERSION below — that's
   the only change required for users to receive new code.

   On activate, all caches not matching the current BUILD_VERSION are
   deleted, ensuring users never see a half-old / half-new mix.
   ============================================================= */

// ─── Bump this on every release ──────────────────────────────────
// Format: 'major.minor' (e.g. '3.6'). The cache names below derive
// from this value, so changing it triggers reinstall of all assets.
const BUILD_VERSION = '3.7';

// Cache names — derive from BUILD_VERSION so they auto-bump together
const STATIC_CACHE = `hajj-static-${BUILD_VERSION}`;
const DATA_CACHE   = `hajj-data-${BUILD_VERSION}`;
const AUDIO_CACHE  = 'hajj-audio-v1'; // Audio is independently versioned and managed by the Audio module

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
  './js/userguide.js',
  './js/share.js',
  './js/disclaimer.js',
  './js/journal.js',
  './js/stops.js',
  './data/duas.json',
  './data/rulings.json',
  './data/itinerary-template.json',
  './data/airports.json',
  './data/operators.json',
  './data/ziyarat-places.json',
  './manifest.json',
  // Fonts via Google Fonts will be cached on first request
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: some assets failed to cache', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      const allowed = new Set([STATIC_CACHE, DATA_CACHE, AUDIO_CACHE]);
      return Promise.all(
        names
          .filter(n => !allowed.has(n))
          .map(n => {
            console.log('SW: deleting old cache', n);
            return caches.delete(n);
          })
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

  // v3.6 — HTML files use network-first so users always get the latest shell.
  const isHTML = event.request.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/';
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put(event.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
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

  // Cache-first for everything else (CSS, JS, fonts, images)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// v3.6 — Allow the page to query the SW's version and to trigger
// skipWaiting from the page (used by the "new version available" toast)
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: BUILD_VERSION });
    }
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
