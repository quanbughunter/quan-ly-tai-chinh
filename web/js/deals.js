// Lệnh đổi tiền: báo giá → chốt giao dịch → (tùy chọn) tự cộng lãi vào thẻ.
//
// Quy tắc cốt lõi:
//  - Lệnh ở trạng thái "quote" (báo giá) chỉ là ghi chép. KHÔNG làm thay đổi số dư nào.
//  - Khi chốt (status = "done"), lãi ghi nhận (deal.profit, đơn vị VND) được cộng vào thẻ nhận lãi
//    (mặc định: thẻ MB) bằng MỘT giao dịch thu, đúng ngày của lệnh. Giao dịch này gắn dealId để
//    sửa/hủy chốt/xóa lệnh thì giao dịch lãi đi theo, số dư luôn khớp.
//  - Lãi âm (lỗ) được ghi là một khoản chi.

import { store } from './store.js';
import { evalDeal } from './fx.js';
import { uid } from './model.js';

export const DEAL_STATUS = { quote: 'Báo giá', done: 'Đã chốt' };
export const DIR_LABEL = { sang: 'Sang', ve: 'Về' };

export const statusOf = (d) => (d && d.status === 'done' ? 'done' : 'quote');

/** Lãi đã ghi nhận của một lệnh đã chốt (VND). Lệnh báo giá → null. */
export function dealProfit(d, params = {}) {
  if (statusOf(d) !== 'done') return null;
  if (Number.isFinite(Number(d.profit)) && d.profit !== '' && d.profit != null) return Number(d.profit);
  const p = evalDeal(d, params).profit;
  return p == null ? 0 : p;
}

/** Chọn thẻ nhận lãi: cài đặt → thẻ có tên chứa "MB" → thẻ VND đầu tiên. */
export function pickProfitAccountId(accounts, params = {}) {
  const vnd = (accounts || []).filter((a) => !a.archived && a.currency === 'VND');
  if (params.dealAccountId && vnd.some((a) => a.id === params.dealAccountId)) return params.dealAccountId;
  const mb = vnd.find((a) => /(^|[^a-z0-9])mb([^a-z0-9]|$)/i.test(a.name));
  return (mb || vnd[0] || {}).id || '';
}
export const defaultProfitAccountId = () => pickProfitAccountId(store.all('accounts'), store.settings().params);

/**
 * Giao dịch lãi sẽ ghi vào thẻ cho một lệnh đã chốt. Hàm thuần (dễ kiểm thử).
 * Lãi = 0 → không có giao dịch (null).
 */
export function profitTxFor(deal, { accountId, incomeCategoryId = '', expenseCategoryId = '', partyName = '' } = {}) {
  const p = Math.round(Number(deal.profit) || 0);
  if (!p || !accountId) return null;
  const head = p > 0 ? `Lãi đổi tiền ${DIR_LABEL[deal.dir] || ''}` : `Lỗ đổi tiền ${DIR_LABEL[deal.dir] || ''}`;
  return {
    date: deal.date,
    kind: p > 0 ? 'income' : 'expense',
    amount: Math.abs(p),
    currency: 'VND',
    accountId,
    categoryId: p > 0 ? incomeCategoryId : expenseCategoryId,
    note: [head.trim(), partyName, deal.note].filter(Boolean).join(' · '),
    dealId: deal.id,
  };
}

function categoryIds() {
  const cats = store.all('categories');
  const by = (type, name) => (cats.find((c) => c.type === type && c.name === name) || {}).id || '';
  return { incomeCategoryId: by('income', 'Kinh doanh đổi tiền'), expenseCategoryId: by('expense', 'Chi khác') };
}

function specFor(deal, accountId) {
  const party = deal.partyId && store.byId('parties', deal.partyId);
  return profitTxFor(deal, { accountId, ...categoryIds(), partyName: party ? party.name : '' });
}

/**
 * Lưu một lệnh (mới hoặc sửa). deal.id bắt buộc (tạo bằng newDealId()).
 *  - status 'quote'  → mọi giao dịch lãi cũ của lệnh (nếu có) bị xóa.
 *  - status 'done' + post → tạo/cập nhật giao dịch lãi vào accountId.
 *  - status 'done' + !post → chốt nhưng không cộng vào thẻ (đánh dấu postSkipped).
 * Ghi lỗi giữa chừng thì hoàn tác phần đã ghi.
 */
