const CACHE_NAME = 'tepeguei-app-cache-v3'; // Increment version for new build
const ASSETS_TO_CACHE = [
  '/', // Caches index.html at the root
  '/assets/main.js', // Assuming your build process outputs main.js to an assets folder
  // Add other static assets output by your build process (e.g., CSS files, chunks)
  // '/assets/vendor.js', 
  // '/assets/styles.css',
  '/icon.svg',
  '/manifest.json',
  'https://cdn.tailwindcss.com' // Tailwind CSS (can also be bundled)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell and built assets');
        return Promise.all(
          ASSETS_TO_CACHE.map(assetUrl => {
            return cache.add(assetUrl).catch(err => {
              console.warn(`Service Worker: Failed to cache ${assetUrl}`, err);
            });
          })
        );
      })
      .catch(err => {
        console.error('Service Worker: Cache open/addAll failed during install:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated and old caches cleared.');
      return self.clients.claim(); // Ensure new SW takes control immediately
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For navigation requests, try network first, then cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200 && request.method === 'GET') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match(request)) 
    );
    return;
  }

  // For other requests (assets, scripts, styles)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // Serve from cache if found
        }

        // Not in cache, fetch from network
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            // Cache external resources like esm.sh scripts or other CDNs dynamically if not bundled
            if (request.url.startsWith('https://esm.sh/') || 
                request.url.startsWith('https://cdn.tailwindcss.com')) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
          }
          return networkResponse;
        }).catch(error => {
          console.error('Service Worker: Fetch failed for:', request.url, error);
          throw error;
        });
      })
  );
});