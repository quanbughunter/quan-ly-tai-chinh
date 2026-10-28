// Dựng giao diện React: mã nguồn trong web/ (index.html, src/, public/), kết quả ra dist/ (thư mục này được đưa lên Pages và vào APK).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve('web');

/** Sau khi dựng: ghi danh sách tệp vào sw.js để mở được khi mất mạng ngay từ lần mở đầu tiên. */
function precacheManifest() {
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  let OUT = resolve('dist');
  return {
    name: 'qltc-precache',
    apply: 'build',
    configResolved(cfg) { OUT = resolve(cfg.root, cfg.build.outDir); },
    closeBundle() {
      const files = walk(OUT).map((p) => relative(OUT, p).split(sep).join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const swPath = join(OUT, 'sw.js');
      const sw = readFileSync(swPath, 'utf8');
      if (!sw.includes('/*__PRECACHE__*/[]')) throw new Error('sw.js thiếu dấu /*__PRECACHE__*/[]');
      const stamp = Date.now().toString(36);
      writeFileSync(swPath, sw.replace('/*__PRECACHE__*/[]', JSON.stringify(['./', ...files])).replace("'qltc-dev'", `'qltc-${stamp}'`));
      console.log(`sw.js: ${files.length} tệp được lưu sẵn cho chế độ ngoại tuyến (bản ${stamp}).`);
    },
  };
}

export default defineConfig({
  root: ROOT,
  base: './',
  publicDir: 'public',
  plugins: [react(), tailwindcss(), precacheManifest()],
  resolve: { alias: { '@': join(ROOT, 'src'), '@logic': join(ROOT, 'js') } },
  build: { outDir: resolve('dist'), emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 1200, assetsInlineLimit: 0 },
  server: { port: 5173, host: true },
  preview: { port: 4173 },
});
