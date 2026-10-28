// Nhập nhanh ↔ Vay nợ: chia một khoản chi/thu cho những người trong danh sách Vay nợ.
// Toàn hàm thuần (không đụng DOM/store) để kiểm thử được.
//
// Hai chế độ:
//  • 'add'  = CỘNG NỢ — mình trả hộ. Tài khoản bị trừ đủ số tiền; mỗi người nợ mình thêm phần của họ
//             (giao dịch "Cho vay"). Có thể tính cả phần của mình thành một khoản chi bình thường.
//  • 'sub'  = TRỪ NỢ — họ đưa tiền cho mình. Tài khoản được cộng đủ số tiền; nợ của mỗi người
//             giảm đúng phần họ trả (giao dịch "Thu nợ"). Không phát sinh khoản thu nào khác.
//
// Tiền tính theo đơn vị nhỏ nhất của loại tiền (VND: 1 đồng, RUB/USD: 0,01) nên tổng các phần
// LUÔN khớp đúng số tiền, không lệch số lẻ.

import { CUR_INFO, fmtMoney } from './money.js';

export const SHARE_MODES = { none: 'none', add: 'add', sub: 'sub' };

const decOf = (cur) => (CUR_INFO[cur] ? CUR_INFO[cur].dec : 2);
const toUnits = (amount, cur) => Math.round((Number(amount) + Number.EPSILON) * 10 ** decOf(cur));
const fromUnits = (u, cur) => u / 10 ** decOf(cur);

/** Chia đều `total` cho n phần; số lẻ (đơn vị nhỏ nhất) dồn cho những phần đầu. Tổng luôn bằng total. */
export function splitEven(total, n, cur = 'VND') {
  if (!(n >= 1)) return [];
  const u = toUnits(total, cur);
  const base = Math.floor(u / n);
  const rem = u - base * n;
  return Array.from({ length: n }, (_, i) => fromUnits(base + (i < rem ? 1 : 0), cur));
}

/**
 * Tính phần của từng người.
 * @param {object} o
 * @param {'add'|'sub'|'none'} o.mode
 * @param {number} o.amount        tổng số tiền của khoản nhập nhanh
 * @param {string} o.currency
 * @param {string[]} o.partyIds    những người được chọn (thứ tự giữ nguyên)
 * @param {boolean} [o.includeMe]  chỉ có nghĩa với 'add': mình cũng ăn một phần (ghi thành chi tiêu của mình)
 * @param {Object<string,number>} [o.manual] phần nhập tay theo partyId — các phần còn lại chia đều số tiền còn dư
 * @returns {{ ok: boolean, error?: string, shares: Object<string,number>, myShare: number }}
 */
export function planShare({ mode, amount, currency = 'VND', partyIds = [], includeMe = false, manual = {} } = {}) {
  const none = { ok: true, shares: {}, myShare: 0 };
  if (mode !== 'add' && mode !== 'sub') return none;
  const fail = (error) => ({ ok: false, error, shares: {}, myShare: 0 });
  const total = toUnits(amount, currency);
  if (!(total > 0)) return fail('Số tiền không hợp lệ.');
  const ids = [...new Set(partyIds)];
  if (!ids.length) return fail('Chọn ít nhất một người.');
  const me = mode === 'add' && !!includeMe;

  const fixed = {};
  for (const id of ids) {
    const v = manual && manual[id];
    if (v == null || v === '' || !Number.isFinite(Number(v))) continue;
    const u = toUnits(v, currency);
    if (!(u > 0)) return fail('Phần của mỗi người phải lớn hơn 0.');
    fixed[id] = u;
  }
  const free = ids.filter((id) => !(id in fixed));
  const fixedSum = Object.values(fixed).reduce((s, u) => s + u, 0);
  const rest = total - fixedSum;
  if (rest < 0) return fail(`Các phần nhập tay vượt số tiền (dư ${fmtMoney(fromUnits(-rest, currency), currency)}).`);

  const units = { ...fixed };
  let myUnits = 0;
  const parts = free.length + (me ? 1 : 0);
  if (parts === 0) {
    if (rest !== 0) return fail(`Các phần chưa khớp số tiền (còn thiếu ${fmtMoney(fromUnits(rest, currency), currency)}).`);
  } else {
    const base = Math.floor(rest / parts);
    let rem = rest - base * parts;
    if (me) { myUnits = base + rem; rem = 0; } // người trả gánh số lẻ, người khác không bị tính dư
    free.forEach((id) => { units[id] = base + (rem > 0 ? 1 : 0); if (rem > 0) rem -= 1; });
    if (free.some((id) => !(units[id] > 0))) return fail('Số tiền quá nhỏ để chia cho từng người.');
  }
  const shares = {};
  for (const id of ids) shares[id] = fromUnits(units[id], currency);
  return { ok: true, shares, myShare: fromUnits(myUnits, currency) };
}

