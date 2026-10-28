/* 奇门穿壬 PWA Service Worker（策略同 Qimen-pwa：same-origin GET 用 stale-while-revalidate）
 * CACHE 名里的 __BUILD__ 由 scripts/build.js 换成内容哈希，每次发版自动作废旧缓存。
 */
const CACHE = 'qimen-chuanren-__BUILD__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((cs) => cs.forEach((c) => c.postMessage({ type: 'sw-updated', cache: CACHE })))
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const refresh = fetch(e.request)
        .then((resp) => { if (resp && resp.ok) cache.put(e.request, resp.clone()); return resp; })
        .catch(() => null);
      return cached || refresh.then((r) => r || new Response('offline', { status: 503 }));
    })
  );
});
