const CACHE_NAME = 'db-desaparecidos-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/github_db.js',
  '/js/robou.js',
  '/js/ia_ponte.js'
];

// Instalação
self.addEventListener('install', event => {
  self.skipWaiting(); // Garante que o novo SW assuma o controle imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Ativação: LIMPEZA DE CACHE ANTIGO
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Fetch: Prioridade para o cache, depois rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
