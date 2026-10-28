// Tiền tệ, định dạng và đọc số tiền gõ tay (25k, 1,5tr, 573000+500000-3000000...)

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

/** Biểu thức cộng/trừ kiểu "=-3830-10210-16025" hoặc "3tr+500k-120000". Trả {total, parts} hoặc null. */
export function parseExpr(str) {
  let s = String(str ?? '').trim().replace(/^=/, '').replace(/\s+/g, '');
  if (!s) return null;
  const parts = s.split(/(?=[+-])/).filter(Boolean);
  const vals = parts.map(parseAmount);
  if (vals.some((v) => Number.isNaN(v))) return null;
  return { total: roundTo(vals.reduce((a, b) => a + b, 0), 6), parts: vals };
}
