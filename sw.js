/* ============================================================
   Skyline — service worker
   Strategy:
     • navigations  → network first, offline fallback to cached shell
     • same-origin  → cache first, then network (and cache it)
     • cross-origin → untouched (weather APIs must always be fresh)
   Bump CACHE_VERSION when shipping new files.
   ============================================================ */

const CACHE_VERSION = 'skyline-v1';

const SHELL = [
  './',
  './index.html',
  './css/style.css?v=3',
  './js/app.js?v=3',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Weather data: never cache, always live.
  if (url.origin !== self.location.origin) return;

  // Page loads: fresh when online, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((hit) => hit || caches.match('./'))
            .then((hit) => hit || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
        )
    );
    return;
  }

  // Static assets: cache first.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => hit)
    )
  );
});