/**
 * Dựng các giao dịch sẽ ghi (chưa có id). `plan` lấy từ planShare (phải ok).
 * - 'add': mỗi người một giao dịch lend (tài khoản −, họ nợ thêm) + (nếu có) một khoản chi phần của mình.
 * - 'sub': mỗi người một giao dịch repay_in (tài khoản +, nợ giảm).
 */
export function buildShareTxs({ mode, plan, date, currency, accountId, note = '', categoryId = '', nameOf = (id) => id }) {
  if (!plan || !plan.ok || (mode !== 'add' && mode !== 'sub')) return [];
  const base = String(note || '').trim();
  const out = [];
  for (const [partyId, amount] of Object.entries(plan.shares)) {
    const who = nameOf(partyId);
    out.push(mode === 'add'
      ? { date, kind: 'lend', amount, currency, accountId, partyId, categoryId: '', note: `${base || 'Tiền ăn'} · phần của ${who}` }
      : { date, kind: 'repay_in', amount, currency, accountId, partyId, categoryId: '', note: `${base || 'Trả tiền'} · ${who} trả` });
  }
  if (mode === 'add' && plan.myShare > 0) {
    out.push({ date, kind: 'expense', amount: plan.myShare, currency, accountId, categoryId: categoryId || '', note: `${base || 'Tiền ăn'} (phần mình)` });
  }
  return out;
}

/**
 * Khoản thu rồi gửi một phần (hoặc cả khoản) cho người nhà — ví dụ lương vào thẻ MB, gửi bố.
 * sendAmount trống / null = gửi cả khoản. Số gửi phải > 0 và không vượt khoản thu.
 * @returns {{ ok: boolean, error?: string, amount: number, keep: number }}
 */
export function planSendHome({ amount, sendAmount = null, currency = 'VND' } = {}) {
  const total = toUnits(amount, currency);
  const fail = (error) => ({ ok: false, error, amount: 0, keep: 0 });
  if (!(total > 0)) return fail('Số tiền không hợp lệ.');
  const blank = sendAmount == null || sendAmount === '';
  const u = blank ? total : toUnits(sendAmount, currency);
  if (!Number.isFinite(u) || !(u > 0)) return fail('Số tiền gửi phải lớn hơn 0.');
  if (u > total) return fail(`Số gửi vượt khoản thu (dư ${fmtMoney(fromUnits(u - total, currency), currency)}).`);
  return { ok: true, amount: fromUnits(u, currency), keep: fromUnits(total - u, currency) };
}

/** Khoản chi ghi thêm khi gửi tiền cho người nhà (chưa có id). Trừ vào cùng tài khoản đã nhận khoản thu. */
export function buildSendHomeTx({ date, amount, currency, accountId, categoryId = '', note = '', toName = 'bố' }) {
  const base = String(note || '').trim();
  return { date, kind: 'expense', amount, currency, accountId, categoryId: categoryId || '', note: `Gửi ${toName}${base ? ` · ${base}` : ''}` };
}

/** Câu tóm tắt cho khoản thu có gửi người nhà. */
export function describeSendHome({ plan, currency, toName = 'bố' }) {
  if (!plan || !plan.ok) return plan && plan.error ? plan.error : '';
  const m = (v) => fmtMoney(v, currency);
  return plan.keep > 0
    ? `Gửi ${toName} ${m(plan.amount)}, giữ lại ${m(plan.keep)}. Phần gửi ghi thành một khoản chi (Biếu gia đình).`
    : `Gửi ${toName} cả ${m(plan.amount)}. Khoản này ghi thành một khoản chi (Biếu gia đình), tài khoản về lại như trước khi nhận.`;
}

/** Câu tóm tắt tác động lên tài khoản + nợ, để người dùng kiểm tra trước khi lưu. */
export function describeShare({ mode, amount, currency, plan, nameOf = (id) => id }) {
  if (!plan || !plan.ok) return plan && plan.error ? plan.error : '';
  const m = (v) => fmtMoney(v, currency);
  const who = Object.entries(plan.shares);
  if (mode === 'add') {
    const parts = [`Tài khoản −${m(amount)} (mình trả hết).`];
    if (plan.myShare > 0) parts.push(`Chi tiêu của mình ${m(plan.myShare)}.`);
    parts.push(`${who.map(([id, v]) => `${nameOf(id)} nợ thêm ${m(v)}`).join('; ')}.`);
    return parts.join(' ');
  }
  return `Tài khoản +${m(amount)}. ${who.map(([id, v]) => `${nameOf(id)} trả ${m(v)} → nợ giảm ${m(v)}`).join('; ')}.`;
}
