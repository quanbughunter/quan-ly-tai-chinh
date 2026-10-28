// Lệnh đổi tiền: báo giá → chốt giao dịch → (tùy chọn) tự cộng lãi vào thẻ.
//
// Quy tắc cốt lõi:
//  - Lệnh ở trạng thái "quote" (báo giá) chỉ là ghi chép. KHÔNG làm thay đổi số dư nào.
//  - Khi chốt (status = "done"), lãi ghi nhận (deal.profit, luôn lưu bằng VND để thống kê) được cộng vào
//    thẻ nhận lãi (mặc định: thẻ MB) bằng MỘT giao dịch thu, đúng ngày của lệnh. Giao dịch này gắn dealId
//    để sửa/hủy chốt/xóa lệnh thì giao dịch lãi đi theo, số dư luôn khớp.
//  - Thẻ nhận lãi có thể là thẻ VND hoặc thẻ ngoại tệ (ví dụ thẻ RUB). Khi đó lãi được quy đổi theo
//    "tỉ giá áng chừng" bạn nhập (₫ cho 1 đơn vị ngoại tệ); bạn cũng có thể nhập lãi thẳng bằng ngoại tệ.
//    deal.profitUnit / deal.profitRate nhớ đơn vị đã nhập và tỉ giá đã dùng.
//  - Lãi âm (lỗ) được ghi là một khoản chi.

import { store } from './store.js';
import { evalDeal } from './fx.js';
import { uid } from './model.js';
import { CUR_INFO, roundTo, fmtNum } from './money.js';

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

const decOf = (cur) => (cur === 'VND' ? 0 : (CUR_INFO[cur] ? CUR_INFO[cur].dec : 2));

/** Ngoại tệ dùng để quy đổi lãi: tiền của thẻ nếu thẻ không phải VND, không thì rúp (cặp của nghiệp vụ đổi tiền). */
export const foreignFor = (cardCurrency) => (cardCurrency && cardCurrency !== 'VND' ? cardCurrency : 'RUB');

/**
 * Quy đổi lãi giữa đơn vị bạn nhập và tiền của thẻ nhận lãi.
 *  amount: số lãi theo `unit` ('VND' hoặc một ngoại tệ), âm nếu lỗ.
 *  rate: tỉ giá áng chừng = số VND cho 1 đơn vị ngoại tệ (chỉ cần khi có ngoại tệ).
 * Trả { ok, vnd, card, foreign, rate } — vnd: lãi VND (để thống kê); card: số tiền cộng vào thẻ,
 * theo tiền của thẻ — hoặc { ok:false, error, foreign } khi thiếu số / thiếu tỉ giá.
 */
export function convertProfit({ amount, unit = 'VND', cardCurrency = 'VND', rate = null } = {}) {
  const a = Number(amount);
  if (amount === '' || amount == null || !Number.isFinite(a)) return { ok: false, error: 'Nhập số lãi.' };
  if (unit !== 'VND' && cardCurrency !== 'VND' && unit !== cardCurrency) {
    return { ok: false, error: `Lãi tính bằng ${unit} nhưng thẻ là ${cardCurrency}. Hãy nhập lãi bằng ₫ hoặc bằng ${cardCurrency}.` };
  }
  const foreign = unit !== 'VND' ? unit : cardCurrency !== 'VND' ? cardCurrency : '';
  const r = Number(rate);
  if (foreign && !(r > 0)) return { ok: false, foreign, error: `Nhập tỉ giá áng chừng (₫ cho 1 ${foreign}).` };
  const vnd = Math.round(unit === 'VND' ? a : a * r);
  let card = vnd;
  if (cardCurrency !== 'VND') card = roundTo(unit === cardCurrency ? a : a / r, decOf(cardCurrency));
  return { ok: true, vnd, card, foreign, rate: foreign ? r : null };
}

/**
 * Chọn thẻ nhận lãi (gợi ý sẵn trong hộp Chốt giao dịch; bạn vẫn đổi được thẻ khác mỗi lần):
 * thẻ đặt trong Cài đặt → thẻ bạn chọn ở lần chốt trước → thẻ VND có tên chứa "MB" → thẻ VND đầu tiên
 * → thẻ bất kỳ. Thẻ nào cũng được (VND hoặc ngoại tệ); vndOnly: chỉ xét thẻ VND (dùng cho cộng bù hàng loạt).
 */
export function pickProfitAccountId(accounts, params = {}, lastId = '', { vndOnly = false } = {}) {
  const list = (accounts || []).filter((a) => !a.archived && (!vndOnly || a.currency === 'VND'));
  if (params.dealAccountId && list.some((a) => a.id === params.dealAccountId)) return params.dealAccountId;
  if (lastId && list.some((a) => a.id === lastId)) return lastId;
  const vnd = list.filter((a) => a.currency === 'VND');
  const mb = vnd.find((a) => /(^|[^a-z0-9])mb([^a-z0-9]|$)/i.test(a.name));
  return (mb || vnd[0] || list[0] || {}).id || '';
}

// Nhớ thẻ vừa chọn khi chốt (chỉ trên máy này) để lần sau gợi ý lại đúng thẻ đó.
const LAST_KEY = 'qltc:lastDealAccount';
export function lastProfitAccountId() {
  try { return localStorage.getItem(LAST_KEY) || ''; } catch { return ''; }
}
export function rememberProfitAccount(id) {
  try { if (id) localStorage.setItem(LAST_KEY, id); } catch { /* bỏ qua */ }
}
export const defaultProfitAccountId = (opts) => pickProfitAccountId(store.all('accounts'), store.settings().params, lastProfitAccountId(), opts);

