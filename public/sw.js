// Auto-versioned cache — changes every build via build timestamp
// BUILD_VERSION gets replaced by build script, or defaults to timestamp.
// Hand-bumped on Apr 27 2026 because the workout-mode logged-set edit
// fix from PR #68 wasn't reaching iOS PWA users — sticky home-screen
// tab was holding the previous JS bundle. This bump forces the SW to
// purge the old cache and notify all open clients to reload.
const APP_VERSION = '1774265000';
const CACHE_NAME = `guns-up-cache-${APP_VERSION}`;
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — cache static assets only, skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — delete ALL old caches, claim clients, notify them to reload
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('guns-up-cache-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
      .then(() => {
        // Notify all open tabs that an update is available
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
          });
        });
      })
  );
});

// Fetch — network-first for pages/API, cache-first for static assets only
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin
  if (url.origin !== self.location.origin) return;

  // API calls and page navigations — always network first
  if (url.pathname.startsWith('/api/') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/') || new Response('Offline', { status: 503 });
        }
        return new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Next.js chunks — network first, cache for offline
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (icons, manifest) — cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Listen for skip-waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle notification clicks — focus existing window if it's at the
// target URL, else navigate the existing window, else open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // If the window is already on the target URL, just focus it.
        try {
          const u = new URL(client.url);
          if (u.pathname === new URL(targetUrl, self.location.origin).pathname) {
            if ('focus' in client) return client.focus();
          }
        } catch {
          // ignore URL-parse failures and fall through
        }
      }
      // Otherwise focus the first window AND navigate it. If there's
      // no window at all, open a fresh one.
      if (clientList.length > 0 && 'navigate' in clientList[0]) {
        return clientList[0].navigate(targetUrl).then(() => clientList[0].focus());
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});

// Web Push receive — Phase 2C. The server's sendPush helper enveloped
// a JSON payload via web-push; we decode and surface as a system
// notification. Defensive: if the payload is malformed or empty, fall
// back to a generic title/body so the operator still sees SOMETHING
// rather than a silent push.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    try {
      data = { body: event.data ? event.data.text() : '' };
    } catch {
      data = {};
    }
  }
  const title = data.title || 'GUNS UP';
  const body = data.body || 'Daily Ops update';
  const tag = data.tag || undefined;
  const url = data.url || '/plan';
  const silent = data.silent === true;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      silent,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    }),
  );
});
