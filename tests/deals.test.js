import test from 'node:test';
import assert from 'node:assert/strict';
import { statusOf, dealProfit, pickProfitAccountId, profitTxFor, convertProfit, foreignFor } from '../web/js/deals.js';

// Mọi dữ liệu ở đây là số tự đặt.

const deal = { id: 'd1', dir: 'sang', date: '2025-03-05', status: 'done', profit: 250_000, note: '', inputs: {}, actual: {} };

test('trạng thái: chỉ "done" mới là đã chốt, mọi thứ khác là báo giá', () => {
  assert.equal(statusOf({ status: 'done' }), 'done');
  assert.equal(statusOf({ status: 'quote' }), 'quote');
  assert.equal(statusOf({}), 'quote');
  assert.equal(statusOf(null), 'quote');
});

test('báo giá chưa chốt thì chưa có lãi', () => {
  assert.equal(dealProfit({ ...deal, status: 'quote' }), null);
  assert.equal(dealProfit(deal), 250_000);
  assert.equal(dealProfit({ ...deal, profit: -40_000 }), -40_000);
});

test('lệnh đã chốt thiếu số lãi thì tính từ giá thực tế', () => {
  const d = {
    dir: 'sang', status: 'done', inputs: { vndPerUsdt: 26000, rubPerUsdt: 80, vndAmount: 6_000_000, margin: 60_000 },
    actual: { sellRubPerUsdt: 80, buyVndPerUsdt: 26000 },
  };
  assert.ok(Math.abs(dealProfit(d) - 300_000) < 1e-6);
});

test('thẻ nhận lãi: cài đặt → thẻ tên có "MB" → thẻ VND đầu tiên; bỏ qua thẻ ẩn', () => {
  const accs = [
    { id: 'a', name: 'Tiền mặt', currency: 'VND' },
    { id: 'b', name: 'Thẻ MB', currency: 'VND' },
    { id: 'c', name: 'MB Rúp', currency: 'RUB' },
    { id: 'd', name: 'MB cũ', currency: 'VND', archived: true },
  ];
  assert.equal(pickProfitAccountId(accs, {}), 'b');
  assert.equal(pickProfitAccountId(accs, { dealAccountId: 'a' }), 'a');
  assert.equal(pickProfitAccountId(accs, { dealAccountId: 'c' }), 'c'); // thẻ rúp đặt trong Cài đặt cũng được
  assert.equal(pickProfitAccountId(accs, { dealAccountId: 'c' }, '', { vndOnly: true }), 'b'); // cộng bù hàng loạt: chỉ thẻ VND
  assert.equal(pickProfitAccountId(accs.filter((x) => x.id !== 'b'), {}), 'a');
  assert.equal(pickProfitAccountId([], {}), '');
});

test('giao dịch lãi: lãi dương → khoản thu ghi đúng ngày, gắn dealId', () => {
  const tx = profitTxFor(deal, { accountId: 'mb', incomeCategoryId: 'c1', partyName: 'Khách A' });
  assert.deepEqual(tx, {
    date: '2025-03-05', kind: 'income', amount: 250_000, currency: 'VND', accountId: 'mb',
    categoryId: 'c1', note: 'Lãi đổi tiền Sang · Khách A', dealId: 'd1',
  });
});

test('giao dịch lãi: lỗ → khoản chi; lãi 0 hoặc chưa chọn thẻ → không ghi gì', () => {
  const loss = profitTxFor({ ...deal, dir: 've', profit: -30_000 }, { accountId: 'mb', expenseCategoryId: 'c2' });
  assert.equal(loss.kind, 'expense');
  assert.equal(loss.amount, 30_000);
  assert.equal(loss.categoryId, 'c2');
  assert.match(loss.note, /^Lỗ đổi tiền Về/);
  assert.equal(profitTxFor({ ...deal, profit: 0 }, { accountId: 'mb' }), null);
  assert.equal(profitTxFor({ ...deal, profit: 0.4 }, { accountId: 'mb' }), null);
  assert.equal(profitTxFor(deal, {}), null);
});

test('giao dịch lãi làm tròn VND đến đồng', () => {
  assert.equal(profitTxFor({ ...deal, profit: 123456.6 }, { accountId: 'mb' }).amount, 123457);
});

test('thẻ nhận lãi: cài đặt > thẻ chọn lần trước > thẻ MB > thẻ VND đầu tiên', () => {
  const accs = [
    { id: 'a', name: 'Thẻ Nga', currency: 'VND' },
    { id: 'b', name: 'Thẻ MB', currency: 'VND' },
    { id: 'r', name: 'Gazprom', currency: 'RUB' },
  ];
  assert.equal(pickProfitAccountId(accs, {}, 'a'), 'a'); // cài đặt trống → nhớ lần trước
  assert.equal(pickProfitAccountId(accs, { dealAccountId: 'b' }, 'a'), 'b'); // thẻ đặt trong Cài đặt thắng
  assert.equal(pickProfitAccountId(accs, {}, 'r'), 'r'); // thẻ rúp chọn lần trước → gợi ý lại
  assert.equal(pickProfitAccountId(accs, {}, 'r', { vndOnly: true }), 'b');
  assert.equal(pickProfitAccountId([accs[2]], {}), 'r'); // chỉ có thẻ rúp → vẫn gợi ý thẻ đó
  assert.equal(pickProfitAccountId(accs, {}, 'zzz'), 'b'); // thẻ lần trước không còn → về MB
  assert.equal(pickProfitAccountId(accs.map((x) => (x.id === 'a' ? { ...x, archived: true } : x)), {}, 'a'), 'b'); // thẻ đã ẩn → bỏ qua
});

