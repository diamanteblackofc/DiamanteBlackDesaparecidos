const CACHE_NAME = 'db-desaparecidos-v2'; // Versão atualizada para forçar limpeza do cache antigo
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/github_db.js',
  './js/robou.js',
  './js/ia_ponte.js',
  './css/estilo.css' // ✅ ADICIONADO: Agora o CSS é cacheado para funcionar offline
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignorar cache para requisições de API externas (GitHub, OpenRouter, HuggingFace)
  if (event.request.url.includes("api.github.com") || 
      event.request.url.includes("openrouter.ai") || 
      event.request.url.includes("hf.space")) {
    return;
  }

  // Estratégia: Cache First, com fallback para rede
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        // Se estiver no cache, retorna, mas atualiza o cache em segundo plano (Stale-While-Revalidate)
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => response);
        
        return response;
      }
      // Se não estiver no cache, busca na rede
      return fetch(event.request);
    })
  );
});
