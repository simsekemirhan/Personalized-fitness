/* MogFitness · Service Worker
   Uygulama kabuğunu önbelleğe alır; çevrimdışı açılışı destekler.
   Sunucuya kullanıcı verisi gönderilmez. Tüm kayıtlar localStorage'dadır. */
const VERSION = 'mogfitness-v10';
const BASE = new URL('./', self.location.href);
const abs = function (p) { return new URL(p, BASE).href; };
const SHELL = [abs('./'), abs('index.html'), abs('manifest.webmanifest'), abs('icon.svg'), abs('logo-mark.svg')];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== VERSION && (k.indexOf('mogfitness-') === 0 || k.indexOf('emirhan-fit-') === 0);
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* Sayfa açılışları: ağ öncelikli, çevrimdışıysa önbellek */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        try {
          const copy = res.clone();
          caches.open(VERSION).then(function (cache) { cache.put(abs('index.html'), copy); });
        } catch (e) {}
        return res;
      }).catch(function () {
        return caches.match(abs('index.html')).then(function (hit) {
          return hit || caches.match(abs('./'));
        });
      })
    );
    return;
  }

  /* Statik varlıklar: önbellek öncelikli, arka planda sessiz güncelleme */
  event.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req).then(function (res) {
        try {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSION).then(function (cache) { cache.put(req, copy); });
          }
        } catch (e) {}
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) return;
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
