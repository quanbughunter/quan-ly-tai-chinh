#!/usr/bin/env node
// Nhập dữ liệu từ file Excel cũ (xuất từ Google Sheet) sang định dạng của app.
//
//   npm install                                  (một lần, cài thư viện đọc Excel)
//   node tools/import_xlsx.mjs "QUAN_LY_TAI_CHINH_2026.xlsx"
//
// Kết quả (nằm trong thư mục private/, đã loại khỏi git):
//   private/import.json        – nhập vào app: Cài đặt → Dữ liệu → Nhập từ file → "Thay toàn bộ"
//   private/import-report.txt  – báo cáo đối chiếu: số dư tính lại có khớp số trong sheet cũ không
//
// Công cụ KHÔNG đọc tab password_incen và không gửi dữ liệu đi đâu cả.
// Các tab không đưa vào app (đã quyết định): password_incen, VKA_2 (đối tác), usdt, vnd, và hai sổ công nợ ăn chung
// (liên kết sang sheet riêng). Chỉ tab "tổng hợp" được đọc thêm đúng các dòng nợ đó để đối chiếu tổng tài sản.
// Mọi quy ước (đơn vị triệu/nghìn, tab nào là tiền gì) nằm ở phần CẤU HÌNH ngay dưới đây.

import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { guessCategoryName } from '../web/js/quickadd.js';
import { accountBalances, debtBalances, overview } from '../web/js/calc.js';
import { evalDeal } from '../web/js/fx.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../web/js/model.js';
import { roundTo, fmtNum } from '../web/js/money.js';

/* ═════════════════════════ CẤU HÌNH ═════════════════════════ */
const MIL = 1e6; // các tab cá nhân ghi tiền VND theo "triệu"
const CFG = {
  rates: { RUB: 300, USD: 26000, USDT: 26500 }, // đúng tỷ giá cố định trong tab "tổng hợp"
  undatedFallback: '2026-01-01', // ngày gán cho các dòng "tiêu sài" đầu danh sách không ghi ngày
  // Các dòng nợ trong tab "tổng hợp" (cột B = số, cột C = tiền tệ) thuộc những sổ KHÔNG đưa vào app.
  // Tổng tài sản của app sẽ thấp hơn sheet cũ đúng bằng các khoản này; công cụ trừ chúng khi đối chiếu.
  excludedSummaryRows: [4, 5, 6],
  // Tab → ngân hàng/thẻ
  accounts: {
    mb: { name: 'Thẻ MB', kind: 'bank', currency: 'VND', networth: true },
    gaz: { name: 'Thẻ Gazprom', kind: 'card', currency: 'RUB', networth: true },
    pspb: { name: 'Thẻ PSPB', kind: 'card', currency: 'RUB', networth: true },
    bo: { name: 'Gửi bố (tiết kiệm)', kind: 'savings', currency: 'VND', networth: true },
    bank: { name: 'Tiết kiệm RUB (bank)', kind: 'savings', currency: 'RUB', networth: true },
    usd: { name: 'Tiền mặt USD', kind: 'cash', currency: 'USD', networth: true },
    legacy: { name: 'Sổ chi tiêu & lương (chỉ ghi lại)', kind: 'cash', currency: 'VND', networth: false },
  },
};
/* ═════════════════════════════════════════════════════════════ */

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : 'private';
if (!file || args.includes('--help')) {
  console.log('Cách dùng: node tools/import_xlsx.mjs <file.xlsx> [--out thư_mục_đầu_ra]');
  process.exit(file ? 0 : 1);
}

/* ───────── Tiện ích ───────── */
const uuid = (key) => {
  const h = crypto.createHash('sha1').update(`qltc:${key}`).digest('hex');
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
};
const iso = (d) => d.toISOString().slice(0, 10);
const serialToDate = (n) => new Date(Math.round((n - 25569) * 86400000));
const round = (n, cur) => roundTo(n, cur === 'VND' ? 0 : 2);
const trim = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const colName = (n) => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };

const infoNotes = [];
const warnings = [];
const warn = (m) => warnings.push(m);

/* Đọc ô: { v: giá trị đã tính sẵn, f: công thức (không có dấu =) }.
 * Ô gộp: exceljs trả về giá trị của ô gốc cho MỌI ô trong vùng gộp. Mặc định ta chỉ đọc ô gốc
 * (các ô còn lại coi là trống, để một khoản tiền gộp 7 dòng không bị tính 7 lần);
 * với ngày/ghi chú thì dùng inherit:true để dòng nào cũng thấy giá trị chung. */
