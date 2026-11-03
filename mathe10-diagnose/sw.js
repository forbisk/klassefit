/* Minimaler Service Worker (Unterrichtsseiten): NETZWERK ZUERST, kein Vorab-Cache, keine Eingriffe in POSTs
   oder fremde Adressen (Apps-Script, Autosync, Abgeben laufen unveraendert direkt ins Netz).
   Nur Seiten/Dateien DIESER Seite (GET) werden bei erfolgreichem Laden als Notfall-Kopie abgelegt und nur dann
   gezeigt, wenn das Netz GANZ ausfaellt – so wird nie eine alte Test-Version statt der aktuellen ausgeliefert. */
var CACHE = 'tfgs-pwa-v3:' + self.registration.scope;
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf('tfgs-pwa-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  var u = new URL(r.url);
  if (u.origin !== self.location.origin || u.pathname.indexOf(new URL(self.registration.scope).pathname) !== 0) return;
  e.respondWith((async function () {
    try {
      var res = await fetch(r.mode === 'navigate' ? r.url : r, r.mode === 'navigate' ? { cache: 'no-store', credentials: 'same-origin' } : undefined);
      // Weitergeleitete Navigation (z.B. alte Adresse -> neue Domain) NIE direkt zurueckgeben: Chrome verwirft
      // umgeleitete Antworten fuer Navigationen (redirect mode 'manual') => ERR_FAILED. Stattdessen echte Umleitung.
      if (r.mode === 'navigate' && res && (res.redirected || res.type === 'opaqueredirect')) return Response.redirect(res.url || r.url, 302);
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(r.mode === 'navigate' ? r.url : r, copy); }).catch(function () {}));
      }
      return res;
    } catch (err) {
      var hit = await caches.match(r.mode === 'navigate' ? r.url : r, { ignoreSearch: true });
      if (hit) return hit;
      if (r.mode === 'navigate') return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Keine Verbindung</h1><p>Bitte Internet pr\u00fcfen und die Seite neu laden.</p></body>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      throw err;
    }
  })());
});
