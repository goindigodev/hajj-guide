/* =============================================================
   v3.8 — Service worker DEPRECATED.

   Hajj Guide no longer uses a service worker. This file is kept
   in place only as a safety net for browsers that already had a
   previous SW registered: when the browser revalidates this file
   (which happens on every page visit due to no-cache headers),
   it sees this new content and replaces the old SW with this
   self-unregistering stub.

   To fully remove: delete this file in the user's local repo
   AND remove any reference to './js/sw.js' from app.js. After
   one full deployment cycle, no clients will be looking for it
   and it can be deleted.
   ============================================================= */

self.addEventListener('install', () => {
  // Skip waiting so we activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete every cache we own
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.startsWith('hajj-')).map(k => caches.delete(k))
      );
    } catch (e) { /* ignore */ }
    // Unregister ourselves
    try { await self.registration.unregister(); } catch (e) { /* ignore */ }
    // Reload all clients so they get fresh non-SW-intercepted assets
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.navigate(client.url));
    } catch (e) { /* ignore */ }
  })());
});

// Fall through to network on every fetch — never serve from cache
self.addEventListener('fetch', () => {
  // Don't call respondWith — let the browser handle it normally
});
