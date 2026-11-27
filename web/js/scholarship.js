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
import { monthLabel, isDateStr } from './dates.js';
import { fold } from './calc.js';

export const SCHOLARSHIP_NAME = 'Học bổng MIIGAiK';
export const SCHOLARSHIP_CURRENCY = 'RUB';
export const DEFAULT_SCHOLARSHIP_AMOUNT = 15000;

export const isReceived = (s) => !!(s && s.receivedDate);

/** Số tiền học bổng mỗi tháng: cài đặt → mặc định 15.000 ₽. */
export function scholarshipAmount(params = {}) {
  const v = Number(params.scholarshipAmount);
  return v > 0 ? v : DEFAULT_SCHOLARSHIP_AMOUNT;
}

/** Một tài khoản có nhận được học bổng không: ₽, còn dùng, không phải sổ tiết kiệm. */
export const isReceivingAccount = (a) => !!a && !a.archived && a.currency === SCHOLARSHIP_CURRENCY && a.kind !== 'savings';

/** Thẻ có thể nhận học bổng: tài khoản ₽ còn dùng, trừ sổ tiết kiệm. */
export const receivingAccounts = (accounts) => (accounts || []).filter(isReceivingAccount);

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

/** Danh mục thu «Học bổng» (rỗng nếu chưa có). */
export const scholarshipCategoryId = () => (store.all('categories').find((c) => c.type === 'income' && c.name === 'Học bổng') || {}).id || '';
const incomeCategoryId = scholarshipCategoryId;
/** Khoản thu chọn danh mục này thì tự đồng bộ sang mục Học bổng MIIGAiK. */
export const isScholarshipCategory = (categoryId) => !!categoryId && categoryId === scholarshipCategoryId();

/**
 * Lưu một tháng học bổng (mới hoặc sửa). doc.id bắt buộc (tạo bằng newScholarshipId()).
 *  - Đã nhận (có receivedDate) + post → tạo/cập nhật giao dịch thu vào accountId.
 *  - Ngược lại → giao dịch cũ (nếu có) bị xóa.
 *  - adoptTxId: một khoản thu có sẵn (chưa gắn tháng nào) được "nhận nuôi" làm giao dịch của tháng này thay vì tạo khoản mới,
 *    để không bị tính hai lần. Chỉ dùng khi tháng chưa có giao dịch riêng; không bao giờ bị xóa nếu không ghi được khoản mới.
 * Ghi lỗi giữa chừng thì hoàn tác phần đã ghi.
 */
