// Học bổng MIIGAiK: mỗi tháng một dòng. Khi tick "Đã nhận" và chọn thẻ, số tiền học bổng
// được cộng vào thẻ đó bằng MỘT giao dịch thu (₽), đúng ngày thực nhận.
//
// Quy tắc cốt lõi:
//  - Tháng chưa nhận → chỉ là ghi chép, KHÔNG làm thay đổi số dư nào.
//  - Tháng đã nhận + chọn thẻ → có một giao dịch thu gắn scholarshipId (và học bổng giữ txId).
//    Sửa tiền / ngày / thẻ, bỏ "đã nhận" hoặc xóa tháng thì giao dịch đi theo, số dư luôn khớp.
//  - Tháng đã nhận nhưng KHÔNG chọn thẻ (ví dụ các tháng nhập từ sheet cũ, số dư thẻ đã tính sẵn)
//    thì không ghi giao dịch nào.

import { store } from './store.js';
import { uid } from './model.js';
import { monthLabel } from './dates.js';

export const SCHOLARSHIP_NAME = 'Học bổng MIIGAiK';
export const SCHOLARSHIP_CURRENCY = 'RUB';
export const DEFAULT_SCHOLARSHIP_AMOUNT = 15000;

export const isReceived = (s) => !!(s && s.receivedDate);

/** Số tiền học bổng mỗi tháng: cài đặt → mặc định 15.000 ₽. */
export function scholarshipAmount(params = {}) {
  const v = Number(params.scholarshipAmount);
  return v > 0 ? v : DEFAULT_SCHOLARSHIP_AMOUNT;
}

/** Thẻ có thể nhận học bổng: tài khoản ₽ còn dùng, trừ sổ tiết kiệm. */
export const receivingAccounts = (accounts) =>
  (accounts || []).filter((a) => !a.archived && a.currency === SCHOLARSHIP_CURRENCY && a.kind !== 'savings');

/** Thẻ chọn sẵn: lần chọn trước (cài đặt) → thẻ tên có "Gazprom" → thẻ tên có "PSPB" → thẻ ₽ đầu tiên. */
export function pickScholarshipAccountId(accounts, params = {}) {
  const list = receivingAccounts(accounts);
  if (params.scholarshipAccountId && list.some((a) => a.id === params.scholarshipAccountId)) return params.scholarshipAccountId;
  const by = (re) => list.find((a) => re.test(a.name));
  return (by(/gazprom/i) || by(/pspb/i) || list[0] || {}).id || '';
}
export const defaultScholarshipAccountId = () => pickScholarshipAccountId(store.all('accounts'), store.settings().params);

/**
 * Giao dịch thu sẽ ghi vào thẻ cho một tháng học bổng đã nhận. Hàm thuần (dễ kiểm thử).
 * Thiếu thẻ, thiếu ngày nhận hoặc số tiền ≤ 0 → null.
 */
export function scholarshipTxFor(item, { accountId, categoryId = '' } = {}) {
  const amount = Math.round((Number(item && item.amount) || 0) * 100) / 100;
  if (!item || !accountId || !item.receivedDate || !(amount > 0)) return null;
  return {
    date: item.receivedDate,
    kind: 'income',
    amount,
    currency: SCHOLARSHIP_CURRENCY,
    accountId,
    categoryId,
    note: item.month ? `${SCHOLARSHIP_NAME} · ${monthLabel(item.month)}` : SCHOLARSHIP_NAME,
    scholarshipId: item.id,
  };
}

const incomeCategoryId = () => (store.all('categories').find((c) => c.type === 'income' && c.name === 'Học bổng') || {}).id || '';

/**
 * Lưu một tháng học bổng (mới hoặc sửa). doc.id bắt buộc (tạo bằng newScholarshipId()).
 *  - Đã nhận (có receivedDate) + post → tạo/cập nhật giao dịch thu vào accountId.
 *  - Ngược lại → giao dịch cũ (nếu có) bị xóa.
 * Ghi lỗi giữa chừng thì hoàn tác phần đã ghi.
 */
export async function saveScholarship(doc0, { post = false, accountId = '' } = {}) {
  if (!doc0.id) throw new Error('Tháng học bổng thiếu mã.');
  const prev = store.byId('scholarships', doc0.id);
  const oldTx = prev && prev.txId ? store.byId('txs', prev.txId) : null;
  const doc = { ...doc0 };
  delete doc.txId;

  let spec = null;
  if (post && isReceived(doc)) {
    if (!accountId) throw new Error('Chọn thẻ nhận học bổng, hoặc chọn “Không cộng vào thẻ”.');
    if (!(Number(doc.amount) > 0)) throw new Error('Nhập số tiền học bổng để cộng vào thẻ.');
    spec = scholarshipTxFor(doc, { accountId, categoryId: incomeCategoryId() });
  }

  let undo = async () => {};
  if (spec) {
    const saved = await store.put('txs', { ...(oldTx || {}), ...spec, id: oldTx ? oldTx.id : uid() });
    doc.txId = saved.id;
    undo = oldTx ? () => store.put('txs', oldTx) : () => store.del('txs', saved.id);
  } else if (oldTx) {
    await store.del('txs', oldTx.id);
    undo = () => store.put('txs', oldTx);
  }
  try {
    return await store.put('scholarships', doc);
  } catch (e) {
    try { await undo(); } catch { /* giữ lỗi gốc */ }
    throw e;
  }
}

/** Xóa một tháng học bổng, kèm giao dịch đã cộng vào thẻ (nếu có). */
export async function removeScholarship(id) {
  const s = store.byId('scholarships', id);
  if (!s) return;
  const tx = s.txId ? store.byId('txs', s.txId) : null;
  if (tx) await store.del('txs', tx.id);
  try {
    await store.del('scholarships', id);
  } catch (e) {
    if (tx) { try { await store.put('txs', tx); } catch { /* giữ lỗi gốc */ } }
    throw e;
  }
}

export const newScholarshipId = () => uid();

/* Từ màn hình Giao dịch có thể yêu cầu mở một tháng ở màn hình Học bổng MIIGAiK. */
let openRequest = null;
export const requestOpenScholarship = (id) => { openRequest = id; };
export function takeOpenScholarshipRequest() { const r = openRequest; openRequest = null; return r; }
