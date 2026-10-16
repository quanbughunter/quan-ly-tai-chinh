// Service worker: mở được khi mất mạng. Ưu tiên mạng (luôn lấy bản mới nhất), rơi về bản lưu khi không có mạng.
// Chỉ xử lý tệp cùng nguồn; các yêu cầu tới Supabase đi thẳng, không bao giờ bị lưu.
const CACHE = 'qltc-v10';
const ASSETS = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'vendor/supabase.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/theme-boot.js', 'js/main.js', 'js/store.js', 'js/ui.js', 'js/forms.js', 'js/components.js', 'js/calc.js',
  'js/fx.js', 'js/deals.js', 'js/scholarship.js', 'js/share.js', 'js/money.js', 'js/dates.js', 'js/model.js', 'js/quickadd.js', 'js/demo.js', 'js/theme.js',
  'js/screens/dashboard.js', 'js/screens/transactions.js', 'js/screens/income.js', 'js/screens/accounts.js', 'js/screens/debts.js',
  'js/screens/exchange.js', 'js/screens/dorm.js',
  'js/screens/scholarship.js', 'js/screens/settings.js', 'js/screens/login.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