function read(ws, r, c, { inherit = false } = {}) {
  if (!ws) return { v: null, f: null };
  const cell = ws.getCell(r, c);
  if (!inherit && isSlave(cell)) return { v: null, f: null };
  const f = cell.formula || (cell.value && typeof cell.value === 'object' && cell.value.formula) || null;
  let v = f ? cell.result : cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if (v.richText) v = v.richText.map((t) => t.text).join('');
    else if ('error' in v) v = null;
    else if ('result' in v) v = v.result;
    else if ('text' in v) v = v.text;
    else v = null;
  }
  return { v: v === undefined ? null : v, f: f ? String(f).replace(/^=/, '') : null };
}
const isSlave = (cell) => !!(cell.isMerged && cell.master && cell.master.address !== cell.address);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
function dateOf(ws, r, c) {
  const { v } = read(ws, r, c, { inherit: true });
  if (v instanceof Date) return iso(v);
  if (typeof v === 'number' && v > 30000 && v < 80000) return iso(serialToDate(v));
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}
const textOf = (ws, r, c, inherit = true) => { const { v } = read(ws, r, c, { inherit }); return typeof v === 'string' ? trim(v) : ''; };

/* Biểu thức số học thuần (không dùng eval) */
function evalArith(src) {
  let i = 0;
  const s = src.replace(/\s+/g, '');
  const peek = () => s[i];
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; }
  function term() { let v = unary(); while (peek() === '*' || peek() === '/') { const op = s[i++]; const r = unary(); v = op === '*' ? v * r : v / r; } return v; }
  function unary() { if (peek() === '-') { i++; return -unary(); } if (peek() === '+') { i++; return unary(); } return atom(); }
  function atom() {
    if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw new Error('thiếu )'); i++; return v; }
    const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (!m) throw new Error(`không đọc được "${src}"`);
    i += m[0].length;
    return Number(m[0]);
  }
  const v = expr();
  if (i !== s.length) throw new Error(`thừa ký tự trong "${src}"`);
  return v;
}
const isConstExpr = (f) => !!f && /^[\d.+\-*/() ]+$/.test(f) && /\d/.test(f);

/* Tách các số hạng ở mức ngoài cùng: "-3830-10210+(2052+2922)/3" → [-3830, -10210, +1658] */
function splitTerms(expr) {
  const s = expr.replace(/\s+/g, '');
  const terms = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === '+' || ch === '-') && depth === 0 && i > 0 && !/[*/(+-]/.test(s[i - 1])) { terms.push(cur); cur = ''; }
    cur += ch;
  }
  terms.push(cur);
  return terms.filter(Boolean).map(evalArith);
}

/** Các số hạng của một ô. Công thức hằng số thì tách từng số hạng; ngược lại lấy giá trị đã tính. */
function parts(ws, r, c, { split = true } = {}) {
  const { v, f } = read(ws, r, c);
  if (isConstExpr(f)) {
    try { return split ? splitTerms(f) : [evalArith(f)]; } catch { /* dùng giá trị đã tính */ }
  }
  const n = num(v);
  return n == null || n === 0 ? [] : [n];
}

/** Hằng số trong công thức số dư (bỏ các sum(...)): "27.807-2.2+sum(..)-sum(..)" → [27.807, -2.2] */
function constTerms(f) {
  if (!f) return [];
  let s = f.replace(/\s+/g, '').replace(/[+-]?sum\([^)]*\)/gi, '');
  s = s.replace(/^\+/, '');
  if (!s) return [];
  return splitTerms(s);
}

/* ───────── Mở file ───────── */
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const sheet = (name) => {
  const ws = wb.getWorksheet(name);
  if (!ws) warn(`Không thấy tab "${name}" — bỏ qua phần này.`);
  return ws;
};

/* ───────── Thực thể ───────── */
const out = { accounts: [], parties: [], categories: [], txs: [], deals: [], dorm: [], scholarships: [], budgets: [], settings: [] };
let tsCounter = 1_000_000;
const nextTs = () => ++tsCounter;

const accId = {};
Object.entries(CFG.accounts).forEach(([key, a], i) => {
  accId[key] = uuid(`acc:${key}`);
  out.accounts.push({ id: accId[key], ts: nextTs(), order: i, opening: 0, ...a });
});
const accByKey = (k) => out.accounts.find((a) => a.id === accId[k]);

for (const [i, c] of DEFAULT_CATEGORIES.entries()) out.categories.push({ id: uuid(`cat:${c.type}:${c.name}`), ts: nextTs(), order: i, ...c });
const catId = (name, type) => (out.categories.find((c) => c.name === name && (!type || c.type === type)) || {}).id || '';
function categorize(note, kind) {
  const n = trim(note);
  if (!n) return '';
  let name = guessCategoryName(n, kind);
  if (!name && kind === 'expense' && /^em\b/i.test(n)) name = 'Biếu gia đình'; // "em" = chi cho em trai/em gái
  return name ? catId(name, kind) : '';
}

