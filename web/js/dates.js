// Ngày lưu dạng chuỗi 'YYYY-MM-DD' (giờ địa phương) để không bị lệch múi giờ.

export const pad = (n) => String(n).padStart(2, '0');

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const monthOf = (s) => String(s || '').slice(0, 7);

export function isDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

export function fmtDate(s) {
  if (!isDateStr(s)) return s || '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const DOW = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
export function fmtDayLong(s) {
  if (!isDateStr(s)) return s || '';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]}, ${pad(d)}/${pad(m)}/${y}`;
}

export function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

export function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${key}-01`, to: `${key}-${pad(last)}` };
}

export function lastMonths(endKey, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(addMonths(endKey, -i));
  return out;
}

/** Số ngày từ a đến b (b - a). */
export function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
