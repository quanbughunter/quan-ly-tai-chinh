import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mọi tệp mà manifest, index.html và service worker nhắc tới phải có thật:
// thiếu một tệp trong danh sách ASSETS của sw.js là cả lần cài service worker thất bại.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const pngSize = (file) => {
  const b = readFileSync(file);
  assert.equal(b.subarray(1, 4).toString(), 'PNG', `${file} không phải PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('icon trong manifest có thật và đúng kích thước khai báo', () => {
  const m = JSON.parse(readFileSync(join(WEB, 'manifest.webmanifest'), 'utf8'));
  assert.ok(m.icons.length >= 3);
  for (const ic of m.icons) {
    const f = join(WEB, ic.src);
    assert.ok(existsSync(f), `thiếu ${ic.src}`);
    if (ic.type === 'image/png') {
      const [w, h] = ic.sizes.split('x').map(Number);
      assert.deepEqual(pngSize(f), [w, h], `${ic.src} không đúng ${ic.sizes}`);
    }
  }
});

test('icon trong index.html có thật (favicon + apple-touch-icon)', () => {
  const html = readFileSync(join(WEB, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((x) => x[1]);
  assert.ok(hrefs.length >= 2);
  for (const h of hrefs) assert.ok(existsSync(join(WEB, h)), `thiếu ${h}`);
  assert.deepEqual(pngSize(join(WEB, 'icons/apple-touch-icon.png')), [180, 180]);
});

test('mọi tệp trong ASSETS của sw.js đều tồn tại', () => {
  const sw = readFileSync(join(WEB, 'sw.js'), 'utf8');
  const block = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS')));
  const files = [...block.matchAll(/'([^']+)'/g)].map((x) => x[1]).filter((x) => x !== './');
  assert.ok(files.length > 20);
  for (const f of files) assert.ok(existsSync(join(WEB, f)), `sw.js nhắc tới ${f} nhưng không có tệp`);
});

test('nguồn icon Android đủ ba tệp 1024×1024', () => {
  for (const n of ['icon-only', 'icon-foreground', 'icon-background']) {
    assert.deepEqual(pngSize(join(ROOT, 'assets', `${n}.png`)), [1024, 1024], n);
  }
});

test('app dùng logo thay vì biểu tượng cảm xúc', () => {
  const main = readFileSync(join(WEB, 'js/main.js'), 'utf8');
  const login = readFileSync(join(WEB, 'js/screens/login.js'), 'utf8');
  assert.ok(main.includes("src: 'icons/icon.svg'") && login.includes("src: 'icons/icon.svg'"));
  assert.ok(!main.includes('💸') && !login.includes('💸'));
});