const parties = new Map();
function party(name, role = 'person') {
  const key = trim(name);
  if (!parties.has(key)) {
    const p = { id: uuid(`party:${key}`), ts: nextTs(), name: key, role };
    parties.set(key, p);
    out.parties.push(p);
  }
  return parties.get(key);
}

const txIds = new Set();
function tx(ref, o) {
  let id = uuid(`tx:${ref}`);
  for (let k = 2; txIds.has(id); k++) id = uuid(`tx:${ref}#${k}`);
  txIds.add(id);
  const t = { id, ts: nextTs(), accountId: '', note: '', ...o, src: ref };
  t.amount = round(t.amount, t.currency);
  if (t.toAmount != null) t.toAmount = round(t.toAmount, accByKeyId(t.toAccountId).currency);
  out.txs.push(t);
  return t;
}
const accByKeyId = (id) => out.accounts.find((a) => a.id === id);

/* ───────── Kho "nguồn" có thể gắn vào thẻ ───────── */
// Một khoản có thể xuất hiện ở 2 tab (ví dụ: cho vay ghi ở tab vay nợ, trừ tiền ghi ở tab thẻ).
// Ta chỉ tạo MỘT giao dịch: nếu khớp (cùng ngày, cùng tiền tệ, cùng số tiền) thì gắn vào thẻ đó.
const pool = [];
const PRIO = { lend: 1, repay_in: 1, deposit: 2, expense: 3, income: 3 };
function addSource(s) { pool.push({ used: false, ...s }); }

function findGroup(dir, date, cur, amount) {
  const cands = pool.filter((s) => !s.used && s.dir === dir && s.date === date && s.cur === cur);
  const eq = (a, b) => Math.abs(a - b) < (cur === 'VND' ? 0.5 : 0.005);
  const single = cands.filter((s) => eq(s.amount, amount)).sort((a, b) => PRIO[a.kind] - PRIO[b.kind])[0];
  if (single) return [single];
  const lst = cands.filter((s) => s.kind === 'expense' || s.kind === 'income').slice(0, 8);
  let best = null;
  for (let mask = 1; mask < 1 << lst.length; mask++) {
    const pick = lst.filter((_, i) => mask & (1 << i));
    if (pick.length < 2) continue;
    if (eq(pick.reduce((x, s) => x + s.amount, 0), amount) && (!best || pick.length < best.length)) best = pick;
  }
  return best;
}

/* ═════════════════════════ 1. CÁC KHOẢN CÓ THỂ GẮN VÀO THẺ ═════════════════════════ */

/* ── Vay nợ ── */
const loanBlocks = [];
{
  const ws = sheet('cho vay');
  const defs = [
    { c: 1, cur: 'VND', unit: MIL, repayTo: 'mb' }, // tiền trả của 2 người đầu được cộng vào thẻ MB trong công thức "cá nhân"!D3
    { c: 5, cur: 'VND', unit: MIL, repayTo: 'mb' },
    { c: 9, cur: 'RUB', unit: 1 },
    { c: 13, cur: 'RUB', unit: 1 },
    { c: 17, cur: 'RUB', unit: 1 },
  ];
  for (const d of defs) {
    const name = textOf(ws, 1, d.c);
    if (!name) { warn(`Tab "cho vay": không thấy tên người ở cột ${colName(d.c)} dòng 1.`); continue; }
    loanBlocks.push({ ws, sheetName: 'cho vay', name, date: d.c, lend: d.c + 1, repay: d.c + 2, noteCol: null, ...d, first: 3, balanceCell: [3, d.c + 3] });
  }
}

for (const b of loanBlocks) {
  if (!b.ws) continue;
  const p = party(b.name);
  let last = null;
  const direct = []; // khoản trả có công thức riêng (cộng vào thẻ MB)
  for (let r = b.first; r <= b.ws.rowCount; r++) {
    const d = dateOf(b.ws, r, b.date);
    if (d) last = d;
    const note = b.noteCol ? textOf(b.ws, r, b.noteCol) : '';
    for (const [col, kind] of [[b.lend, 'lend'], [b.repay, 'repay_in']]) {
      parts(b.ws, r, col).forEach((x, i) => {
        if (x <= 0) return;
        const date = d || last || CFG.undatedFallback;
        const amount = round(x * b.unit, b.cur);
        const ref = `${b.sheetName}!${colName(col)}${r}.${b.date}#${i}`;
        const make = (acc) => tx(ref, { date, kind, amount, currency: b.cur, accountId: acc || '', partyId: p.id, note });
        if (kind === 'repay_in' && b.repayTo) direct.push(() => make(accId[b.repayTo]));
        else addSource({ dir: kind === 'lend' ? 'out' : 'in', kind, date, cur: b.cur, amount, ref, emit: (acc) => [make(acc)], defaultAcc: '' });
      });
    }
  }
  b.direct = direct;
}
// Khoản USD ghi tay ở ô D3 của tab "cho vay" (không có dòng ngày)
{
  const ws = wb.getWorksheet('cho vay');
  const b = loanBlocks.find((x) => x.sheetName === 'cho vay');
  if (ws && b) {
    const { v, f } = read(ws, 3, 4);
    if (num(v) && !f) {
      const date = dateOf(ws, 3, 1) || CFG.undatedFallback;
      const p = party(b.name);
      tx('cho vay!D3', { date, kind: 'lend', amount: v, currency: 'USD', partyId: p.id, note: 'Số dư USD ghi tay ở ô D3 của sheet cũ (không có dòng ngày)' });
    }
  }
}

