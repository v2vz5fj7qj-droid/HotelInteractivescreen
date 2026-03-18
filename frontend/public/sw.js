// ════════════════════════════════════════════════
//  ConnectBé — Service Worker (Offline First)
// ════════════════════════════════════════════════

const CACHE_NAME  = 'connectbe-v1';
const API_CACHE   = 'connectbe-api-v1';

// Ressources statiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Installation : mise en cache des assets statiques ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyage des vieux caches ────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie Network First avec fallback cache ─
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls → Network first, cache 10 min en fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // Assets statiques → Cache first
  event.respondWith(cacheFirst(request));
});

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      // Stocker la réponse (cloner car body ne peut être lu qu'une fois)
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Réseau KO → retour cache
    const cached = await cache.match(request);
    if (cached) return cached;
    // Aucun cache → réponse d'erreur offline
    return new Response(
      JSON.stringify({ error: 'offline', _offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // App shell fallback
    const shell = await caches.match('/index.html');
    return shell || new Response('Offline', { status: 503 });
  }
}
