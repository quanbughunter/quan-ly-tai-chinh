#!/usr/bin/env node
/**
 * Acceptance run for the engine-proof milestone, in real Chromium:
 *   open → FreeText tiếng Việt (page 1 and the /Rotate 90 page) → highlight by
 *   text selection → undo/redo → positions at several zooms + view rotation →
 *   export → independent checks (Poppler, MuPDF, pdf.js) → reopen the export,
 *   move the text box, export again → check again.
 * Also asserts the app makes no request off its own origin and sends no
 * non-GET request (nothing is uploaded).
 *
 * Usage: node scripts/e2e.cjs            (starts its own Vite dev server)
 *        BASE=http://localhost:5179 node scripts/e2e.cjs
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'e2e');
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = path.join(ROOT, 'tests/fixtures/sample.pdf');
const TEXT1 = 'Xin chào! Tiếng Việt có dấu: ắ ằ ẳ ẵ ặ, ơ ư đ — Nguyễn Văn Ấn ký tên';
const TEXT2 = 'Trang xoay 90°: chữ vẫn đứng thẳng — Đã kiểm tra';
const A4 = { w: 595.2756, h: 841.8898 };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function startServer() {
  if (process.env.BASE) return { base: process.env.BASE, stop() {} };
  const port = 5181;
  const proc = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) return { base, stop: () => proc.kill('SIGTERM') };
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error('vite did not start');
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const requests = [];
  const errors = [];
  page.on('request', (r) => requests.push({ method: r.method(), url: r.url() }));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const origin = new URL(server.base).origin;

  const annots = () => page.evaluate(() => window.__ezpdf.annotations());
  const pageBox = (i) => page.locator(`[data-testid=page-${i}]`).boundingBox();
  // device (unrotated page-space points, y down) -> screen, for a page shown with total quarter-turns r
  async function toScreen(i, x, y, size = A4, r = 0) {
    const b = await pageBox(i);
    const { w, h } = size;
    let u, v; // normalized in displayed box
    if (r === 0) [u, v] = [x / w, y / h];
    else if (r === 1) [u, v] = [1 - y / h, x / w];
    else if (r === 2) [u, v] = [1 - x / w, 1 - y / h];
    else [u, v] = [y / h, 1 - x / w];
    return [b.x + u * b.width, b.y + v * b.height];
  }
  async function drag(from, to) {
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 5 });
    await page.mouse.move(...to, { steps: 5 });
    await page.mouse.up();
  }
  // Screen box of the FreeText on page i, normalized to the displayed page box.
  async function freeTextBoxNorm(i) {
    return page.evaluate((i) => {
      const pg = document.querySelector(`[data-testid=page-${i}]`).parentElement;
      const span = pg.querySelector('span[contenteditable]');
      if (!span) return null;
      const box = span.parentElement.getBoundingClientRect();
      const p = pg.getBoundingClientRect();
      return [(box.left - p.left) / p.width, (box.top - p.top) / p.height, box.width / p.width, box.height / p.height];
    }, i);
  }
  const near = (a, b, tol) => a.every((v, k) => Math.abs(v - b[k]) <= tol);
  async function exportTo(file) {
    const dl = page.waitForEvent('download');
    await page.click('[data-testid=btn-export]');
    const d = await dl;
    await d.saveAs(file);
    await page.waitForSelector('[data-testid=state-exported]', { timeout: 20000 });
    return d.suggestedFilename();
  }

  // 1. empty state, open
  await page.goto(server.base + '/');
  await page.waitForSelector('[data-testid=state-empty]', { timeout: 30000 });
  check('empty state shown before a file is opened', true);
  await page.setInputFiles('[data-testid=file-input]', FIXTURE);
  await page.waitForSelector('[data-testid=page-0]', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(1200);
  check('PDF opens and page 1 renders', (await pageBox(0)).width > 300);

  // 2. FreeText on page 1 by drag (72,230)-(372,290)
  await page.click('[data-testid=tool-text]');
  await drag(await toScreen(0, 72, 230), await toScreen(0, 372, 290));
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(TEXT1);
  await page.mouse.click(...(await toScreen(0, 450, 700)));
  await page.waitForTimeout(500);
  let list = await annots();
  const ft1 = list.find((a) => a.type === 3 && a.pageIndex === 0);
  check('FreeText created with Vietnamese contents', ft1 && ft1.contents === TEXT1, ft1 && JSON.stringify(ft1.contents));
  check(
    'FreeText rect in page space = dragged rect',
    ft1 && near([ft1.rect.origin.x, ft1.rect.origin.y, ft1.rect.size.width, ft1.rect.size.height], [72, 230, 300, 60], 1.5),
    ft1 && JSON.stringify(ft1.rect),
  );
  check('dirty indicator after editing', await page.isVisible('[data-testid=state-dirty]'));

  // 3. highlight by text selection over "Cộng hòa xã hội chủ nghĩa Việt Nam"
  await page.click('[data-testid=tool-highlight]');
  await drag(await toScreen(0, 73, 147), await toScreen(0, 288, 147));
  await page.waitForTimeout(600);
  list = await annots();
  const hl = list.find((a) => a.type === 9 && a.pageIndex === 0);
  check('highlight created from text selection', !!hl, hl && JSON.stringify(hl.rect));
  check('highlight covers the target text line (y 137–157)', hl && hl.rect.origin.y > 133 && hl.rect.origin.y + hl.rect.size.height < 161);

  // 4. undo / redo
  const before = (await annots()).length;
  await page.click('[data-testid=tool-select]');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const afterUndo = (await annots()).length;
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(300);
  const afterRedo = (await annots()).length;
  check('undo removes the last annotation, redo restores it', afterUndo === before - 1 && afterRedo === before, `${before}→${afterUndo}→${afterRedo}`);

  // 5. position across zoom levels and view rotation (page 1)
  const expected0 = [72 / A4.w, 230 / A4.h, 300 / A4.w, 60 / A4.h];
  const zoomSeq = ['btn-zoom-in', 'btn-zoom-in', 'btn-zoom-out', 'btn-zoom-out', 'btn-zoom-out'];
  let zoomOk = true;
  const zoomLog = [];
  for (const z of ['start', ...zoomSeq]) {
    if (z !== 'start') await page.click(`[data-testid=${z}]`);
    await page.waitForTimeout(450);
    await page.locator('[data-testid=page-0]').scrollIntoViewIfNeeded();
    const got = await freeTextBoxNorm(0);
    const lvl = await page.textContent('[data-testid=zoom-level]');
    zoomLog.push(lvl);
    if (!got || !near(got, expected0, 0.004)) {
      zoomOk = false;
      zoomLog.push(`MISMATCH ${JSON.stringify(got)}`);
    }
  }
  check('FreeText stays on the same page spot at every zoom', zoomOk, zoomLog.join(' '));
  await page.click('[data-testid=btn-rotate]');
  await page.waitForTimeout(500);
  await page.locator('[data-testid=page-0]').scrollIntoViewIfNeeded();
  const rot = await freeTextBoxNorm(0);
  const [u, v, w, h] = expected0;
  const expectedRot = [1 - v - h, u, h, w];
  check('FreeText follows the page when the view is rotated 90°', rot && near(rot, expectedRot, 0.004), JSON.stringify(rot));
  await page.screenshot({ path: path.join(OUT, 'view-rotated.png') });
  for (let k = 0; k < 3; k++) await page.click('[data-testid=btn-rotate]');
  await page.waitForTimeout(400);

  // 6. FreeText on page 2 (/Rotate 90): drawn in displayed coordinates
  await page.locator('[data-testid=page-1]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const b1 = await pageBox(1);
  await page.click('[data-testid=tool-text]');
  await drag([b1.x + b1.width * 0.45, b1.y + b1.height * 0.2], [b1.x + b1.width * 0.85, b1.y + b1.height * 0.32]);
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(TEXT2);
  await page.mouse.click(b1.x + b1.width * 0.2, b1.y + b1.height * 0.8);
  await page.waitForTimeout(500);
  list = await annots();
  const ft2 = list.find((a) => a.type === 3 && a.pageIndex === 1);
  check('FreeText on /Rotate 90 page is counter-rotated to read upright', ft2 && ft2.rotation === 270, ft2 && `rotation=${ft2.rotation}`);
  await page.screenshot({ path: path.join(OUT, 'page2-editor.png') });

  // 7. export
  const name1 = await exportTo(path.join(OUT, 'export-1.pdf'));
  check('export downloads a new file, original name kept apart', /\(ezPDF\)\.pdf$/.test(name1), name1);
  check('dirty indicator cleared after export', !(await page.isVisible('[data-testid=state-dirty]')));

  // 8. reopen the export, move the text box, export again
  await page.setInputFiles('[data-testid=file-input]', path.join(OUT, 'export-1.pdf'));
  await page.waitForTimeout(2500);
  list = await annots();
  const re1 = list.find((a) => a.type === 3 && a.pageIndex === 0);
  check(
    'reopened export: annotations come back as editable objects',
    list.filter((a) => a.type === 3).length === 2 && list.some((a) => a.type === 9) && re1?.contents === TEXT1,
    `${list.length} annotations`,
  );
  await page.screenshot({ path: path.join(OUT, 'reopened.png') });
  await page.click('[data-testid=tool-select]');
  const c = await toScreen(0, 222, 260);
  await page.mouse.click(...c);
  await page.waitForTimeout(250);
  await drag(c, [c[0] + (40 * (await pageBox(0)).width) / A4.w, c[1] + (20 * (await pageBox(0)).width) / A4.w]);
  await page.waitForTimeout(500);
  list = await annots();
  const moved = list.find((a) => a.type === 3 && a.pageIndex === 0);
  check('reopened FreeText can be moved', moved && near([moved.rect.origin.x, moved.rect.origin.y], [112, 250], 2), moved && JSON.stringify(moved.rect.origin));
  await page.mouse.click(...(await toScreen(0, 450, 760)));
  await exportTo(path.join(OUT, 'export-2.pdf'));

  // 9. independent viewers
  for (const [file, label] of [
    ['export-1.pdf', 'first export'],
    ['export-2.pdf', 'after reopen + move'],
  ]) {
    let py;
    try {
      py = execFileSync('python3', [path.join(ROOT, 'scripts/inspect_export.py'), path.join(OUT, file)], { encoding: 'utf8' });
    } catch (e) {
      py = e.stdout || String(e);
    }
    const info = JSON.parse(py);
    const ft = info.annots.filter((a) => a.type === 'FreeText');
    const p1 = ft.find((a) => a.page === 1);
    const p2 = ft.find((a) => a.page === 2);
    check(`[${label}] MuPDF reads Vietnamese from FreeText appearance (p1)`, p1 && p1.ap_text === TEXT1.replace(/\s+/g, ' '), p1 && JSON.stringify(p1.ap_text));
    check(`[${label}] MuPDF reads Vietnamese from FreeText appearance (p2)`, p2 && p2.ap_text === TEXT2.replace(/\s+/g, ' '), p2 && JSON.stringify(p2.ap_text));
    check(`[${label}] FreeText font embedded (pdffonts)`, info.vn_fonts_embedded > 0 && info.vn_fonts_not_embedded === 0, `embedded=${info.vn_fonts_embedded}`);
    check(`[${label}] p2 appearance turned to read upright on the rotated page`, p2 && p2.matrix && near(p2.matrix.slice(0, 4), [0, 1, -1, 0], 1e-3), p2 && JSON.stringify(p2.matrix));
    check(`[${label}] qpdf structure check`, info.qpdf_ok, info.qpdf_msg);
    check(`[${label}] Poppler renders without errors`, info.poppler_errors.length === 0, info.poppler_errors.join(' | '));
    if (label.startsWith('after')) check(`[${label}] moved position persisted`, p1 && near(p1.rect_device.slice(0, 2), [112, 250], 2), p1 && JSON.stringify(p1.rect_device));
  }

  // pdf.js (Firefox's engine) — third independent renderer
  const pj = await ctx.newPage();
  pj.on('request', (r) => requests.push({ method: r.method(), url: r.url(), testPage: true }));
  await pj.goto(server.base + '/tests/pdfjs-render.html');
  await pj.setInputFiles('#f', path.join(OUT, 'export-2.pdf'));
  await pj.waitForFunction(() => window.__pdfjsResult, null, { timeout: 30000 });
  const pjr = await pj.evaluate(() => window.__pdfjsResult);
  const pjFt = pjr.pages[0].find((a) => a.subtype === 'FreeText');
  check('pdf.js sees FreeText with appearance + Vietnamese contents', pjFt && pjFt.hasAppearance && pjFt.contents === TEXT1);
  for (const n of [1, 2]) await pj.locator(`canvas[data-page="${n}"]`).screenshot({ path: path.join(OUT, `pdfjs-p${n}.png`) });

  // 10. privacy: nothing left the device
  const external = requests.filter((r) => !r.url.startsWith(origin) && !/^(blob|data):/.test(r.url));
  const nonGet = requests.filter((r) => r.method !== 'GET' && !/^(blob|data):/.test(r.url));
  check('no request to any other origin', external.length === 0, external.map((r) => r.url).join(', '));
  check('no upload (no non-GET request)', nonGet.length === 0, nonGet.map((r) => `${r.method} ${r.url}`).join(', '));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.stop();
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
