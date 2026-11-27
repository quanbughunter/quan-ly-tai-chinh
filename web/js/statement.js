// Bảng công nợ gửi cho người khác: dựng từ các giao dịch Vay nợ của MỘT người, rồi nén + mã hóa vào chính đường link
//   https://…/share.html#v1.<dữ liệu>
// Không cần máy chủ: dữ liệu nằm sau dấu # nên trình duyệt không gửi nó lên mạng; ai có link thì xem được, ai không có thì không.
// Trang xem là web/public/share.html (tệp độc lập, tự giải mã theo đúng định dạng dưới đây — sửa ở đây thì sửa cả bên đó).
// Toàn hàm thuần (không đụng DOM/store) để kiểm thử được.

import { DEBT_SIGN } from './calc.js';
import { roundTo } from './money.js';

export const STATEMENT_VERSION = 1;
export const MAX_ROWS = 2000;
export const DEFAULT_SHARE_BASE = 'https://quanbughunter.github.io/quan-ly-tai-chinh/';

const CUR_ORDER = ['VND', 'RUB', 'USD', 'USDT'];
const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

/**
 * Dựng dữ liệu bảng. Dấu: số dư dương = người này nợ mình (giống màn hình Vay nợ).
 * @param {object} o
 * @param {Array} o.txs        toàn bộ giao dịch
 * @param {string} o.partyId
 * @param {string} [o.owner]   tên người gửi (hiện ở đầu bảng)
 * @param {string} [o.party]   tên người nhận
 * @param {string} [o.note]    ghi chú gửi kèm (ví dụ số tài khoản)
 * @param {string} [o.from]    YYYY-MM-DD: chỉ liệt kê từ ngày này; phần trước gộp thành "số dư đầu kỳ"
 * @param {string} [o.asOf]    YYYY-MM-DD: ngày lập bảng
 * @returns {{v:number,o:string,p:string,d:string,f?:string,n?:string,c:Array<{k:string,o:number,r:Array<[string,string,number,string]>}>}}
 */
export function buildStatement({ txs, partyId, owner = '', party = '', note = '', from = '', asOf = '' }) {
  const list = (txs || [])
    .filter((t) => t.partyId === partyId && DEBT_SIGN[t.kind])
    .sort((a, b) => (a.date === b.date ? (a.ts || 0) - (b.ts || 0) : a.date < b.date ? -1 : 1));
  const blocks = new Map();
  for (const t of list) {
    const cur = t.currency || 'VND';
    if (!blocks.has(cur)) blocks.set(cur, { k: cur, o: 0, r: [] });
    const b = blocks.get(cur);
    if (from && t.date < from) b.o = roundTo(b.o + DEBT_SIGN[t.kind] * t.amount, 6);
    else b.r.push([t.date, t.kind, roundTo(t.amount, 6), cut(t.note, 120)]);
  }
  const c = [...blocks.values()]
    .filter((b) => b.r.length || Math.abs(b.o) > 1e-9)
    .sort((a, b) => {
      const ia = CUR_ORDER.indexOf(a.k); const ib = CUR_ORDER.indexOf(b.k);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.k.localeCompare(b.k);
    })
    .map((b) => ({ k: b.k, o: b.o, r: b.r }));
  const out = { v: STATEMENT_VERSION, o: cut(owner, 60), p: cut(party, 60), d: asOf || '', c };
  if (from) out.f = from;
  if (cut(note, 400)) out.n = cut(note, 400);
  return out;
}

/** Số liệu từng tiền tệ để xem trước / kiểm tra: open (đầu kỳ), up (tăng nợ), down (giảm nợ), balance (còn nợ), count. */
export function summarize(st) {
  return st.c.map((b) => {
    let up = 0; let down = 0;
    for (const [, kind, amount] of b.r) { if (DEBT_SIGN[kind] > 0) up += amount; else down += amount; }
    up = roundTo(up, 6); down = roundTo(down, 6);
    return { cur: b.k, open: b.o, up, down, balance: roundTo(b.o + up - down, 6), count: b.r.length };
  });
}

// ── Mã hóa vào link ────────────────────────────────────────────────────────

function toB64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64u(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** Dữ liệu → "v1.<nén>" (hoặc "v0.<không nén>" nếu trình duyệt quá cũ chưa có CompressionStream). */
export async function encodeStatement(st) {
  const json = new TextEncoder().encode(JSON.stringify(st));
  if (typeof CompressionStream === 'function') {
    try { return `v1.${toB64u(await pipe(json, new CompressionStream('deflate')))}`; } catch { /* rơi xuống bản không nén */ }
  }
  return `v0.${toB64u(json)}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kiểm tra + làm sạch dữ liệu đọc từ link (không tin bất cứ thứ gì trong đó). Lỗi → throw Error('Link không hợp lệ'). */
export function normalizeStatement(raw) {
  const bad = () => { throw new Error('Link không hợp lệ'); };
  if (!raw || typeof raw !== 'object' || raw.v !== STATEMENT_VERSION || !Array.isArray(raw.c) || raw.c.length > 8) bad();
  const out = { v: STATEMENT_VERSION, o: cut(raw.o, 60), p: cut(raw.p, 60), d: DATE_RE.test(raw.d || '') ? raw.d : '', c: [] };
  if (DATE_RE.test(raw.f || '')) out.f = raw.f;
  if (cut(raw.n, 400)) out.n = cut(raw.n, 400);
  let rows = 0;
  for (const b of raw.c) {
    if (!b || typeof b.k !== 'string' || !/^[A-Z]{2,6}$/.test(b.k) || !Array.isArray(b.r)) bad();
    const open = Number(b.o || 0);
    if (!Number.isFinite(open) || Math.abs(open) > 1e15) bad();
    const r = [];
    for (const x of b.r) {
      if (!Array.isArray(x) || !DATE_RE.test(x[0]) || !DEBT_SIGN[x[1]]) bad();
      const amount = Number(x[2]);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1e15) bad();
      r.push([x[0], x[1], amount, cut(x[3], 120)]);
      rows += 1;
      if (rows > MAX_ROWS) bad();
    }
    out.c.push({ k: b.k, o: open, r });
  }
  return out;
}

/** "v1.…" / "v0.…" (có hoặc không có dấu #) → dữ liệu đã làm sạch. */
export async function decodeStatement(token) {
  const m = /^#?v([01])\.([A-Za-z0-9_-]+)$/.exec(String(token || '').trim());
  if (!m) throw new Error('Link không hợp lệ');
  try {
    let bytes = fromB64u(m[2]);
    if (m[1] === '1') bytes = await pipe(bytes, new DecompressionStream('deflate'));
    return normalizeStatement(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    throw new Error('Link không hợp lệ');
  }
}

/** Địa chỉ gốc của trang web (thư mục chứa share.html): đang mở trên github.io thì lấy chính nó, còn lại dùng địa chỉ mặc định. */
export function shareBase(loc = typeof location === 'undefined' ? null : location) {
  if (loc && /^https?:$/.test(loc.protocol) && /\.github\.io$/.test(loc.hostname)) return loc.origin + loc.pathname.replace(/[^/]*$/, '');
  return DEFAULT_SHARE_BASE;
}

export function statementLink(base, token) {
  return `${String(base || DEFAULT_SHARE_BASE).replace(/[#?].*$/, '').replace(/\/?$/, '/')}share.html#${token}`;
}
