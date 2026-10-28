// Lõi tính toán sổ cái. Hàm thuần: nhận dữ liệu, trả kết quả, không đụng DOM hay mạng.
// Nguyên tắc: số dư và công nợ luôn được TÍNH RA từ giao dịch, không lưu thành số nhập tay.

import { roundTo } from './money.js';
import { monthOf, lastMonths } from './dates.js';

/** Dấu ảnh hưởng lên công nợ của đối tác: dương = người đó nợ mình nhiều hơn. */
export const DEBT_SIGN = { lend: 1, repay_in: -1, borrow: -1, repay_out: 1 };

/**
 * Số tiền thật sự đi vào / đi ra tài khoản, tính theo tiền tệ CỦA TÀI KHOẢN.
 * Thường bằng `amount`. Khoản vay nợ có thể khác tiền tệ với tài khoản (ví dụ đổi đô la ở Vietcombank
 * rồi chuyển đồng cho người vay): khi đó `amount`/`currency` là khoản nợ (VND) còn `accountAmount`
 * là số đô la bị trừ khỏi tài khoản.
 */
export function accAmount(tx) {
  const v = tx.accountAmount;
  if (v != null && v !== '' && Number(v) > 0) return Number(v);
  return Number(tx.amount) || 0;
}

/** Các thay đổi số dư [accountId, delta] của một giao dịch. */
export function accountEffects(tx) {
  const a = Number(tx.amount) || 0;
  const s = accAmount(tx);
  const out = [];
  switch (tx.kind) {
    case 'income':
    case 'repay_in':
    case 'borrow':
      if (tx.accountId) out.push([tx.accountId, s]);
      break;
    case 'expense':
    case 'lend':
    case 'repay_out':
      if (tx.accountId) out.push([tx.accountId, -s]);
      break;
    case 'transfer':
      if (tx.accountId) out.push([tx.accountId, -a]);
      if (tx.toAccountId) out.push([tx.toAccountId, tx.toAmount != null && tx.toAmount !== '' ? Number(tx.toAmount) : a]);
      break;
    case 'adjust':
      if (tx.accountId) out.push([tx.accountId, a]); // a có thể âm
      break;
    default:
  }
  return out;
}

/** Map accountId → số dư hiện tại (theo tiền tệ của tài khoản). */
export function accountBalances(accounts, txs) {
  const bal = new Map();
  for (const a of accounts) bal.set(a.id, Number(a.opening) || 0);
  for (const t of txs) {
    for (const [id, d] of accountEffects(t)) {
      if (bal.has(id)) bal.set(id, bal.get(id) + d);
    }
  }
  for (const [k, v] of bal) bal.set(k, roundTo(v, 6));
  return bal;
}

/** Map partyId → { [currency]: số tiền }, dương = họ nợ mình, âm = mình nợ họ. */
export function debtBalances(txs) {
  const m = new Map();
  for (const t of txs) {
    const s = DEBT_SIGN[t.kind];
    if (!s || !t.partyId) continue;
    const cur = t.currency || 'VND';
    const o = m.get(t.partyId) || {};
    o[cur] = (o[cur] || 0) + s * (Number(t.amount) || 0);
    m.set(t.partyId, o);
  }
  for (const o of m.values()) for (const c of Object.keys(o)) o[c] = roundTo(o[c], 6);
  return m;
}

/** Quy đổi sang VND bằng tỷ giá trong Cài đặt. Trả null nếu thiếu tỷ giá. */
export function toBase(amount, cur, rates) {
  const v = Number(amount) || 0;
  if (!cur || cur === 'VND') return v;
  const r = Number(rates && rates[cur]);
  if (!(r > 0)) return null;
  return v * r;
}

function addTo(obj, cur, v) {
  obj[cur] = roundTo((obj[cur] || 0) + v, 6);
}

/** Tổng quan tài sản: tiền thật, khoản cho vay, khoản đang nợ — theo từng tiền tệ và quy đổi VND. */
export function overview({ accounts, txs, rates }) {
  const balances = accountBalances(accounts, txs);
  const debts = debtBalances(txs);
  const cash = {};
  const receivable = {};
  const payable = {};
  for (const a of accounts) {
    if (a.networth === false) continue;
    addTo(cash, a.currency, balances.get(a.id) || 0);
  }
  for (const o of debts.values()) {
    for (const [cur, v] of Object.entries(o)) {
      if (v > 0) addTo(receivable, cur, v);
      else if (v < 0) addTo(payable, cur, -v);
    }
  }
  const missing = new Set();
  const sum = (obj) => {
    let t = 0;
    for (const [cur, v] of Object.entries(obj)) {
      const b = toBase(v, cur, rates);
      if (b == null) missing.add(cur);
      else t += b;
    }
    return t;
  };
  const base = { cash: sum(cash), receivable: sum(receivable), payable: sum(payable) };
  base.net = base.cash + base.receivable - base.payable;
  return { balances, debts, cash, receivable, payable, base, missing: [...missing] };
}

