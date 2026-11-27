// Tiền tệ, định dạng và đọc số tiền gõ tay (25k, 1,5tr, 573000+500000-3000000, 45k*3, (2tr+500k)/4...)

export const CURRENCIES = ['VND', 'RUB', 'USD', 'USDT'];

export const CUR_INFO = {
  VND: { symbol: '₫', dec: 0, name: 'Đồng Việt Nam' },
  RUB: { symbol: '₽', dec: 2, name: 'Rúp Nga' },
  USD: { symbol: '$', dec: 2, name: 'Đô la Mỹ' },
  USDT: { symbol: 'USDT', dec: 2, name: 'Tether' },
};

const nfCache = {};
function nf(maxDec) {
  if (!nfCache[maxDec]) {
    nfCache[maxDec] = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: maxDec });
  }
  return nfCache[maxDec];
}

export function roundTo(n, dec = 6) {
  const f = 10 ** dec;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

export function fmtNum(n, dec = 0) {
  if (n == null || Number.isNaN(Number(n))) return '';
  const v = roundTo(n, dec);
  return nf(dec).format(Object.is(v, -0) ? 0 : v);
}

/** Định dạng số tiền kèm ký hiệu. compact=true: rút gọn VND thành "27,8 tr" / "1,2 tỷ". */
export function fmtMoney(n, cur = 'VND', opts = {}) {
  const { compact = false, sign = false } = opts;
  if (n == null || Number.isNaN(Number(n))) return '—';
  const info = CUR_INFO[cur] || { symbol: cur, dec: 2 };
  const v = Number(n);
  const abs = Math.abs(v);
  const s = sign && v > 0 ? '+' : v < 0 ? '−' : '';
  if (compact && cur === 'VND') {
    if (abs >= 1e9) return `${s}${fmtNum(abs / 1e9, 2)} tỷ`;
    if (abs >= 1e6) return `${s}${fmtNum(abs / 1e6, 2)} tr`;
  }
  const dec = cur === 'VND' ? 0 : info.dec;
  const body = fmtNum(abs, dec);
  return cur === 'USDT' ? `${s}${body} USDT` : `${s}${body} ${info.symbol}`;
}

/**
 * Tỷ giá ngầm giữa hai số tiền khác tiền tệ, viết theo cách dễ đọc:
 * (7.800.000 VND, 300 USD) → "1 USD = 26.000 VND". Trả '' nếu thiếu số hoặc cùng tiền tệ.
 */
export function impliedRate(x, xCur, y, yCur) {
  const a = Number(x);
  const b = Number(y);
  if (!(a > 0) || !(b > 0) || xCur === yCur) return '';
  return b / a < 1 ? `1 ${yCur} = ${fmtNum(a / b, 2)} ${xCur}` : `1 ${xCur} = ${fmtNum(b / a, 2)} ${yCur}`;
}

const SUFFIX = {
  k: 1e3, 'nghìn': 1e3, 'ngàn': 1e3, ng: 1e3,
  tr: 1e6, 'triệu': 1e6, m: 1e6, 'củ': 1e6,
  'tỷ': 1e9, ty: 1e9, b: 1e9,
  d: 1, 'đ': 1, vnd: 1, '₫': 1,
};
export const SUFFIX_WORDS = Object.keys(SUFFIX);

function parseNumeric(t, hasSuffix) {
  let s = t.trim();
  let sign = 1;
  if (s[0] === '-') { sign = -1; s = s.slice(1); } else if (s[0] === '+') { s = s.slice(1); }
  if (!/^\d[\d.,]*$/.test(s)) return NaN;
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let v;
  if (dots && commas) {
    // dấu cuối cùng là dấu thập phân
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    else v = parseFloat(s.replace(/,/g, ''));
  } else if (dots) {
    if (dots > 1 || (!hasSuffix && /^\d{1,3}(\.\d{3})+$/.test(s))) v = parseFloat(s.replace(/\./g, ''));
    else v = parseFloat(s);
  } else if (commas) {
    if (commas > 1 || (!hasSuffix && /^\d{1,3}(,\d{3})+$/.test(s))) v = parseFloat(s.replace(/,/g, ''));
    else v = parseFloat(s.replace(',', '.'));
  } else {
    v = parseFloat(s);
  }
  return sign * v;
}

/** "25k" → 25000, "1,5tr" → 1500000, "1.500.000" → 1500000, "12.5" → 12.5. Trả NaN nếu không đọc được. */
export function parseAmount(str) {
  if (typeof str === 'number') return str;
  const m = String(str ?? '').trim().toLowerCase().match(/^([+-]?[\d.,]+)\s*([\p{L}₫]+)?$/u);
  if (!m) return NaN;
  let mult = 1;
  if (m[2]) {
    if (!(m[2] in SUFFIX)) return NaN;
    mult = SUFFIX[m[2]];
  }
  const n = parseNumeric(m[1], !!m[2] && mult !== 1);
  return Number.isNaN(n) ? NaN : roundTo(n * mult, 6);
}

// ── Máy tính: + − × ÷ và ngoặc; mỗi số có thể kèm k / tr / tỷ (xem SUFFIX) ──

/** Nhân gõ được: * × x (x chỉ tính khi đứng giữa hai số). Chia gõ được: / ÷. */
const CALC_RE = /[*×÷/()x]/;

/** Tách chuỗi thành số / toán tử / ngoặc. Trả null nếu có ký tự lạ hoặc số không đọc được. */
function tokenizeCalc(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '+' || c === '-') { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '*' || c === '×') { out.push({ t: 'op', v: '*' }); i++; continue; }
    if (c === '/' || c === '÷') { out.push({ t: 'op', v: '/' }); i++; continue; }
    if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
    const prev = out[out.length - 1];
    if (c === 'x' && prev && (prev.t === 'num' || prev.t === ')')) { out.push({ t: 'op', v: '*' }); i++; continue; }
    const m = /^\d[\d.,]*/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    let suffix = '';
    const w = /^[\p{L}₫]+/u.exec(s.slice(i));
    if (w) {
      const word = w[0];
      if (word in SUFFIX) suffix = word;
      else if (word.length > 1 && word.endsWith('x') && word.slice(0, -1) in SUFFIX) suffix = word.slice(0, -1); // "3trx2"
      else if (word[0] !== 'x') return null;
      i += suffix.length;
    }
    const v = parseAmount(m[0] + suffix);
    if (Number.isNaN(v)) return null;
    out.push({ t: 'num', v });
  }
  return out;
}

