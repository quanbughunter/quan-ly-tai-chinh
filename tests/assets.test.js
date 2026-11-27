import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Giao diện được Vite dựng từ web/ (index.html + src/) và sao chép nguyên web/public/ vào dist/.
// Các test này giữ cho những thứ Vite KHÔNG tự kiểm được không bị hỏng: icon, manifest, service worker, workflow.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const PUB = join(WEB, 'public');
const read = (f) => readFileSync(f, 'utf8');
const pngSize = (file) => {
  const b = readFileSync(file);
  assert.equal(b.subarray(1, 4).toString(), 'PNG', `${file} không phải PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('icon trong manifest có thật và đúng kích thước khai báo', () => {
  const m = JSON.parse(read(join(PUB, 'manifest.webmanifest')));
  assert.ok(m.icons.length >= 3);
  for (const ic of m.icons) {
    const f = join(PUB, ic.src);
    assert.ok(existsSync(f), `thiếu ${ic.src}`);
    if (ic.type === 'image/png') {
      const [w, h] = ic.sizes.split('x').map(Number);
      assert.deepEqual(pngSize(f), [w, h], `${ic.src} không đúng ${ic.sizes}`);
    }
  }
});

test('index.html: icon có thật, tệp chạy trước React có thật, đường dẫn tương đối', () => {
  const html = read(join(WEB, 'index.html'));
  const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((x) => x[1]);
  assert.ok(hrefs.length >= 3);
  for (const h of hrefs) {
    assert.ok(!h.startsWith('/'), `${h}: phải là đường dẫn tương đối (Pages chạy ở thư mục con, APK chạy từ gốc riêng)`);
    assert.ok(existsSync(join(PUB, h)), `thiếu ${h} trong web/public`);
  }
  for (const s of ['theme-boot.js', 'config.js', 'vendor/supabase.js']) {
    assert.ok(html.includes(`src="${s}"`), `index.html phải nạp ${s}`);
    assert.ok(existsSync(join(PUB, s)), `thiếu ${s} trong web/public`);
  }
  assert.ok(html.includes('src="/src/main.jsx"'), 'index.html phải nạp /src/main.jsx');
  assert.deepEqual(pngSize(join(PUB, 'icons/apple-touch-icon.png')), [180, 180]);
});

test('sw.js là bản mẫu để vite.config.js điền danh sách tệp lúc dựng', () => {
  const sw = read(join(PUB, 'sw.js'));
  assert.ok(sw.includes('/*__PRECACHE__*/[]'), 'thiếu dấu /*__PRECACHE__*/[] (plugin precache sẽ báo lỗi khi dựng)');
  assert.ok(sw.includes("'qltc-dev'"), "thiếu tên bộ nhớ đệm 'qltc-dev' (plugin đổi tên theo từng bản dựng)");
  const cfg = read(join(ROOT, 'vite.config.js'));
  assert.ok(cfg.includes('__PRECACHE__') && cfg.includes('qltc-dev'));
});

test('capacitor.config.json trỏ tới dist (thư mục Vite dựng ra)', () => {
  const c = JSON.parse(read(join(ROOT, 'capacitor.config.json')));
  assert.equal(c.webDir, 'dist');
});

test('nguồn icon Android đủ ba tệp 1024×1024', () => {
  for (const n of ['icon-only', 'icon-foreground', 'icon-background']) {
    assert.deepEqual(pngSize(join(ROOT, 'assets', `${n}.png`)), [1024, 1024], n);
  }
});

test('app dùng logo thay vì biểu tượng cảm xúc', () => {
  const nav = read(join(WEB, 'src/app/nav.jsx'));
  const login = read(join(WEB, 'src/screens/login.jsx'));
  assert.ok(nav.includes('icons/icon.svg') && login.includes('icons/icon.svg'));
  assert.ok(!nav.includes('💸') && !login.includes('💸'));
});

test('workflow: dựng bằng npm ci + npm run build, config.js ghi vào web/public, Pages đưa dist lên', () => {
  const pages = read(join(ROOT, 'setup/github-workflows/pages.yml'));
  const apk = read(join(ROOT, 'setup/github-workflows/android.yml'));
  for (const [name, y] of [['pages.yml', pages], ['android.yml', apk]]) {
    assert.ok(y.includes('npm ci'), `${name}: dùng npm ci`);
    assert.ok(y.includes('npm run build'), `${name}: phải chạy npm run build trước khi dùng dist`);
    assert.ok(y.includes('web/public/config.js') && !/['"]web\/config\.js['"]/.test(y), `${name}: config.js nằm ở web/public/`);
    assert.ok(/node-version:\s*22/.test(y), `${name}: Vite 8 cần Node 20.19+ hoặc 22+`);
  }
  assert.ok(/path:\s*dist\b/.test(pages), 'pages.yml phải đưa thư mục dist lên');
  assert.ok(apk.indexOf('npm run build') < apk.indexOf('cap add android'), 'android.yml: dựng giao diện trước khi cap add');
  assert.ok(apk.indexOf('npm run build') < apk.indexOf('cap sync'), 'android.yml: dựng giao diện trước khi cap sync');
});
