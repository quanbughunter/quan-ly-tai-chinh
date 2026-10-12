import test from 'node:test';
import assert from 'node:assert/strict';
import { statusOf, dealProfit, pickProfitAccountId, profitTxFor } from '../web/js/deals.js';

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

test('thẻ nhận lãi: cài đặt → thẻ tên có "MB" → thẻ VND đầu tiên; bỏ qua thẻ ẩn và thẻ ngoại tệ', () => {
  const accs = [
    { id: 'a', name: 'Tiền mặt', currency: 'VND' },
    { id: 'b', name: 'Thẻ MB', currency: 'VND' },
    { id: 'c', name: 'MB Rúp', currency: 'RUB' },
    { id: 'd', name: 'MB cũ', currency: 'VND', archived: true },
  ];
  assert.equal(pickProfitAccountId(accs, {}), 'b');
  assert.equal(pickProfitAccountId(accs, { dealAccountId: 'a' }), 'a');
  assert.equal(pickProfitAccountId(accs, { dealAccountId: 'c' }), 'b'); // thẻ cài đặt không phải VND → bỏ
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