/* ── Gửi bố ── */
const boRows = [];
{
  const ws = sheet('bố');
  let last = null;
  for (let r = 2; r <= (ws ? ws.rowCount : 0); r++) {
    const d = dateOf(ws, r, 1); if (d) last = d;
    parts(ws, r, 2).forEach((x, i) => {
      if (x <= 0) return;
      const date = d || last || CFG.undatedFallback;
      const amount = round(x * MIL, 'VND');
      const ref = `bố!B${r}#${i}`;
      addSource({ dir: 'out', kind: 'deposit', date, cur: 'VND', amount, ref, emit: (acc) => [acc
        ? tx(ref, { date, kind: 'transfer', amount, currency: 'VND', accountId: acc, toAccountId: accId.bo, note: 'Gửi bố' })
        : tx(ref, { date, kind: 'income', amount, currency: 'VND', accountId: accId.bo, categoryId: catId('Thu khác', 'income'), note: 'Gửi bố (nguồn ngoài sổ thẻ)' })] });
      boRows.push(amount);
    });
  }
}

/* ── Thu nhập lẻ ── */
for (const [name, label, catName, col] of [['lương sĩ quan', 'Lương', 'Lương', 2], ['mẹ', 'Kiếm tiền biếu mẹ', 'Thu khác', 2]]) {
  const ws = sheet(name);
  if (!ws) continue;
  let last = null;
  const first = name === 'mẹ' ? 3 : 3;
  for (let r = first; r <= ws.rowCount; r++) {
    const d = dateOf(ws, r, 1); if (d) last = d;
    parts(ws, r, col).forEach((x, i) => {
      if (x <= 0) return;
      const date = d || last || CFG.undatedFallback;
      const amount = round(x * MIL, 'VND');
      const ref = `${name}!${colName(col)}${r}#${i}`;
      addSource({ dir: 'in', kind: 'income', tag: name, date, cur: 'VND', amount, ref, emit: (acc) => [tx(ref, { date, kind: 'income', amount, currency: 'VND', accountId: acc || accId.legacy, categoryId: catId(catName, 'income'), note: label })] });
    });
  }
}

/* ── Tiêu sài (sổ chi tiêu tổng) ── */
let tieuTotalImported = 0;
{
  const ws = sheet('tiêu sài');
  let last = null;
  for (let r = 2; r <= (ws ? ws.rowCount : 0); r++) {
    const d = dateOf(ws, r, 1); if (d) last = d;
    const note = textOf(ws, r, 3);
    parts(ws, r, 2).forEach((x, i) => {
      if (x <= 0) return;
      const undated = !d && !last;
      const date = d || last || CFG.undatedFallback;
      const amount = round(x * MIL, 'VND');
      const ref = `tiêu sài!B${r}#${i}`;
      tieuTotalImported += amount;
      addSource({ dir: 'out', kind: 'expense', tag: 'tiêu sài', undated: !d, date, cur: 'VND', amount, ref, emit: (acc) => [tx(ref, { date, kind: 'expense', amount, currency: 'VND', accountId: acc || accId.legacy, categoryId: categorize(note, 'expense'), note: note + (undated ? ' (chưa rõ ngày)' : '') })] });
    });
  }
}

/* ═════════════════════════ 2. THẺ / TÀI KHOẢN CÓ SỔ RIÊNG ═════════════════════════ */

function genericTx(card, p) {
  const kind = p.dir === 'in' ? 'income' : 'expense';
  const note = p.note || (p.dir === 'in' ? `Vào (sổ ${card.name})` : `Ra (sổ ${card.name})`);
  return tx(p.ref, { date: p.date, kind, amount: p.amount, currency: card.currency, accountId: card.id, categoryId: categorize(p.note, kind), note });
}

