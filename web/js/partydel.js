// Xóa một người (trong Vay nợ). Hàm thuần để kiểm thử; phần ghi dữ liệu nhận `store` làm tham số.
//
// Người đã có giao dịch vẫn xóa được, nhưng phải xóa luôn các giao dịch của người đó: nếu giữ lại, các khoản
// vay/trả sẽ mất người đứng tên mà vẫn tính vào số dư thẻ. Lệnh đổi tiền (deals) thì giữ nguyên, chỉ bỏ tên người.

import { DEBT_SIGN } from './calc.js';
import { roundTo } from './money.js';

/**
 * Những gì đang gắn với một người.
 * balance: số dư vay nợ theo từng tiền tệ (dương: người này nợ mình, âm: mình nợ người này), bỏ tiền tệ đã về 0.
 */
export function partyUsage(partyId, { txs = [], deals = [] } = {}) {
  const myTxs = txs.filter((t) => t.partyId === partyId);
  const myDeals = deals.filter((d) => d.partyId === partyId);
  const acc = {};
  for (const t of myTxs) {
    const s = DEBT_SIGN[t.kind];
    if (!s) continue;
    acc[t.currency] = roundTo((acc[t.currency] || 0) + s * t.amount, 6);
  }
  const balance = {};
  for (const [cur, v] of Object.entries(acc)) if (Math.abs(v) > 1e-9) balance[cur] = v;
  return { txs: myTxs, deals: myDeals, balance, used: myTxs.length + myDeals.length > 0 };
}

/** Kế hoạch xóa: id giao dịch cần xóa, các lệnh đổi tiền cần bỏ tên người (đã sửa sẵn), id người. */
export function planPartyDelete(partyId, data) {
  const u = partyUsage(partyId, data);
  return {
    partyId,
    txIds: u.txs.map((t) => t.id),
    dealDocs: u.deals.map((d) => ({ ...d, partyId: '' })),
  };
}

/**
 * Thực hiện xóa. Thứ tự: giao dịch → lệnh đổi tiền → người. Nếu lỗi giữa chừng thì người vẫn còn
 * (bấm Xóa lần nữa là chạy tiếp), không bao giờ có giao dịch trỏ tới một người đã mất.
 * @returns {{txs:number, deals:number}} số bản ghi đã động tới
 */
export async function deleteParty(store, partyId) {
  const plan = planPartyDelete(partyId, { txs: store.all('txs'), deals: store.all('deals') });
  if (plan.txIds.length) await store.delMany('txs', plan.txIds);
  if (plan.dealDocs.length) await store.putMany('deals', plan.dealDocs);
  await store.del('parties', partyId);
  return { txs: plan.txIds.length, deals: plan.dealDocs.length };
}
