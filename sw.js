// SW minimale: cache statici di base
const CACHE = 'casa-static-v1';
const ASSETS = [
  './', './index.html', './style.css', './config.js', './jsonp.js', './app.js',
  './manifest.webmanifest',
  './icons/house-192.png','./icons/house-512.png','./icons/house-maskable-192.png','./icons/house-maskable-512.png'
];
self.addEventListener('install', (e)=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', (e)=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener('fetch', (e)=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request))); });
