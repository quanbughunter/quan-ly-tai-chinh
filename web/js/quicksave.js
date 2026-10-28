// Nhập nhanh: từ các khoản đã đọc ra → danh sách giao dịch cần lưu. Hàm thuần (không đụng giao diện) để kiểm thử.
//
// Tài khoản có thể là null ("không gắn tài khoản"): giao dịch lưu với accountId '' nên không đổi số dư thẻ nào,
// nhưng vẫn vào thống kê thu / chi. Khi đó tiền tệ lấy theo từng khoản (gõ "12 usd", mặc định VND).

import { planShare, buildShareTxs, planSendHome, buildSendHomeTx } from './share.js';

export const HOME_NAME = 'bố';

/** Trạng thái chia nợ mặc định của một khoản. */
export const newDebt = ({ includeMe = true } = {}) => ({ mode: 'none', partyIds: [], includeMe, manual: {}, bad: {} });
/** Trạng thái "gửi cho bố" mặc định của một khoản thu. */
export const newHome = (on = false) => ({ on, manual: null, bad: false });

/** Khoản có lệch tiền tệ với tài khoản đang chọn không (không có tài khoản thì không bao giờ lệch). */
export const isMismatch = (item, account) => !!account && item.currency !== account.currency;

export function planOf(it) {
  const d = it.debt;
  if (!d || d.mode === 'none') return { ok: true, shares: {}, myShare: 0 };
  if (Object.keys(d.bad).length) return { ok: false, error: 'Có ô số tiền chưa đọc được.', shares: {}, myShare: 0 };
  return planShare({ mode: d.mode, amount: it.amount, currency: it.currency, partyIds: d.partyIds, includeMe: d.includeMe, manual: d.manual });
}

export function homePlanOf(it) {
  const hm = it.home;
  if (it.kind !== 'income' || !hm || !hm.on) return { ok: true, amount: 0, keep: 0 };
  if (hm.bad) return { ok: false, error: 'Ô số tiền gửi chưa đọc được.', amount: 0, keep: 0 };
  return planSendHome({ amount: it.amount, sendAmount: hm.manual, currency: it.currency });
}

export const itemOk = (it) => !it.error && !it.mismatch && planOf(it).ok && homePlanOf(it).ok;

/**
 * @param {object} p
 * @param {Array} p.items       các khoản (xem parseQuick + debt/home); khoản lỗi / lệch tiền tệ bị bỏ qua
 * @param {object|null} p.account  tài khoản nhận; null = không gắn tài khoản
 * @param {string} p.date
 * @param {(id:string)=>string} [p.nameOf]   tên người theo id (cho ghi chú chia nợ)
 * @param {string} [p.familyCategoryId]  danh mục cho khoản "gửi cho bố"
 * @param {()=>number} [p.now]
 * @returns {{docs:Array, shared:number, sent:number, lastPeople:string[]|null}}
 */
export function buildQuickDocs({ items, account = null, date, nameOf = (id) => id, familyCategoryId = '', now = Date.now }) {
  const accountId = account ? account.id : '';
  const docs = [];
  let n = 0;
  let shared = 0;
  let sent = 0;
  let lastPeople = null;
  const ts = () => now() + (n += 1);
  for (const i of items.filter(itemOk)) {
    if (!i.debt || i.debt.mode === 'none') {
      docs.push({ date, kind: i.kind, amount: i.amount, currency: i.currency, accountId, categoryId: i.categoryId || '', note: i.note, ts: ts() });
      if (i.kind === 'income') {
        const hp = homePlanOf(i);
        if (i.home && i.home.on && hp.ok) {
          docs.push({ ...buildSendHomeTx({ date, amount: hp.amount, currency: i.currency, accountId, categoryId: familyCategoryId, note: i.note, toName: HOME_NAME }), ts: ts() });
          sent += 1;
        }
      }
    } else {
      const plan = planOf(i);
      for (const t of buildShareTxs({ mode: i.debt.mode, plan, date, currency: i.currency, accountId, note: i.note, categoryId: i.categoryId, nameOf })) docs.push({ ...t, ts: ts() });
      shared += 1;
      lastPeople = i.debt.partyIds;
    }
  }
  return { docs, shared, sent, lastPeople };
}