/**
 * Giao dịch lãi sẽ ghi vào thẻ cho một lệnh đã chốt. Hàm thuần (dễ kiểm thử).
 * Lãi = 0 → không có giao dịch (null).
 *  currency: tiền của thẻ nhận lãi (mặc định VND).  cardAmount: số tiền theo tiền của thẻ (có dấu);
 *  không có thì lấy deal.profit (VND).  rate / rateCur: tỉ giá áng chừng đã dùng, ghi vào ghi chú cho dễ truy lại.
 */
export function profitTxFor(deal, { accountId, incomeCategoryId = '', expenseCategoryId = '', partyName = '', currency = 'VND', cardAmount = null, rate = null, rateCur = '' } = {}) {
  const p = cardAmount != null ? roundTo(Number(cardAmount) || 0, decOf(currency)) : Math.round(Number(deal.profit) || 0);
  if (!p || !accountId) return null;
  const head = p > 0 ? `Lãi đổi tiền ${DIR_LABEL[deal.dir] || ''}` : `Lỗ đổi tiền ${DIR_LABEL[deal.dir] || ''}`;
  const rateNote = rate > 0 && rateCur ? `tỉ giá ~${fmtNum(rate, 4)} ₫/${rateCur}` : '';
  return {
    date: deal.date,
    kind: p > 0 ? 'income' : 'expense',
    amount: Math.abs(p),
    currency,
    accountId,
    categoryId: p > 0 ? incomeCategoryId : expenseCategoryId,
    note: [head.trim(), partyName, deal.note, rateNote].filter(Boolean).join(' · '),
    dealId: deal.id,
  };
}

function categoryIds() {
  const cats = store.all('categories');
  const by = (type, name) => (cats.find((c) => c.type === type && c.name === name) || {}).id || '';
  return { incomeCategoryId: by('income', 'Kinh doanh đổi tiền'), expenseCategoryId: by('expense', 'Chi khác') };
}

function specFor(deal, accountId, { cardAmount = null } = {}) {
  const party = deal.partyId && store.byId('parties', deal.partyId);
  const acc = store.byId('accounts', accountId);
  const currency = (acc && acc.currency) || 'VND';
  const rateCur = deal.profitUnit && deal.profitUnit !== 'VND' ? deal.profitUnit : currency !== 'VND' ? currency : '';
  return profitTxFor(deal, {
    accountId, ...categoryIds(), partyName: party ? party.name : '', currency, cardAmount,
    rate: rateCur ? Number(deal.profitRate) || null : null, rateCur,
  });
}

/**
 * Lưu một lệnh (mới hoặc sửa). deal.id bắt buộc (tạo bằng newDealId()).
 *  - status 'quote'  → mọi giao dịch lãi cũ của lệnh (nếu có) bị xóa.
 *  - status 'done' + post → tạo/cập nhật giao dịch lãi vào accountId. Thẻ ngoại tệ: cardAmount là số
 *    tiền theo tiền của thẻ; thiếu thì tự quy đổi từ deal.profit (VND) bằng deal.profitRate.
 *  - status 'done' + !post → chốt nhưng không cộng vào thẻ (đánh dấu postSkipped).
 * Ghi lỗi giữa chừng thì hoàn tác phần đã ghi.
 */
export async function saveDeal(deal, { post = false, accountId = '', cardAmount = null } = {}) {
  if (!deal.id) throw new Error('Lệnh thiếu mã.');
  const prev = store.byId('deals', deal.id);
  const oldTx = prev && prev.profitTxId ? store.byId('txs', prev.profitTxId) : null;
  const doc = { ...deal };
  delete doc.profitTxId;
  delete doc.postSkipped;
  if (!doc.profitUnit || doc.profitUnit === 'VND') delete doc.profitUnit;
  if (!(Number(doc.profitRate) > 0)) delete doc.profitRate;

  let spec = null;
  if (doc.status !== 'done') {
    delete doc.profitUnit;
    delete doc.profitRate;
  } else {
    doc.profit = Math.round(Number(doc.profit) || 0);
    if (post) {
      if (!accountId) throw new Error('Chọn thẻ để cộng lãi, hoặc bỏ chọn “Cộng lãi vào thẻ”.');
      const acc = store.byId('accounts', accountId);
      let amount = cardAmount;
      if (acc && acc.currency !== 'VND' && amount == null) {
        const c = convertProfit({ amount: doc.profit, unit: 'VND', cardCurrency: acc.currency, rate: doc.profitRate });
        if (!c.ok) throw new Error(c.error);
        amount = c.card;
      }
      spec = specFor(doc, accountId, { cardAmount: amount });
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
  const { profit, profitTxId, postSkipped, profitUnit, profitRate, ...rest } = d; // eslint-disable-line no-unused-vars
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
  const acc = store.byId('accounts', accountId);
  if (acc && acc.currency !== 'VND') throw new Error('Cộng bù hàng loạt chỉ dùng cho thẻ VND (lãi các lệnh cũ tính bằng ₫). Với thẻ ngoại tệ, mở từng lệnh và chốt lại để nhập tỉ giá.');
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