/** Thu/chi trong một khoảng ngày, quy ra VND. Chỉ tính kind income/expense. */
export function periodStats(txs, { from, to }, rates) {
  let income = 0;
  let expense = 0;
  const byCat = new Map();
  const missing = new Set();
  for (const t of txs) {
    if (t.kind !== 'income' && t.kind !== 'expense') continue;
    if (t.date < from || t.date > to) continue;
    const b = toBase(t.amount, t.currency, rates);
    if (b == null) { missing.add(t.currency); continue; }
    if (t.kind === 'income') income += b;
    else {
      expense += b;
      const k = t.categoryId || '_none';
      byCat.set(k, (byCat.get(k) || 0) + b);
    }
  }
  const cats = [...byCat.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
  return { income, expense, net: income - expense, cats, missing: [...missing] };
}

/**
 * Các khoản thu (kind 'income': lương, học bổng, lãi đổi tiền…) trong khoảng ngày; lọc thêm theo tài khoản /
 * danh mục. Không tính nhận trả nợ hay đi vay (đó không phải tiền kiếm được).
 * Trả: tổng quy ra VND, số khoản, tổng theo từng tiền tệ gốc, tổng theo danh mục (quy VND, lớn → nhỏ).
 */
export function incomeStats(txs, { from, to, accountId = '', categoryId = '' } = {}, rates) {
  let total = 0;
  let count = 0;
  const byCur = {};
  const byCat = new Map();
  const missing = new Set();
  for (const t of txs) {
    if (t.kind !== 'income') continue;
    if (from && t.date < from) continue;
    if (to && t.date > to) continue;
    if (accountId && t.accountId !== accountId) continue;
    if (categoryId && t.categoryId !== categoryId) continue;
    count += 1;
    const cur = t.currency || 'VND';
    addTo(byCur, cur, Number(t.amount) || 0);
    const b = toBase(t.amount, cur, rates);
    if (b == null) { missing.add(cur); continue; }
    total += b;
    const k = t.categoryId || '_none';
    byCat.set(k, (byCat.get(k) || 0) + b);
  }
  const cats = [...byCat.entries()].map(([id, amount]) => ({ categoryId: id, amount })).sort((a, b) => b.amount - a.amount);
  return { total, count, byCur, cats, missing: [...missing] };
}

/** Chuỗi thu/chi theo tháng, kết thúc ở endMonth ('YYYY-MM'). */
export function monthlySeries(txs, endMonth, count, rates) {
  const months = lastMonths(endMonth, count);
  const idx = new Map(months.map((m, i) => [m, i]));
  const out = months.map((m) => ({ month: m, income: 0, expense: 0 }));
  for (const t of txs) {
    if (t.kind !== 'income' && t.kind !== 'expense') continue;
    const i = idx.get(monthOf(t.date));
    if (i == null) continue;
    const b = toBase(t.amount, t.currency, rates);
    if (b == null) continue;
    if (t.kind === 'income') out[i].income += b;
    else out[i].expense += b;
  }
  return out;
}

/** Tình trạng ngân sách tháng: [{budget, spent, limit, pct}]. */
export function budgetStatus(budgets, cats, rates) {
  const spent = new Map(cats.map((c) => [c.categoryId, c.amount]));
  return budgets.map((b) => {
    const limit = toBase(b.amount, b.currency || 'VND', rates) ?? 0;
    const s = b.categoryId ? spent.get(b.categoryId) || 0 : [...spent.values()].reduce((x, y) => x + y, 0);
    return { budget: b, spent: s, limit, pct: limit > 0 ? s / limit : 0 };
  });
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu. */
export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function filterTxs(txs, f = {}) {
  const q = f.q ? fold(f.q) : '';
  return txs.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false;
    if (f.categoryId && t.categoryId !== f.categoryId) return false;
    if (f.partyId && t.partyId !== f.partyId) return false;
    if (f.kind && t.kind !== f.kind) return false;
    if (q && !fold(`${t.note || ''}`).includes(q)) return false;
    return true;
  });
}

export function sortTxs(txs) {
  return [...txs].sort((a, b) => (a.date === b.date ? (b.ts || 0) - (a.ts || 0) : a.date < b.date ? 1 : -1));
}

/** Nhóm theo ngày (mới → cũ). Mỗi nhóm có tổng thu/chi theo VND để hiển thị. */
export function groupByDate(txs, rates) {
  const map = new Map();
  for (const t of sortTxs(txs)) {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date).push(t);
  }
  return [...map.entries()].map(([date, items]) => {
    let income = 0;
    let expense = 0;
    for (const t of items) {
      const b = toBase(t.amount, t.currency, rates) ?? 0;
      if (t.kind === 'income') income += b;
      else if (t.kind === 'expense') expense += b;
    }
    return { date, items, income, expense };
  });
}

/** Ngày giao dịch gần nhất theo từng đối tác (để biết khoản nợ "nằm" bao lâu). */
export function lastDebtDates(txs) {
  const m = new Map();
  for (const t of txs) {
    if (!DEBT_SIGN[t.kind] || !t.partyId) continue;
    if (!m.has(t.partyId) || m.get(t.partyId) < t.date) m.set(t.partyId, t.date);
  }
  return m;
}
