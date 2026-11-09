// Englove Service Worker (SPEC-09 ENG-110)
// Precaches static build assets & /offline.
// NEVER caches authenticated API responses (/api/v1/*), R2 signed URLs, HTML documents, or RSC payloads in Cache Storage.

const CACHE_VERSION = 'englove-static-v1';
const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // Precache static assets without automatic skipWaiting (RF-2, RF-3)
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Continue even if an optional static asset fails to precache
        console.warn('[SW] Precache partial error:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean old precaches on activate (RF-3)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('englove-static-') && cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Non-GET requests pass through without cache interaction
  if (request.method !== 'GET') {
    return;
  }

  // 2. Authenticated API endpoints (/api/v1/*) and R2 signed URLs:
  // MUST ALWAYS go to network and NEVER be stored in Cache Storage (RF-4, G-C13)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('r2.cloudflarestorage.com') ||
    url.pathname.includes('/media/') ||
    url.searchParams.has('X-Amz-Signature')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        // Let it fail as network error so client queue / error handler can process it
        return Promise.reject(new TypeError('Network request failed'));
      })
    );
    return;
  }

  // 3. Navigation requests (HTML / RSC):
  // Always fetch from network; never store HTML or RSC in Cache Storage (RF-3).
  // If offline/network fails, fallback to cached /offline page.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cachedOffline = await cache.match('/offline');
        if (cachedOffline) {
          return cachedOffline;
        }
        return new Response('Sin conexión. Por favor reintenta cuando tengas conexión a internet.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    return;
  }

  // 4. Static assets (precached or immutable static assets):
  // Try network first with fallback to cache, or cache first for precached assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request);
    })
  );
});