export async function saveScholarship(doc0, { post = false, accountId = '', adoptTxId = '' } = {}) {
  if (!doc0.id) throw new Error('Tháng học bổng thiếu mã.');
  const prev = store.byId('scholarships', doc0.id);
  const ownTx = prev && prev.txId ? store.byId('txs', prev.txId) : null;
  let adopted = null;
  if (!ownTx && adoptTxId) {
    const a = store.byId('txs', adoptTxId);
    if (a && a.kind === 'income' && !a.dealId && (!a.scholarshipId || a.scholarshipId === doc0.id)) adopted = a;
  }
  const oldTx = ownTx || adopted;
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
  } else if (ownTx) {
    await store.del('txs', ownTx.id);
    undo = () => store.put('txs', ownTx);
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

/* ───────── Thêm học bổng từ nơi khác (Thêm giao dịch, Nhập nhanh, ô nhập ở Tổng quan) ─────────
 * Khoản thu chọn danh mục «Học bổng» không còn là một khoản thu rời: nó ghi vào đúng tháng của mục Học bổng MIIGAiK
 * (cùng một dòng tháng, cùng một giao dịch thu), kèm «ngày có» và «ngày nhận». Mỗi tháng chỉ một dòng nên
 * lưu lại lần nữa là cập nhật chứ không cộng thêm. */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Tháng của một ngày YYYY-MM-DD ('' nếu ngày không hợp lệ). */
export const monthOfDate = (d) => (isDateStr(d) ? d.slice(0, 7) : '');

/** Tháng mặc định cho khoản học bổng: tháng của «ngày có», chưa có thì tháng của ngày nhận. */
export const defaultScholarshipMonth = (availableDate, receivedDate) => monthOfDate(availableDate) || monthOfDate(receivedDate);

/** Dòng tháng học bổng đã có (hoặc null). */
export const scholarshipByMonth = (month, list = store.all('scholarships')) => (month ? (list || []).find((x) => x.month === month) || null : null);

/** Điền nốt phần còn trống: tháng chưa chọn thì suy ra từ ngày có / ngày nhận. */
export function resolveScholarshipInput({ month = '', availableDate = '' } = {}, receivedDate = '') {
  return { month: month || defaultScholarshipMonth(availableDate, receivedDate), availableDate: availableDate || '', receivedDate: receivedDate || '' };
}

/** Ghi chú chỉ lặp lại từ khóa «học bổng» thì bỏ (tháng đã mang tên rồi). */
export function cleanScholarshipNote(note) {
  const n = fold(String(note || '')).replace(/[^\p{L}\d]+/gu, ' ').trim();
  return !n || /^(hoc bong|stipendiya|стипендия)( miigaik)?$/u.test(n) ? '' : String(note).trim();
}

/** Lỗi (tiếng Việt) nếu dữ liệu chưa đủ / sai để ghi vào một tháng học bổng; '' nếu ổn. Hàm thuần. */
export function validateScholarshipEntry({ month, availableDate = '', receivedDate, amount, accountId } = {}, accounts = []) {
  if (!MONTH_RE.test(month || '')) return 'Chọn tháng học bổng.';
  if (!isDateStr(receivedDate)) return 'Chọn ngày thực nhận.';
  if (availableDate && !isDateStr(availableDate)) return 'Ngày học bổng “có” không hợp lệ.';
  if (availableDate && availableDate > receivedDate) return 'Ngày học bổng “có” không thể sau ngày thực nhận.';
  if (!(round2(amount) > 0)) return 'Nhập số tiền học bổng lớn hơn 0.';
  const acc = (accounts || []).find((a) => a.id === accountId);
  if (!isReceivingAccount(acc)) return 'Học bổng MIIGAiK tính bằng ₽ — chọn thẻ ₽ (không phải sổ tiết kiệm) để cộng vào.';
  return '';
}

/**
 * Dựng dòng tháng từ dữ liệu vừa nhập. Tháng đã có thì giữ mã, giữ «ngày có» cũ nếu lần này bỏ trống. Hàm thuần.
 * Không đưa txId vào kết quả (saveScholarship tự tìm giao dịch của tháng).
 */
export function planScholarshipEntry({ existing = null, id = '', month, availableDate = '', receivedDate, amount, note = '' }) {
  const doc = { ...(existing || {}), id: existing ? existing.id : id, month, currency: SCHOLARSHIP_CURRENCY, receivedDate, amount: round2(amount) };
  const av = availableDate || (existing && existing.availableDate) || '';
  if (av) doc.availableDate = av; else delete doc.availableDate;
  const nt = String(note || '').trim() || (existing && existing.note) || '';
  if (nt) doc.note = nt; else delete doc.note;
  delete doc.txId;
  return doc;
}

/**
 * Khoản thu có sẵn (adoptTxId) muốn chuyển thành học bổng của tháng này, nhưng tháng đó đã có khoản thu riêng
 * → không gộp được (sẽ bị tính hai lần). Trả về câu báo lỗi, hoặc '' nếu không vướng.
 */
export function scholarshipClash(month, adoptTxId) {
  if (!adoptTxId) return '';
  const row = scholarshipByMonth(month);
  const own = row && row.txId ? store.byId('txs', row.txId) : null;
  if (!own || own.id === adoptTxId) return '';
  return `${monthLabel(month)} đã có khoản học bổng ở mục ${SCHOLARSHIP_NAME}. Bỏ tick ô trên để giữ khoản thu thường, hoặc xóa khoản thu này, để khỏi bị tính hai lần.`;
}

/**
 * Ghi một khoản học bổng đã nhận vào mục Học bổng MIIGAiK (tạo tháng mới hoặc cập nhật tháng đã có) + khoản thu ₽ vào thẻ.
 * @param {{month:string, availableDate?:string, receivedDate:string, amount:number, accountId:string, note?:string}} entry
 * @param {{adoptTxId?:string}} [opt] adoptTxId: khoản thu có sẵn được chuyển thành giao dịch của tháng (không tạo thêm khoản).
 * @returns {Promise<{item:object, updated:boolean}>} updated=true khi tháng đã tồn tại và được cập nhật
 */
export async function saveScholarshipEntry(entry, { adoptTxId = '' } = {}) {
  const err = validateScholarshipEntry(entry, store.all('accounts'));
  if (err) throw new Error(err);
  const existing = scholarshipByMonth(entry.month);
  const clash = scholarshipClash(entry.month, adoptTxId);
  if (clash) throw new Error(clash);
  const doc = planScholarshipEntry({ existing, id: newScholarshipId(), ...entry });
  const item = await saveScholarship(doc, { post: true, accountId: entry.accountId, adoptTxId });
  if (entry.accountId !== store.settings().params.scholarshipAccountId) {
    try { await store.saveSettings({ params: { scholarshipAccountId: entry.accountId } }); } catch { /* chỉ để nhớ thẻ, bỏ qua */ }
  }
  return { item, updated: !!existing };
}

/* ───────── Khoản thu «Học bổng» có từ trước nhưng chưa gắn với tháng nào ───────── */

/** Khoản thu danh mục Học bổng, ₽, vào thẻ nhận được học bổng, chưa gắn tháng nào. Hàm thuần. */
export function orphanScholarshipTxs(txs, accounts, categoryId) {
  if (!categoryId) return [];
  const ok = new Set((accounts || []).filter((a) => a.currency === SCHOLARSHIP_CURRENCY && a.kind !== 'savings').map((a) => a.id));
  return (txs || [])
    .filter((t) => t.kind === 'income' && t.categoryId === categoryId && !t.scholarshipId && !t.dealId && t.currency === SCHOLARSHIP_CURRENCY && ok.has(t.accountId) && Number(t.amount) > 0)
    .sort((a, b) => (a.date === b.date ? (a.ts || 0) - (b.ts || 0) : a.date < b.date ? -1 : 1));
}

/**
 * Chia các khoản chưa gắn thành: gắn được (tháng chưa có, hoặc đang chờ nhận) và bỏ qua (tháng đã có giao dịch riêng,
 * hoặc trùng tháng với khoản trước — để người dùng tự xử lý, tránh tính hai lần). Hàm thuần.
 */
export function planAdoption(orphans, scholarships, txs = []) {
  const taken = new Set(); // tháng đã được một khoản trong lượt này nhận
  const adopt = [];
  const skipped = [];
  for (const t of orphans) {
    const month = monthOfDate(t.date);
    const row = (scholarships || []).find((x) => x.month === month) || null;
    const rowTx = row && row.txId ? (txs || []).find((x) => x.id === row.txId) : null;
    if (!month || taken.has(month) || rowTx || (row && isReceived(row))) { skipped.push(t); continue; }
    taken.add(month);
    adopt.push({ tx: t, month, existing: row });
  }
  return { adopt, skipped };
}

/** Gắn các khoản thu Học bổng có sẵn vào đúng tháng của chúng. Trả về số tháng đã gắn và số khoản bị bỏ qua. */
export async function adoptOrphanScholarships() {
  const { adopt, skipped } = planAdoption(
    orphanScholarshipTxs(store.all('txs'), store.all('accounts'), scholarshipCategoryId()),
    store.all('scholarships'),
    store.all('txs'),
  );
  let done = 0;
  for (const { tx, month, existing } of adopt) {
    const doc = planScholarshipEntry({ existing, id: newScholarshipId(), month, receivedDate: tx.date, amount: tx.amount, note: cleanScholarshipNote(tx.note) });
    await saveScholarship(doc, { post: true, accountId: tx.accountId, adoptTxId: tx.id });
    done += 1;
  }
  return { done, skipped: skipped.length };
}

/* Từ màn hình Giao dịch có thể yêu cầu mở một tháng ở màn hình Học bổng MIIGAiK. */
let openRequest = null;
export const requestOpenScholarship = (id) => { openRequest = id; };
export function takeOpenScholarshipRequest() { const r = openRequest; openRequest = null; return r; }