function processCard({ key, ws, constFormula, unit, flows, dateCol, unmatchedLog }) {
  const card = accByKey(key);
  // Số dư đầu kỳ + các khoản trừ tay trong công thức
  const terms = constTerms(constFormula);
  const pos = terms.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  card.opening = round(pos * unit, card.currency);
  for (const [i, neg] of terms.filter((x) => x < 0).entries()) {
    const amount = round(-neg * unit, card.currency);
    const src = pool.find((s) => !s.used && s.dir === 'out' && s.kind === 'lend' && s.cur === card.currency && Math.abs(s.amount - amount) < 0.5);
    if (src) { src.used = true; src.emit(card.id); continue; } // khoản trừ tay chính là một khoản cho vay đã ghi ở tab vay nợ
    const firstDate = (flows.length && flows[0].date) || CFG.undatedFallback;
    tx(`${card.name}!hằng số#${i}`, { date: firstDate, kind: 'adjust', amount: -amount, currency: card.currency, accountId: card.id, note: 'Khoản trừ tay trong công thức số dư của sheet cũ (không rõ ngày)' });
  }
  // Dòng tiền
  const list = [...flows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const p of list) {
    const grp = findGroup(p.dir, p.date, card.currency, p.amount);
    if (grp) { for (const s of grp) { s.used = true; s.emit(card.id); } continue; }
    genericTx(card, p);
    if (unmatchedLog) unmatchedLog(p);
  }
}

/** Gom dòng tiền của một thẻ thành danh sách { date, dir, amount, note, ref } */
function flowsOf(ws, { first, dateCol, inCols = [], outCols = [], signedCols = [], noteCol, unit, cur }) {
  const res = [];
  if (!ws) return res;
  for (let r = first; r <= ws.rowCount; r++) {
    const d = dateOf(ws, r, dateCol);
    if (!d) continue;
    const note = noteCol ? textOf(ws, r, noteCol) : '';
    const push = (col, dir, x, i) => {
      if (x === 0) return;
      res.push({ date: d, dir: x < 0 && dir === 'signed' ? 'out' : dir === 'signed' ? 'in' : dir, amount: round(Math.abs(x) * unit, cur), note, ref: `${ws.name}!${colName(col)}${r}#${i}` });
    };
    for (const c of inCols) parts(ws, r, c).forEach((x, i) => push(c, 'in', x, i));
    for (const c of outCols) parts(ws, r, c).forEach((x, i) => push(c, 'out', x, i));
    for (const c of signedCols) parts(ws, r, c).forEach((x, i) => push(c, 'signed', x, i));
  }
  return res;
}

{
  const ws = sheet('cá nhân');
  if (ws) {
    // MB: cột B vào, C ra (triệu). Số dư công thức ở D3. Hàng 3 có công thức ở D nên bỏ qua D.
    processCard({ key: 'mb', ws, constFormula: read(ws, 3, 4).f, unit: MIL, flows: flowsOf(ws, { first: 3, dateCol: 1, inCols: [2], outCols: [3], unit: MIL, cur: 'VND' }) });
    processCard({ key: 'gaz', ws, constFormula: read(ws, 3, 7).f, unit: 1, flows: flowsOf(ws, { first: 3, dateCol: 1, inCols: [5], outCols: [6], unit: 1, cur: 'RUB' }) });
    // PSPB: cột J có chữ ghi chú ở các dòng sau hàng 3
    const pf = flowsOf(ws, { first: 3, dateCol: 1, inCols: [8], outCols: [9], noteCol: 10, unit: 1, cur: 'RUB' });
    processCard({ key: 'pspb', ws, constFormula: read(ws, 3, 10).f, unit: 1, flows: pf });
  }
}
// Các khoản trả nợ có công thức riêng cộng vào thẻ MB: sinh giao dịch sau khi thẻ đã khớp xong
for (const b of loanBlocks) for (const make of b.direct || []) make();

// Gửi bố: số dư đầu kỳ từ công thức; các khoản gửi chưa gắn thẻ → thu nhập vào tài khoản đó
{
  const ws = sheet('bố');
  if (ws) accByKey('bo').opening = round(constTerms(read(ws, 2, 3).f).reduce((a, b) => a + b, 0) * MIL, 'VND');
}
// Tiết kiệm RUB (bank): số gõ tay ở tổng hợp!E3
{
  const ws = sheet('tổng hợp');
  if (ws) {
    const { v, f } = read(ws, 3, 5);
    if (num(v) && !f) accByKey('bank').opening = v;
    // USD "sinh hoạt phí": tổng hợp chỉ tính khoản nhận gần nhất (I5)
    const rows = [];
    for (let r = 3; r <= 12; r++) {
      const d = dateOf(ws, r, 8); const x = num(read(ws, r, 9).v);
      if (d && x && textOf(ws, r, 10).toLowerCase() === 'usd') rows.push({ d, x, r });
    }
    rows.forEach(({ d, x, r }) => tx(`tổng hợp!I${r}`, { date: d, kind: 'income', amount: x, currency: 'USD', accountId: accId.usd, categoryId: catId('Sinh hoạt phí', 'income'), note: 'Sinh hoạt phí' }));
    if (rows.length > 1) {
      const used = rows.slice(0, -1).reduce((a, r) => a + r.x, 0);
      tx('tổng hợp!usd-bù', { date: rows[rows.length - 1].d, kind: 'adjust', amount: -used, currency: 'USD', accountId: accId.usd, note: 'Đã dùng/đổi từ các khoản nhận trước (bù cho khớp số "tiền mặt USD" của sheet cũ)' });
    }
  }
}

