'use strict';

// Increment this value for every deployed web build.
const CACHE_NAME = 'jackpot-shell-v2026.06.28-04';
const APP_BASE = new URL('./', self.location.href);
const INDEX_URL = new URL('./index.html', APP_BASE).href;
const CORE_ASSETS = [
  new URL('./', APP_BASE).href,
  INDEX_URL,
  new URL('./manifest.webmanifest', APP_BASE).href,
  new URL('./icon-192.png', APP_BASE).href,
  new URL('./icon-512.png', APP_BASE).href,
  new URL('./icon-maskable-192.png', APP_BASE).href,
  new URL('./icon-maskable-512.png', APP_BASE).href,
  new URL('./apple-touch-icon.png', APP_BASE).href,
  new URL('./favicon-32.png', APP_BASE).href
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('jackpot-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(INDEX_URL)) ||
      new Response('Jackpot is offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // External market APIs and Google Sheets stay network-only.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // Never cache live API-like paths, CSV/JSON feeds, or Google visualization requests.
  if (/\/(api|apis)\//i.test(url.pathname) ||
      /\.(csv|json)$/i.test(url.pathname) ||
      /(?:gviz|spreadsheets)/i.test(url.href)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (/\.(?:png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