/** Tính theo đúng thứ tự: ngoặc → × ÷ → + −. Ném lỗi nếu sai cú pháp hoặc chia cho 0. */
function evalTokens(tk) {
  let p = 0;
  const fail = () => { throw new Error('calc'); };
  const isOp = (...ops) => tk[p] && tk[p].t === 'op' && ops.includes(tk[p].v);
  function primary() {
    const t = tk[p];
    if (!t) fail();
    if (t.t === 'num') { p++; return t.v; }
    if (t.t === '(') {
      p++;
      const v = expr();
      if (!tk[p] || tk[p].t !== ')') fail();
      p++;
      return v;
    }
    return fail();
  }
  function unary() {
    if (isOp('+', '-')) { const neg = tk[p++].v === '-'; const v = unary(); return neg ? -v : v; }
    return primary();
  }
  function term() {
    let v = unary();
    while (isOp('*', '/')) {
      const op = tk[p++].v;
      const r = unary();
      if (op === '/') { if (r === 0) fail(); v /= r; } else v *= r;
    }
    return v;
  }
  function expr() {
    let v = term();
    while (isOp('+', '-')) {
      const op = tk[p++].v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const v = expr();
  if (p !== tk.length) fail();
  return v;
}

function calc(s) {
  if (s.length > 200) return null;
  const tk = tokenizeCalc(s.toLowerCase());
  if (!tk || !tk.length) return null;
  try {
    const v = evalTokens(tk);
    return Number.isFinite(v) ? roundTo(v, 6) : null;
  } catch {
    return null;
  }
}

/**
 * Biểu thức tiền: "=-3830-10210-16025", "3tr+500k-120000", "45k*3", "450k/3", "(2tr+500k)*2", "3x25k".
 * Trả {total, parts} hoặc null. Với biểu thức chỉ có + − thì parts là từng số hạng; có × ÷ hoặc ngoặc thì parts = [total].
 */
export function parseExpr(str) {
  const s = String(str ?? '').trim().replace(/^=/, '').replace(/\s+/g, '');
  if (!s) return null;
  if (CALC_RE.test(s.toLowerCase())) {
    const total = calc(s);
    return total == null ? null : { total, parts: [total] };
  }
  const parts = s.split(/(?=[+-])/).filter(Boolean);
  const vals = parts.map(parseAmount);
  if (vals.some((v) => Number.isNaN(v))) return null;
  return { total: roundTo(vals.reduce((a, b) => a + b, 0), 6), parts: vals };
}

/** Làm tròn theo số lẻ của tiền tệ (VND 0, còn lại 2); tiền tệ lạ hoặc rỗng (tỷ giá...) thì giữ nguyên. */
export function roundCur(n, cur) {
  const info = CUR_INFO[cur];
  return info ? roundTo(n, info.dec) : n;
}

/**
 * Số → chuỗi đưa lại vào ô nhập mà parseAmount đọc ra đúng số cũ.
 * Lưu ý "1.234" bị đọc thành 1234 (dấu chấm ngăn nghìn), nên số lẻ đúng 3 chữ số được thêm số 0: "1.2340".
 */
export function toEditable(n, cur = '') {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = cur && CUR_INFO[cur] ? roundTo(n, CUR_INFO[cur].dec) : roundTo(n, 6);
  let s = String(Object.is(v, -0) ? 0 : v);
  if (/^-?\d{1,3}\.\d{3}$/.test(s)) s += '0';
  return s;
}