// Mọi nguồn còn lại → tài khoản mặc định
for (const s of pool) if (!s.used) { s.used = true; s.emit(''); }

/* ═════════════════════════ 3. BÁO TỈ GIÁ (ĐỔI TIỀN), KTX, HỌC BỔNG ═════════════════════════ */

// sang / về
const skippedQuotes = { sang: 0, 'về': 0 };
for (const [name, dir] of [['sang', 'sang'], ['về', 've']]) {
  const ws = sheet(name);
  if (!ws) continue;
  for (let r = 2; r <= ws.rowCount; r++) {
    const date = dateOf(ws, r, 1);
    const B = num(read(ws, r, 2).v), C = num(read(ws, r, 3).v), D = num(read(ws, r, 4).v), E = num(read(ws, r, 5).v);
    if (!date || B == null || C == null || D == null || E == null) continue;
    const g = (c) => { const x = num(read(ws, r, c).v); return x && x > 0 ? x : undefined; };
    // Chỉ nhập lệnh ĐÃ CHỐT (có giá thực tế). Dòng chỉ có báo giá (chưa làm) không phải giao dịch → bỏ qua.
    const executed = name === 'sang' ? g(9) && g(11) : g(10) && g(11);
    if (!executed) { skippedQuotes[name]++; continue; }
    const deal = dir === 'sang'
      ? { dir, date, inputs: { vndPerUsdt: B * 1000, rubPerUsdt: C, vndAmount: D * MIL, margin: E * 1000 }, actual: { sellRubPerUsdt: g(9), buyVndPerUsdt: g(11) && g(11) * 1000 } }
      : { dir, date, inputs: { rubPerUsdt: B, vndPerUsdt: C * 1000, rubAmount: D, margin: E * 1000 }, actual: { actualRubPerUsdt: g(10), actualVndPerUsdt: g(11) && g(11) * 1000 } };
    const ev = evalDeal(deal, DEFAULT_SETTINGS.params);
    // Lệnh cũ coi là ĐÃ CHỐT. Lãi chưa được cộng vào thẻ (số dư thẻ MB trong sheet cũ chưa từng có khoản này):
    // app sẽ hiện một thông báo để bạn chọn "cộng vào thẻ" hoặc "bỏ qua".
    out.deals.push({
      id: uuid(`deal:${name}!${r}`), ts: nextTs(), status: 'done', note: `Nhập từ tab "${name}" dòng ${r}`, ...deal,
      profit: Math.round(ev.profit ?? 0),
      result: ev.quote ? { quote: ev.quote.quote, rubPay: ev.quote.rubPay ?? null, vndPay: ev.quote.vndPay ?? null } : undefined,
      _row: r,
    });
  }
}

// ktx_quan
{
  const ws = sheet('ktx_quan');
  if (ws) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const amount = num(read(ws, r, 2).v);
      const paidDate = dateOf(ws, r, 1);
      if (!amount || !paidDate) continue;
      const dv = read(ws, r, 4).v;
      const period = dv instanceof Date ? `Tháng ${dv.getUTCMonth() + 1}/${dv.getUTCFullYear()}` : trim(dv);
      out.dorm.push({ id: uuid(`dorm:${r}`), ts: nextTs(), paidDate, amount, currency: 'RUB', payer: textOf(ws, r, 3), period, receiptSent: read(ws, r, 5).v === true });
    }
  }
}

// học bổng
{
  const ws = sheet('học bổng miigaik');
  if (ws) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const m = dateOf(ws, r, 1);
      if (!m) continue;
      out.scholarships.push({ id: uuid(`sch:${r}`), ts: nextTs(), month: m.slice(0, 7), availableDate: dateOf(ws, r, 2) || undefined, receivedDate: dateOf(ws, r, 3) || undefined });
    }
  }
}

out.settings.push({ id: uuid('settings'), ts: nextTs(), baseCurrency: 'VND', rates: { ...CFG.rates }, hideAmounts: false, params: { dealAccountId: accId.mb } });

/* ═════════════════════════ 4. ĐỐI CHIẾU ═════════════════════════ */

