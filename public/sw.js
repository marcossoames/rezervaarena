// Service Worker for efficient caching strategy
const CACHE_NAME = 'sportbook-v2';
const STATIC_CACHE_NAME = 'sportbook-static-v2';
const DYNAMIC_CACHE_NAME = 'sportbook-dynamic-v2';

// Assets to cache immediately (critical resources)
const STATIC_ASSETS = [
  '/',
  '/assets/hero-sports.jpg',
  // Add other critical assets as needed
];

// Cache strategies - Aggressive caching for static assets
const CACHE_STRATEGIES = {
  // Cache images for 1 year (static assets with hashes)
  images: {
    pattern: /\.(png|jpg|jpeg|webp|avif|svg|ico)$/i,
    strategy: 'cache-first',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
  // Cache JS/CSS for 1 year (they have content hashes)
  assets: {
    pattern: /\/assets\/.*\.(js|css)$/i,
    strategy: 'cache-first', 
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
  // Cache specific hashed assets aggressively
  hashedAssets: {
    pattern: /\/assets\/.+\-[a-zA-Z0-9_-]+\.(js|css|jpg|png|webp|avif)$/i,
    strategy: 'cache-first',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year for hashed assets
  },
  // Never cache authenticated API responses
  api: {
    pattern: /\/rest\/v1\//,
    strategy: 'network-only',
    maxAge: 0,
  },
  // Cache pages briefly
  pages: {
    pattern: /\.html$|^\/$/,
    strategy: 'network-first',
    maxAge: 60 * 60 * 1000, // 1 hour
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests except for known APIs
  if (url.origin !== location.origin && !url.href.includes('supabase.co')) {
    return;
  }

  // Never cache authenticated requests to prevent security issues
  if (request.headers.get('Authorization') || url.href.includes('/rest/v1/')) {
    return;
  }

  // Handle static assets with simple caching
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Determine cache strategy for other requests
  let strategy = null;
  let maxAge = null;
  
  for (const [key, config] of Object.entries(CACHE_STRATEGIES)) {
    if (config.pattern.test(url.pathname) || config.pattern.test(url.href)) {
      strategy = config.strategy;
      maxAge = config.maxAge;
      break;
    }
  }

  if (strategy) {
    event.respondWith(handleRequest(request, strategy, maxAge));
  }
});

// Handle requests based on strategy
async function handleRequest(request, strategy, maxAge) {
  const url = new URL(request.url);
  const cacheName = url.href.includes('supabase.co') ? DYNAMIC_CACHE_NAME : STATIC_CACHE_NAME;

  if (strategy === 'cache-first') {
    return cacheFirst(request, cacheName, maxAge);
  } else if (strategy === 'network-first') {
    return networkFirst(request, cacheName, maxAge);
  }
  
  return fetch(request);
}

// Cache-first strategy (for static assets)
async function cacheFirst(request, cacheName, maxAge) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cache is still valid
      const cachedTime = cachedResponse.headers.get('x-cached-time');
      if (cachedTime && Date.now() - parseInt(cachedTime) < maxAge) {
        return cachedResponse;
      }
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      // Add timestamp header
      const headers = new Headers(responseToCache.headers);
      headers.set('x-cached-time', Date.now().toString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(request, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    // Return cached version if network fails
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Network-first strategy (for dynamic content)
async function networkFirst(request, cacheName, maxAge) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      
      // Add timestamp header
      const headers = new Headers(responseToCache.headers);
      headers.set('x-cached-time', Date.now().toString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(request, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const cachedTime = cachedResponse.headers.get('x-cached-time');
      if (!cachedTime || Date.now() - parseInt(cachedTime) < maxAge) {
        return cachedResponse;
      }
    }
    
    return new Response('Offline', { status: 503 });
  }
}
