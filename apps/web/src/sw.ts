/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Englove Service Worker (SPEC-09 ENG-110, SPEC-11 RF-7, Decisión 135)
// Real Serwist Service Worker with build-hash precaching.
// NEVER caches authenticated API responses (/api/v1/*), R2 signed URLs, HTML documents, or RSC payloads in Cache Storage.

const serwist: Serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Cycle waiting -> SKIP_WAITING (RF-7): do NOT automatically skipWaiting,
  // wait until the client/PwaUpdateBanner issues SKIP_WAITING message.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // 1. Authenticated API endpoints (/api/v1/*), R2 signed URLs, media:
    // MUST ALWAYS go to network and NEVER be stored in Cache Storage (RF-4, G-C13)
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") ||
        url.hostname.includes("r2.cloudflarestorage.com") ||
        url.pathname.includes("/media/") ||
        url.searchParams.has("X-Amz-Signature") ||
        url.searchParams.has("X-Amz-Algorithm"),
      handler: new NetworkOnly(),
    },
    // 2. React Server Component (RSC) requests:
    // Always fetch from network; never store RSC in Cache Storage (RF-3, RF-7, Decisión 118, 135)
    {
      matcher: ({ request, url }) =>
        url.searchParams.has("_rsc") ||
        request.headers.get("RSC") === "1" ||
        request.headers.get("Next-Router-State-Tree") !== null,
      handler: new NetworkOnly(),
    },
    // 3. Navigation requests (HTML documents):
    // Always fetch from network; never store HTML documents in Cache Storage (RF-3).
    // If offline or network fails, fallback to cached /offline page.
    {
      matcher: ({ request }) =>
        request.mode === "navigate" || request.destination === "document",
      handler: new NetworkOnly({
        plugins: [
          {
            handlerDidError: async (): Promise<Response> => {
              const cachedOffline = await serwist.matchPrecache("/offline");
              if (cachedOffline) {
                return cachedOffline;
              }
              return new Response(
                "Sin conexión. Por favor reintenta cuando tengas conexión a internet.",
                {
                  status: 503,
                  statusText: "Service Unavailable",
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                },
              );
            },
          },
        ],
      }),
    },
    // 4. External fonts (e.g. Google Fonts):
    {
      matcher: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 4,
            maxAgeSeconds: 365 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 5. Static font assets (local or external):
    {
      matcher: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: new StaleWhileRevalidate({
        cacheName: "static-font-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 8,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 6. Static image assets (excluding API and R2/MinIO media):
    {
      matcher: ({ url }) =>
        /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i.test(url.pathname) &&
        !url.pathname.startsWith("/api/") &&
        !url.hostname.includes("r2.cloudflarestorage.com") &&
        !url.pathname.includes("/media/") &&
        !url.searchParams.has("X-Amz-Signature") &&
        !url.searchParams.has("X-Amz-Algorithm"),
      handler: new StaleWhileRevalidate({
        cacheName: "static-image-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document" || request.mode === "navigate";
        },
      },
    ],
  },
});

// Listen for message events for manual SKIP_WAITING from PwaUpdateBanner
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
