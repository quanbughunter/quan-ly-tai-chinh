// Dữ liệu mẫu HOÀN TOÀN GIẢ LẬP (tên và số tiền bịa ra) để dùng thử app ở chế độ thử.

import { store } from './store.js';
import { todayStr, addDays } from './dates.js';
import { evalDeal } from './fx.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedDemo() {
  const r = rng(42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const today = todayStr();
  const cat = (name) => (store.all('categories').find((c) => c.name === name) || {}).id || '';

  const mk = async (col, docs) => store.putMany(col, docs);
  const [main, cash, rub, usdt, save] = await mk('accounts', [
    { name: 'Thẻ chính', kind: 'bank', currency: 'VND', opening: 15_000_000 },
    { name: 'Tiền mặt', kind: 'cash', currency: 'VND', opening: 2_000_000 },
    { name: 'Thẻ Rúp', kind: 'card', currency: 'RUB', opening: 30_000 },
    { name: 'Ví USDT', kind: 'crypto', currency: 'USDT', opening: 500 },
    { name: 'Tiết kiệm gửi gia đình', kind: 'savings', currency: 'VND', opening: 100_000_000 },
  ]);
  const [an, binh, chi, kx] = await mk('parties', [
    { name: 'Anh An (mẫu)', role: 'person' },
    { name: 'Chị Bình (mẫu)', role: 'person' },
    { name: 'Em Chi (mẫu)', role: 'person' },
    { name: 'Khách X (mẫu)', role: 'customer' },
  ]);

  const txs = [];
  const foods = ['cafe', 'ăn trưa', 'ăn tối', 'trà sữa', 'siêu thị', 'cơm tấm', 'phở'];
  for (let i = 90; i >= 0; i--) {
    const date = addDays(today, -i);
    if (r() < 0.8) txs.push({ date, kind: 'expense', amount: Math.round((25 + r() * 120) / 5) * 5000, currency: 'VND', accountId: r() < 0.6 ? main.id : cash.id, categoryId: cat('Ăn uống'), note: pick(foods) });
    if (r() < 0.3) txs.push({ date, kind: 'expense', amount: Math.round((20 + r() * 60) / 5) * 1000, currency: 'VND', accountId: cash.id, categoryId: cat('Đi lại'), note: pick(['grab', 'xe buýt', 'gửi xe']) });
    if (r() < 0.12) txs.push({ date, kind: 'expense', amount: Math.round((200 + r() * 900) / 50) * 1000, currency: 'VND', accountId: main.id, categoryId: cat('Mua sắm'), note: pick(['áo', 'giày', 'đồ dùng']) });
    if (date.endsWith('-15')) txs.push({ date, kind: 'income', amount: 12_000_000, currency: 'VND', accountId: main.id, categoryId: cat('Lương'), note: 'Lương tháng' });
    if (date.endsWith('-01')) txs.push({ date, kind: 'expense', amount: 3_000_000, currency: 'VND', accountId: main.id, categoryId: cat('Nhà ở / KTX'), note: 'Tiền nhà' });
  }
  txs.push({ date: addDays(today, -60), kind: 'lend', amount: 20_000_000, currency: 'VND', accountId: main.id, partyId: an.id, note: 'Cho mượn' });
  txs.push({ date: addDays(today, -20), kind: 'repay_in', amount: 5_000_000, currency: 'VND', accountId: main.id, partyId: an.id, note: 'Trả đợt 1' });
  txs.push({ date: addDays(today, -35), kind: 'lend', amount: 12_000, currency: 'RUB', partyId: chi.id, note: 'Cho em mượn (không gắn tài khoản)' });
  txs.push({ date: addDays(today, -12), kind: 'borrow', amount: 3_000_000, currency: 'VND', accountId: cash.id, partyId: binh.id, note: 'Vay tạm' });
  txs.push({ date: addDays(today, -25), kind: 'transfer', amount: 6_000_000, currency: 'VND', accountId: main.id, toAccountId: rub.id, toAmount: 19_800, note: 'Đổi sang rúp' });
  txs.push({ date: addDays(today, -10), kind: 'expense', amount: 1_850, currency: 'RUB', accountId: rub.id, categoryId: cat('Ăn uống'), note: 'siêu thị' });
  txs.push({ date: addDays(today, -40), kind: 'transfer', amount: 100, currency: 'USDT', accountId: usdt.id, toAccountId: save.id, toAmount: 2_650_000, note: 'Bán USDT lấy VND' });
  await mk('txs', txs.map((t, i) => ({ ...t, ts: 1000 + i })));

  await mk('budgets', [
    { categoryId: cat('Ăn uống'), amount: 4_000_000, currency: 'VND' },
    { categoryId: cat('Đi lại'), amount: 800_000, currency: 'VND' },
    { categoryId: cat('Mua sắm'), amount: 1_500_000, currency: 'VND' },
  ]);

  // Ba lệnh mẫu: một đã chốt (lãi đã cộng vào thẻ chính), hai còn là báo giá.
  const doneDeal = { dir: 'sang', status: 'done', date: addDays(today, -6), partyId: kx.id, note: 'Mẫu', inputs: { vndAmount: 6_000_000, vndPerUsdt: 26_000, rubPerUsdt: 80, margin: 60_000 }, actual: { sellRubPerUsdt: 82, buyVndPerUsdt: 25_900 } };
  const doneProfit = Math.round(evalDeal(doneDeal, store.settings().params).profit);
  const [dealDone] = await mk('deals', [
    { ...doneDeal, profit: doneProfit },
    { dir: 've', status: 'quote', date: addDays(today, -4), partyId: kx.id, note: 'Khách chỉ hỏi giá', inputs: { rubAmount: 4_000, rubPerUsdt: 80, vndPerUsdt: 26_500, margin: 100_000 }, actual: {} },
    { dir: 'sang', status: 'quote', date: addDays(today, -2), partyId: kx.id, note: 'Chờ khách xác nhận', inputs: { vndAmount: 4_000_000, vndPerUsdt: 26_100, rubPerUsdt: 81, margin: 80_000 }, actual: {} },
  ]);
  const [profitTx] = await mk('txs', [
    { date: dealDone.date, kind: 'income', amount: doneProfit, currency: 'VND', accountId: main.id, categoryId: cat('Kinh doanh đổi tiền'), note: 'Lãi đổi tiền Sang · Khách X (mẫu)', dealId: dealDone.id, ts: 5000 },
  ]);
  await mk('deals', [{ ...dealDone, profitTxId: profitTx.id }]);

  await mk('dorm', [
    { paidDate: addDays(today, -80), amount: 2400, currency: 'RUB', payer: 'Tài khoản mẫu 1', period: 'Tháng 8', receiptSent: true },
    { paidDate: addDays(today, -50), amount: 2400, currency: 'RUB', payer: 'Tài khoản mẫu 2', period: 'Tháng 9', receiptSent: true },
    { paidDate: addDays(today, -9), amount: 2400, currency: 'RUB', payer: 'Tài khoản mẫu 1', period: 'Tháng 10', receiptSent: false },
  ]);

  // Học bổng MIIGAiK: 3 tháng đã nhận (cộng vào thẻ ₽ chính, mỗi tháng một khoản thu) + 1 tháng đang chờ.
  const schol = await mk('scholarships', [
    { month: addDays(today, -90).slice(0, 7), currency: 'RUB', amount: 15_000, availableDate: addDays(today, -62), receivedDate: addDays(today, -52) },
    { month: addDays(today, -60).slice(0, 7), currency: 'RUB', amount: 15_000, availableDate: addDays(today, -32), receivedDate: addDays(today, -31) },
    { month: addDays(today, -30).slice(0, 7), currency: 'RUB', amount: 15_000, availableDate: addDays(today, -4), receivedDate: addDays(today, -2) },
    { month: today.slice(0, 7), currency: 'RUB', amount: 15_000, availableDate: addDays(today, -1) },
  ]);
  const schTxs = await mk('txs', schol.filter((x) => x.receivedDate).map((x, i) => ({
    date: x.receivedDate, kind: 'income', amount: x.amount, currency: 'RUB', accountId: rub.id, categoryId: cat('Học bổng'),
    note: `Học bổng MIIGAiK · Tháng ${Number(x.month.slice(5))}/${x.month.slice(0, 4)}`, scholarshipId: x.id, ts: 6000 + i,
  })));
  await mk('scholarships', schol.filter((x) => x.receivedDate).map((x, i) => ({ ...x, txId: schTxs[i].id })));
}