const report = [];
const line = (s = '') => report.push(s);
let ok = 0;
let total = 0;
const tol = (cur) => (cur === 'VND' ? 5 : 0.01); // VND: sai số làm tròn vài đồng khi cộng nhiều khoản quy đổi
function check(label, oldV, newV, cur = 'VND', note = '') {
  total++;
  const good = oldV != null && Math.abs(oldV - newV) <= tol(cur);
  if (good) ok++;
  const f = (x) => (x == null ? '—' : fmtNum(x, cur === 'VND' ? 0 : 2));
  line(`${good ? '✓' : '✗'} ${label.padEnd(46)} cũ: ${f(oldV).padStart(16)}   mới: ${f(newV).padStart(16)}${good ? '' : `   lệch: ${f(newV - (oldV ?? 0))}`}${note ? `   (${note})` : ''}`);
}
const cellNum = (name, r, c, mult = 1) => { const ws = wb.getWorksheet(name); const x = ws ? num(read(ws, r, c).v) : null; return x == null ? null : x * mult; };

let excludedTotal = 0;
const bal = accountBalances(out.accounts, out.txs);
const B = (key) => bal.get(accId[key]) || 0;

line('ĐỐI CHIẾU SỐ DƯ (số trong sheet cũ ↔ tính lại từ giao dịch đã nhập)');
line('─'.repeat(110));
check('Thẻ MB            (cá nhân!D3)', cellNum('cá nhân', 3, 4, MIL), B('mb'));
check('Thẻ Gazprom       (cá nhân!G3)', cellNum('cá nhân', 3, 7), B('gaz'), 'RUB');
check('Thẻ PSPB          (cá nhân!J3)', cellNum('cá nhân', 3, 10), B('pspb'), 'RUB');
check('Gửi bố            (bố!C2)', cellNum('bố', 2, 3, MIL), B('bo'));
check('Tiết kiệm RUB     (tổng hợp!E3)', cellNum('tổng hợp', 3, 5), B('bank'), 'RUB');
check('Tiền mặt USD      (tổng hợp!I5)', cellNum('tổng hợp', 5, 9), B('usd'), 'USD');

line('');
line('CÔNG NỢ (dương = họ nợ mình)');
line('─'.repeat(110));
const debts = debtBalances(out.txs);
const dOf = (name, cur) => ((debts.get((parties.get(name) || {}).id) || {})[cur]) || 0;
const nameAt = (ws, c) => textOf(wb.getWorksheet(ws), 1, c);
check(`${nameAt('cho vay', 1)} VND      (cho vay!D4)`, cellNum('cho vay', 4, 4, MIL), dOf(nameAt('cho vay', 1), 'VND'));
check(`${nameAt('cho vay', 1)} USD      (cho vay!D3)`, cellNum('cho vay', 3, 4), dOf(nameAt('cho vay', 1), 'USD'), 'USD');
check(`${nameAt('cho vay', 5)}  (cho vay!H3)`, cellNum('cho vay', 3, 8, MIL), dOf(nameAt('cho vay', 5), 'VND'));
check(`${nameAt('cho vay', 9)}  (cho vay!L3)`, cellNum('cho vay', 3, 12), dOf(nameAt('cho vay', 9), 'RUB'), 'RUB');
check(`${nameAt('cho vay', 13)}  (cho vay!P3)`, cellNum('cho vay', 3, 16), dOf(nameAt('cho vay', 13), 'RUB'), 'RUB');
check(`${nameAt('cho vay', 17)}  (cho vay!T3)`, cellNum('cho vay', 3, 20), dOf(nameAt('cho vay', 17), 'RUB'), 'RUB');
line('');
line('BÁO TỈ GIÁ (lệnh đã chốt)');
line('─'.repeat(110));
for (const [name, label] of [['sang', 'sang'], ['về', 've']]) {
  const ws = wb.getWorksheet(name);
  if (!ws) continue;
  for (const d of out.deals.filter((x) => x.dir === label)) {
    const old = num(read(ws, d._row, 13).v);
    if (old == null || old === 0) continue;
    const ev = evalDeal(d, DEFAULT_SETTINGS.params);
    check(`Lệnh ${name} dòng ${d._row}: lãi thực`, label === 'sang' ? old * MIL : old, ev.profit ?? 0, 'VND', label === 'sang' ? 'sheet ghi triệu ₫' : '');
  }
}

