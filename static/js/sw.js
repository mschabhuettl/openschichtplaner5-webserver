/**
 * Enhanced Service Worker for OpenSchichtplaner5 PWA
 * Provides comprehensive offline capabilities, caching strategies, and security
 */

const CACHE_NAME = 'openschichtplaner5-v2.0.0';
const STATIC_CACHE = 'openschichtplaner5-static-v2';
const DYNAMIC_CACHE = 'openschichtplaner5-dynamic-v2';
const API_CACHE = 'openschichtplaner5-api-v2';

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/static/js/app.js',
    '/static/css/styles.css',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// API endpoints that should be cached
const CACHEABLE_API_PATTERNS = [
    /\/api\/employees$/,
    /\/api\/groups$/,
    /\/api\/tables$/,
    /\/api\/health$/
];

// Cache duration in milliseconds
const CACHE_DURATION = {
    STATIC: 30 * 24 * 60 * 60 * 1000, // 30 days
    API: 5 * 60 * 1000,               // 5 minutes
    DYNAMIC: 24 * 60 * 60 * 1000      // 1 day
};

// Install event - cache static resources
self.addEventListener('install', event => {
    console.log('SW: Installing Service Worker v2.0.0');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('SW: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('SW: All static assets cached successfully');
                // Force activation of new service worker
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('SW: Cache installation failed:', error);
            })
    );
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle different request types with appropriate strategies
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(request));
    } else if (isStaticAsset(request)) {
        event.respondWith(handleStaticAsset(request));
    } else if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(request));
    } else {
        // Default strategy for other requests
        event.respondWith(
            fetch(request).catch(() => caches.match(request))
        );
    }
});