test('quy đổi lãi: thẻ VND, nhập bằng ₫ → không cần tỉ giá', () => {
  assert.deepEqual(convertProfit({ amount: 250000.4 }), { ok: true, vnd: 250000, card: 250000, foreign: '', rate: null });
  assert.deepEqual(convertProfit({ amount: -30000, cardCurrency: 'VND' }).vnd, -30000);
});

test('quy đổi lãi: thẻ rúp, nhập bằng ₫ → chia cho tỉ giá áng chừng', () => {
  const c = convertProfit({ amount: 330000, unit: 'VND', cardCurrency: 'RUB', rate: 330 });
  assert.equal(c.ok, true);
  assert.equal(c.vnd, 330000);
  assert.equal(c.card, 1000);
  assert.equal(c.foreign, 'RUB');
  assert.equal(convertProfit({ amount: 100000, unit: 'VND', cardCurrency: 'RUB', rate: 330 }).card, 303.03); // làm tròn 2 số lẻ
  assert.equal(convertProfit({ amount: -66000, unit: 'VND', cardCurrency: 'RUB', rate: 330 }).card, -200); // lỗ → số âm
});

test('quy đổi lãi: nhập thẳng bằng rúp → ra lãi ₫ để thống kê, số vào thẻ rúp giữ nguyên', () => {
  const c = convertProfit({ amount: 1234.56, unit: 'RUB', cardCurrency: 'RUB', rate: 330.5 });
  assert.equal(c.card, 1234.56);
  assert.equal(c.vnd, Math.round(1234.56 * 330.5));
  // nhập bằng rúp nhưng nhận vào thẻ VND
  const d = convertProfit({ amount: 500, unit: 'RUB', cardCurrency: 'VND', rate: 330 });
  assert.equal(d.vnd, 165000);
  assert.equal(d.card, 165000);
});

test('quy đổi lãi: thiếu tỉ giá hoặc số, hoặc hai ngoại tệ khác nhau → báo lỗi', () => {
  assert.equal(convertProfit({ amount: 100, unit: 'VND', cardCurrency: 'RUB' }).ok, false);
  assert.match(convertProfit({ amount: 100, unit: 'VND', cardCurrency: 'RUB', rate: 0 }).error, /tỉ giá/);
  assert.equal(convertProfit({ amount: 500, unit: 'RUB', cardCurrency: 'VND', rate: NaN }).ok, false);
  assert.equal(convertProfit({ amount: '' }).ok, false);
  assert.equal(convertProfit({ amount: NaN }).ok, false);
  assert.equal(convertProfit({ amount: 5, unit: 'RUB', cardCurrency: 'USD', rate: 330 }).ok, false);
});

test('ngoại tệ dùng để quy đổi: tiền của thẻ nếu khác VND, không thì rúp', () => {
  assert.equal(foreignFor('VND'), 'RUB');
  assert.equal(foreignFor('RUB'), 'RUB');
  assert.equal(foreignFor('USD'), 'USD');
  assert.equal(foreignFor(undefined), 'RUB');
});

test('giao dịch lãi vào thẻ rúp: ghi bằng RUB, kèm tỉ giá trong ghi chú; lỗ → khoản chi', () => {
  const tx = profitTxFor(deal, { accountId: 'nga', currency: 'RUB', cardAmount: 1000, rate: 330, rateCur: 'RUB', incomeCategoryId: 'c1' });
  assert.equal(tx.currency, 'RUB');
  assert.equal(tx.amount, 1000);
  assert.equal(tx.kind, 'income');
  assert.equal(tx.note, 'Lãi đổi tiền Sang · tỉ giá ~330 ₫/RUB');
  const loss = profitTxFor(deal, { accountId: 'nga', currency: 'RUB', cardAmount: -12.346, expenseCategoryId: 'c2' });
  assert.equal(loss.kind, 'expense');
  assert.equal(loss.amount, 12.35); // rúp làm tròn 2 số lẻ
  assert.equal(profitTxFor(deal, { accountId: 'nga', currency: 'RUB', cardAmount: 0.004 }), null);
  // VND vẫn theo deal.profit, không ghi chú tỉ giá
  assert.equal(profitTxFor(deal, { accountId: 'mb', currency: 'VND', rate: 330, rateCur: '' }).note, 'Lãi đổi tiền Sang');
});