line('');
line('TỔNG HỢP');
line('─'.repeat(110));
{
  const ov = overview({ accounts: out.accounts, txs: out.txs, rates: CFG.rates });
  // Tổng tài sản cũ gồm cả các khoản nợ của những sổ không đưa vào app → trừ ra trước khi so.
  const sumWs = wb.getWorksheet('tổng hợp');
  let excluded = 0;
  for (const r of CFG.excludedSummaryRows) {
    const x = sumWs ? num(read(sumWs, r, 2).v) : null;
    const cur = sumWs ? textOf(sumWs, r, 3).toLowerCase() : '';
    if (x == null) continue;
    excluded += cur === 'rub' ? x * CFG.rates.RUB : cur === 'usd' ? x * CFG.rates.USD : x * MIL;
  }
  const oldNet = cellNum('tổng hợp', 2, 15, MIL);
  check('Tổng tài sản (tổng hợp!O2 trừ sổ đã loại)', oldNet == null ? null : oldNet - excluded, ov.base.net, 'VND', `tỷ giá RUB 300 · USD 26.000 như sheet cũ; đã trừ ${fmtNum(excluded)} ₫ công nợ của các sổ không nhập`);
  excludedTotal = excluded;
  check('Tổng chi tab "tiêu sài" (E1)', cellNum('tiêu sài', 1, 5, MIL), tieuTotalImported);
  const luong = out.txs.filter((t) => /^lương sĩ quan!/.test(t.src)).reduce((a, t) => a + t.amount, 0);
  const c2 = read(wb.getWorksheet('lương sĩ quan'), 2, 3);
  const base12 = constTerms(c2.f).reduce((a, b) => a + b, 0); // 10,744 × 12 = lương 12 tháng đầu, gộp
  check('Lương (C2 trừ phần "×12 tháng" gộp sẵn)', c2.v == null ? null : (c2.v - base12) * MIL, luong, 'VND', `bỏ qua ${fmtNum(base12 * MIL)} ₫ gộp sẵn`);
}

line('');
line(`Khớp ${ok}/${total} mục.`);

/* ── Ghi chú đáng xem lại ── */
const notes = [];
const legacy = out.txs.filter((t) => t.accountId === accId.legacy);
const undated = out.txs.filter((t) => /chưa rõ ngày/.test(t.note));
notes.push(`Có ${undated.length} khoản "tiêu sài" không ghi ngày → tạm gán ngày ${CFG.undatedFallback} (ghi chú có chữ "chưa rõ ngày"); sửa ngày trong app nếu cần.`);
notes.push(`Tài khoản "${CFG.accounts.legacy.name}" (${legacy.length} giao dịch) không tính vào tổng tài sản: nó chỉ ghi lại tiêu sài, lương… theo ngày để thống kê. Số dư của nó không có ý nghĩa.`);
notes.push('Không nhập: tab password_incen, VKA_2, usdt, vnd và hai sổ công nợ ăn chung (liên kết sang sheet riêng). Vì vậy tổng tài sản trong app thấp hơn sheet cũ đúng bằng phần công nợ của hai sổ đó' + (excludedTotal ? ` (${fmtNum(excludedTotal)} ₫ theo tỷ giá cố định của sheet cũ).` : '.'));
{
  const big = out.deals.filter((d) => Math.abs(d.profit) >= 5_000_000);
  if (big.length) notes.push(`Lãi bất thường (≥ 5 triệu ₫) — nên mở lại xem số có đúng không: ${big.map((d) => `${d.dir === 'sang' ? 'sang' : 'về'} dòng ${d._row} (${d.date}) lãi ${fmtNum(d.profit)} ₫`).join('; ')}.`);
  if (out.deals.length) notes.push(`${out.deals.length} lệnh đổi tiền cũ được nhập ở trạng thái ĐÃ CHỐT, tổng lãi ${fmtNum(out.deals.reduce((a, d) => a + d.profit, 0))} ₫, nhưng chưa cộng vào Thẻ MB (số dư MB của sheet cũ không có khoản này). Mở mục Báo tỉ giá: app sẽ hỏi cộng bù vào thẻ hay bỏ qua.`);
}
if (skippedQuotes.sang || skippedQuotes['về']) notes.push(`Bỏ qua ${skippedQuotes.sang} dòng báo giá ở tab "sang" và ${skippedQuotes['về']} dòng ở tab "về" vì chưa có giá chốt thực tế (chỉ nhập lệnh đã chốt).`);
notes.push(...infoNotes);
if (warnings.length) notes.push(...warnings);

const counts = Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join(' · ');
const header = [`Nguồn: ${path.basename(file)}`, `Đã tạo: ${counts}`, ''];
const text = [...header, ...report, '', 'CẦN XEM LẠI', '─'.repeat(110), ...notes.map((n) => `• ${n}`), ''].join('\n');
console.log(text);

fs.mkdirSync(outDir, { recursive: true });
const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === '_row' ? undefined : v)));
fs.writeFileSync(path.join(outDir, 'import.json'), JSON.stringify({ app: 'quan-ly-tai-chinh', version: 1, exportedAt: new Date().toISOString(), source: 'import_xlsx', data: clean(out) }, null, 2));
fs.writeFileSync(path.join(outDir, 'import-report.txt'), text);
console.log(`Đã ghi ${path.join(outDir, 'import.json')} và import-report.txt`);