// Handle API requests with stale-while-revalidate strategy
async function handleApiRequest(request) {
    const url = new URL(request.url);
    
    // Check if this API endpoint should be cached
    const shouldCache = CACHEABLE_API_PATTERNS.some(pattern => 
        pattern.test(url.pathname)
    );
    
    if (!shouldCache) {
        // Just fetch for non-cacheable APIs
        return fetch(request).catch(() => 
            new Response(JSON.stringify({ error: 'Offline' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503
            })
        );
    }
    
    try {
        const cache = await caches.open(API_CACHE);
        const cachedResponse = await cache.match(request);
        
        // Check if cached response is still fresh
        if (cachedResponse) {
            const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date') || 0);
            const now = new Date();
            
            if (now - cachedDate < CACHE_DURATION.API) {
                // Return fresh cached response
                return cachedResponse;
            }
        }
        
        // Fetch fresh data
        const response = await fetch(request);
        
        if (response.ok) {
            // Add timestamp and cache the response
            const responseToCache = response.clone();
            const headers = new Headers(responseToCache.headers);
            headers.set('sw-cached-date', new Date().toISOString());
            
            const modifiedResponse = new Response(await responseToCache.blob(), {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });
            
            cache.put(request, modifiedResponse);
        }
        
        return response;
        
    } catch (error) {
        // Network failed, return cached version if available
        const cache = await caches.open(API_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('SW: Serving stale API data for:', request.url);
            return cachedResponse;
        }
        
        // No cache available, return error response
        return new Response(JSON.stringify({ 
            error: 'Service unavailable',
            message: 'API is offline and no cached data available'
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
        });
    }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Not in cache, fetch and cache
        const response = await fetch(request);
        
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
        
    } catch (error) {
        // Try dynamic cache as fallback
        const dynamicCache = await caches.open(DYNAMIC_CACHE);
        const fallback = await dynamicCache.match(request);
        
        if (fallback) {
            return fallback;
        }
        
        throw error;
    }
}

// Handle navigation requests
async function handleNavigation(request) {
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            // Cache successful navigation responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        
        return response;
        
    } catch (error) {
        // Network failed, try cached version
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return cached homepage as fallback
        const fallback = await cache.match('/');
        if (fallback) {
            return fallback;
        }
        
        // Last resort: create offline page
        return new Response(createOfflinePage(), {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Helper function to identify static assets
function isStaticAsset(request) {
    return request.destination === 'style' ||
           request.destination === 'script' ||
           request.destination === 'image' ||
           request.destination === 'font' ||
           request.url.includes('/static/');
}

// Create offline fallback page
function createOfflinePage() {
    return `
    <!DOCTYPE html>
    <html lang="de" class="h-full">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OpenSchichtplaner5 - Offline</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="h-full bg-gray-50">
        <div class="min-h-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div class="text-center">
                    <div class="mx-auto h-24 w-24 bg-red-100 rounded-full flex items-center justify-center">
                        <svg class="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
                        Offline Modus
                    </h2>
                    <p class="mt-2 text-sm text-gray-600">
                        OpenSchichtplaner5 ist derzeit nicht verfügbar.<br>
                        Bitte überprüfen Sie Ihre Internetverbindung.
                    </p>
                </div>
                <div class="mt-8 space-y-4">
                    <button onclick="window.location.reload()" 
                            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                        Erneut versuchen
                    </button>
                    <div class="text-center">
                        <small class="text-gray-500">
                            Einige Funktionen sind im Offline-Modus möglicherweise nicht verfügbar.
                        </small>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
    console.log('SW: Activating Service Worker v2.0.0');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, CACHE_NAME];
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (!currentCaches.includes(cacheName)) {
                            console.log('SW: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all pages immediately
            self.clients.claim()
        ]).then(() => {
            console.log('SW: Service Worker activated and ready');
        })
    );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
    console.log('SW: Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        console.log('SW: Performing background sync');
        
        // Check if API is available
        const response = await fetch('/api/health');
        if (response.ok) {
            console.log('SW: API is available, notifying clients');
            
            // Notify all clients that we're back online
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'BACK_ONLINE',
                    timestamp: Date.now()
                });
            });
        }
    } catch (error) {
        console.log('SW: Still offline during background sync');
    }
}

// Message handling from main thread
self.addEventListener('message', event => {
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            console.log('SW: Skipping waiting, activating immediately');
            self.skipWaiting();
            break;
            
        case 'CACHE_URLS':
            if (data && data.urls) {
                event.waitUntil(cacheUrls(data.urls));
            }
            break;
            
        case 'CLEAR_CACHE':
            console.log('SW: Clearing all caches');
            event.waitUntil(clearAllCaches());
            break;
            
        case 'GET_CACHE_STATUS':
            event.waitUntil(sendCacheStatus(event.source));
            break;
    }
});

async function cacheUrls(urls) {
    const cache = await caches.open(DYNAMIC_CACHE);
    return cache.addAll(urls);
}

async function clearAllCaches() {
    const cacheNames = await caches.keys();
    return Promise.all(
        cacheNames.map(name => caches.delete(name))
    );
}

async function sendCacheStatus(client) {
    try {
        const cacheNames = await caches.keys();
        const cacheStatus = {};
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            cacheStatus[cacheName] = keys.length;
        }
        
        client.postMessage({
            type: 'CACHE_STATUS',
            data: cacheStatus
        });
    } catch (error) {
        console.error('SW: Failed to get cache status:', error);
    }
}

// Push notifications (for future enhancement)
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'Neue Nachricht von OpenSchichtplaner5',
        icon: '/static/icons/icon-192x192.png',
        badge: '/static/icons/badge-72x72.png',
        data: data.data || {},
        actions: [
            {
                action: 'view',
                title: 'Anzeigen'
            },
            {
                action: 'dismiss',
                title: 'Schließen'
            }
        ],
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };
    
    event.waitUntil(
        self.registration.showNotification(
            data.title || 'OpenSchichtplaner5',
            options
        )
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
    // 'dismiss' action just closes the notification
});

console.log('SW: Enhanced Service Worker v2.0.0 loaded with comprehensive PWA features');