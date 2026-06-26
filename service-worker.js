/**
 * EI Construtor — Service Worker
 *
 * Estratégia: cache-first com revalidação em background.
 * Como o app é 100% offline (single-file HTML com localStorage),
 * o SW só precisa cachear o próprio arquivo e os ícones.
 *
 * Versão: incrementar a cada deploy pra forçar atualização nos clientes.
 */

const CACHE_VERSION = 'ei-construtor-v1.0.0';
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

// Instalação: pré-cache de todos os arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Cache aberto:', CACHE_VERSION);
        return cache.addAll(CACHE_FILES.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('[SW] Erro no pré-cache:', err);
      })
  );
});

// Ativação: limpa caches de versões antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_VERSION)
          .map((key) => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first, com atualização em background
self.addEventListener('fetch', (event) => {
  // Ignora requests não-GET (POST, PUT, etc. não fazem sentido aqui)
  if (event.request.method !== 'GET') return;

  // Ignora cross-origin (fotos no clipboard, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Atualização silenciosa em background (network-first secundário)
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Só guarda no cache se for resposta válida
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => null);

      // Retorna o cache imediatamente (rápido) e atualiza em background
      return cachedResponse || fetchPromise || new Response('Offline e sem cache', { status: 503 });
    })
  );
});

// Mensagens do app (para reload forçado, etc.)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