export async function saveDeal(deal, { post = false, accountId = '' } = {}) {
  if (!deal.id) throw new Error('Lệnh thiếu mã.');
  const prev = store.byId('deals', deal.id);
  const oldTx = prev && prev.profitTxId ? store.byId('txs', prev.profitTxId) : null;
  const doc = { ...deal };
  delete doc.profitTxId;
  delete doc.postSkipped;

  let spec = null;
  if (doc.status === 'done') {
    doc.profit = Math.round(Number(doc.profit) || 0);
    if (post) {
      if (!accountId) throw new Error('Chọn thẻ để cộng lãi, hoặc bỏ chọn “Cộng lãi vào thẻ”.');
      spec = specFor(doc, accountId);
    } else {
      doc.postSkipped = true;
    }
  }

  let undo = async () => {};
  if (spec) {
    const saved = await store.put('txs', { ...(oldTx || {}), ...spec, id: oldTx ? oldTx.id : uid() });
    doc.profitTxId = saved.id;
    undo = oldTx ? () => store.put('txs', oldTx) : () => store.del('txs', saved.id);
  } else if (oldTx) {
    await store.del('txs', oldTx.id);
    undo = () => store.put('txs', oldTx);
  }
  try {
    return await store.put('deals', doc);
  } catch (e) {
    try { await undo(); } catch { /* giữ lỗi gốc */ }
    throw e;
  }
}

/** Chốt giao dịch (hoặc cập nhật lệnh đã chốt). */
export const confirmDeal = (deal, opts) => saveDeal({ ...deal, status: 'done' }, opts);

/** Hủy chốt: về lại báo giá, xóa giao dịch lãi đã cộng. */
export async function revertDeal(id) {
  const d = store.byId('deals', id);
  if (!d) return;
  const { profit, profitTxId, postSkipped, ...rest } = d; // eslint-disable-line no-unused-vars
  return saveDeal({ ...rest, status: 'quote' });
}

/** Xóa lệnh, kèm giao dịch lãi đã cộng (nếu có). */
export async function removeDeal(id) {
  const d = store.byId('deals', id);
  if (!d) return;
  const tx = d.profitTxId ? store.byId('txs', d.profitTxId) : null;
  if (tx) await store.del('txs', tx.id);
  try {
    await store.del('deals', id);
  } catch (e) {
    if (tx) { try { await store.put('txs', tx); } catch { /* giữ lỗi gốc */ } }
    throw e;
  }
}

/** Lệnh đã chốt nhưng chưa cộng lãi vào thẻ và chưa bị "bỏ qua" (ví dụ lệnh nhập từ sheet cũ). */
export function pendingPost() {
  return store.all('deals').filter((d) => statusOf(d) === 'done' && !d.profitTxId && !d.postSkipped && Math.round(Number(d.profit) || 0) !== 0);
}

/** Cộng bù lãi của các lệnh đang chờ vào một thẻ. */
export async function postPending(accountId) {
  const list = pendingPost();
  if (!list.length) return 0;
  if (!accountId) throw new Error('Chọn thẻ để cộng lãi.');
  const txs = list.map((d) => ({ ...specFor(d, accountId), id: uid() }));
  await store.putMany('txs', txs);
  try {
    await store.putMany('deals', list.map((d, i) => ({ ...d, profitTxId: txs[i].id })));
  } catch (e) {
    try { await store.delMany('txs', txs.map((t) => t.id)); } catch { /* giữ lỗi gốc */ }
    throw e;
  }
  return list.length;
}

/** Đánh dấu "không cộng" cho các lệnh đang chờ (số dư thẻ đã tính sẵn lãi này rồi). */
export async function skipPending() {
  const list = pendingPost();
  if (!list.length) return 0;
  await store.putMany('deals', list.map((d) => ({ ...d, postSkipped: true })));
  return list.length;
}

export const newDealId = () => uid();

/* Từ màn hình Giao dịch có thể yêu cầu mở một lệnh ở màn hình Báo tỉ giá. */
let openRequest = null;
export const requestOpenDeal = (id) => { openRequest = id; };
export function takeOpenRequest() { const r = openRequest; openRequest = null; return r; }
