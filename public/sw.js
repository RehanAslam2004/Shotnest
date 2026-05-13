const CACHE_NAME = 'shotnest-cache-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/studio.html',
    '/CSS/style.css',
    '/js/create.js',
    '/js/app.js',
    '/js/theme.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching essential assets');
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Event — Bug 9 fix: Network-first for API routes, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache API calls or socket.io — always go to network
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // For everything else, try cache first, then network
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
