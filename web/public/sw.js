// Service worker: mở được khi mất mạng. Ưu tiên mạng (luôn lấy bản mới nhất), rơi về bản lưu khi không có mạng.
// Chỉ xử lý tệp cùng nguồn; các yêu cầu tới Supabase đi thẳng, không bao giờ bị lưu.
// Khi dựng (npm run build), vite.config.js ghi danh sách tệp vào PRECACHE và đổi tên bộ nhớ đệm theo từng bản.
const CACHE = 'qltc-dev';
const PRECACHE = /*__PRECACHE__*/[];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await caches.match('index.html'); if (idx) return idx; }
      return new Response('Ngoại tuyến', { status: 503, statusText: 'Offline' });
    }
  })());
});
