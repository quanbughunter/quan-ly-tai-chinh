// Dựng giao diện React: mã nguồn trong web/ (index.html, src/, public/), kết quả ra dist/ (thư mục này được đưa lên Pages và vào APK).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve('web');

// Thông tin phiên bản nhúng vào app (hiện ở Cài đặt và màn Đăng nhập — xem web/js/appinfo.js).
// Trên GitHub Actions có sẵn GITHUB_RUN_NUMBER và GITHUB_SHA; dựng trên máy thì ghi "dev"/"local".
const CI_RUN = process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_RUN_NUMBER : '';
const APP_INFO = {
  version: CI_RUN ? `1.0.${CI_RUN}` : 'dev',
  commit: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local',
  builtAt: new Date().toISOString(),
};

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
  define: { __APP_INFO__: JSON.stringify(APP_INFO) },
  plugins: [react(), tailwindcss(), precacheManifest()],
  resolve: { alias: { '@': join(ROOT, 'src'), '@logic': join(ROOT, 'js') } },
  build: { outDir: resolve('dist'), emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 1200, assetsInlineLimit: 0 },
  server: { port: 5173, host: true },
  preview: { port: 4173 },
});
