import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountBalances, debtBalances, overview, periodStats, monthlySeries, filterTxs, groupByDate, budgetStatus, toBase, accAmount, incomeStats,
} from '../web/js/calc.js';

const accounts = [
  { id: 'mb', name: 'Thẻ MB', currency: 'VND', opening: 27_807_000 },
  { id: 'gz', name: 'Gazprom', currency: 'RUB', opening: 0 },
  { id: 'old', name: 'Sổ cũ', currency: 'VND', opening: 0, networth: false },
];
const rates = { RUB: 300, USD: 26000, USDT: 26500 };

const txs = [
  { id: '1', date: '2026-08-23', kind: 'expense', amount: 207_000, currency: 'VND', accountId: 'mb', categoryId: 'c1', note: 'Ăn trưa', ts: 1 },
  { id: '2', date: '2026-08-24', kind: 'income', amount: 1_000_000, currency: 'VND', accountId: 'mb', categoryId: 'c2', ts: 2 },
  { id: '3', date: '2026-08-25', kind: 'transfer', amount: 3_000_000, currency: 'VND', accountId: 'mb', toAccountId: 'gz', toAmount: 9000, ts: 3 },
  { id: '4', date: '2026-08-26', kind: 'lend', amount: 2_200_000, currency: 'VND', accountId: 'mb', partyId: 'p1', ts: 4 },
  { id: '5', date: '2026-08-27', kind: 'repay_in', amount: 2_200_000, currency: 'VND', accountId: 'mb', partyId: 'p1', ts: 5 },
  { id: '6', date: '2026-08-28', kind: 'lend', amount: 12000, currency: 'RUB', partyId: 'p2', ts: 6 }, // không gắn tài khoản
  { id: '7', date: '2026-08-28', kind: 'lend', amount: 4000, currency: 'USD', partyId: 'p3', ts: 7 },
  { id: '8', date: '2026-08-29', kind: 'borrow', amount: 500, currency: 'USD', partyId: 'p3', ts: 8 },
  { id: '9', date: '2026-08-29', kind: 'adjust', amount: -1000, currency: 'VND', accountId: 'mb', ts: 9 },
  { id: '10', date: '2026-08-30', kind: 'expense', amount: 100, currency: 'RUB', accountId: 'gz', categoryId: 'c1', ts: 10 },
  { id: '11', date: '2026-08-30', kind: 'expense', amount: 5_000_000, currency: 'VND', accountId: 'old', categoryId: 'c1', ts: 11 },
];

test('số dư = số dư đầu + tổng giao dịch (gồm chuyển khác tiền tệ)', () => {
  const b = accountBalances(accounts, txs);
  // 27.807.000 −207.000 +1.000.000 −3.000.000 −2.200.000 +2.200.000 −1.000
  assert.equal(b.get('mb'), 25_599_000);
  assert.equal(b.get('gz'), 9000 - 100);
  assert.equal(b.get('old'), -5_000_000);
});

test('công nợ theo từng người × từng tiền tệ', () => {
  const d = debtBalances(txs);
  assert.deepEqual(d.get('p1'), { VND: 0 });
  assert.deepEqual(d.get('p2'), { RUB: 12000 });
  assert.deepEqual(d.get('p3'), { USD: 3500 });
});

test('overview: tách tiền thật, cho vay, đang nợ; loại tài khoản networth=false', () => {
  const o = overview({ accounts, txs, rates });
  assert.equal(o.cash.VND, 25_599_000);
  assert.equal(o.cash.RUB, 8900);
  assert.equal(o.receivable.RUB, 12000);
  assert.equal(o.receivable.USD, 3500);
  assert.equal(o.base.cash, 25_599_000 + 8900 * 300);
  assert.equal(o.base.receivable, 12000 * 300 + 3500 * 26000);
  assert.equal(o.base.net, o.base.cash + o.base.receivable - o.base.payable);
  assert.deepEqual(o.missing, []);
});

test('overview: báo thiếu tỷ giá thay vì tính sai', () => {
  const o = overview({ accounts, txs, rates: { RUB: 300 } });
  assert.deepEqual(o.missing, ['USD']);
});

test('toBase', () => {
  assert.equal(toBase(10, 'VND', rates), 10);
  assert.equal(toBase(2, 'USD', rates), 52000);
  assert.equal(toBase(2, 'EUR', rates), null);
});

test('periodStats: chỉ tính thu/chi, không tính chuyển hay vay nợ', () => {
  const s = periodStats(txs, { from: '2026-08-01', to: '2026-08-31' }, rates);
  assert.equal(s.income, 1_000_000);
  assert.equal(s.expense, 207_000 + 100 * 300 + 5_000_000);
  assert.equal(s.cats[0].categoryId, 'c1');
});

test('monthlySeries', () => {
  const m = monthlySeries(txs, '2026-09', 3, rates);
  assert.deepEqual(m.map((x) => x.month), ['2026-07', '2026-08', '2026-09']);
  assert.equal(m[1].income, 1_000_000);
  assert.equal(m[0].expense, 0);
});

test('budgetStatus', () => {
  const s = periodStats(txs, { from: '2026-08-01', to: '2026-08-31' }, rates);
  const b = budgetStatus([{ categoryId: 'c1', amount: 10_000_000, currency: 'VND' }], s.cats, rates);
  assert.equal(b[0].spent, 207_000 + 30_000 + 5_000_000);
  assert.ok(b[0].pct > 0.5 && b[0].pct < 0.6);
});

test('filterTxs không phân biệt dấu', () => {
  assert.equal(filterTxs(txs, { q: 'an trua' }).length, 1);
  assert.equal(filterTxs(txs, { accountId: 'gz' }).length, 2); // đích của chuyển + chi
  assert.equal(filterTxs(txs, { kind: 'lend', partyId: 'p3' }).length, 1);
});

test('groupByDate: mới → cũ', () => {
  const g = groupByDate(txs, rates);
  assert.equal(g[0].date, '2026-08-30');
  assert.equal(g[0].expense, 100 * 300 + 5_000_000);
});

// ── Vay nợ khác tiền tệ với tài khoản: đổi đô la ở ngân hàng rồi chuyển đồng cho người vay ──
const usdAccounts = [
  { id: 'vcb', name: 'Vietcombank', currency: 'USD', opening: 2500 },
  { id: 'mb2', name: 'Thẻ MB', currency: 'VND', opening: 1_000_000 },
];

test('cho vay VND từ tài khoản USD: trừ đô la, người vay nợ đồng', () => {
  const list = [{ id: 'a', date: '2026-10-15', kind: 'lend', amount: 7_800_000, currency: 'VND', accountAmount: 300, accountId: 'vcb', partyId: 'p1', ts: 1 }];
  const b = accountBalances(usdAccounts, list);
  assert.equal(b.get('vcb'), 2200); // chỉ trừ 300 USD, không trừ 7,8 triệu "đô"
  assert.equal(b.get('mb2'), 1_000_000);
  assert.deepEqual(debtBalances(list).get('p1'), { VND: 7_800_000 });
  const o = overview({ accounts: usdAccounts, txs: list, rates: { USD: 26000 } });
  assert.deepEqual(o.cash, { USD: 2200, VND: 1_000_000 });
  assert.deepEqual(o.receivable, { VND: 7_800_000 });
});

test('nhận trả bằng VND vào tài khoản USD: cộng đô la, nợ VND giảm', () => {
  const list = [
    { id: 'a', date: '2026-10-15', kind: 'lend', amount: 7_800_000, currency: 'VND', accountAmount: 300, accountId: 'vcb', partyId: 'p1', ts: 1 },
    { id: 'b', date: '2026-10-20', kind: 'repay_in', amount: 2_600_000, currency: 'VND', accountAmount: 100, accountId: 'vcb', partyId: 'p1', ts: 2 },
  ];
  assert.equal(accountBalances(usdAccounts, list).get('vcb'), 2300);
  assert.deepEqual(debtBalances(list).get('p1'), { VND: 5_200_000 });
});

test('accountAmount trống / không hợp lệ thì dùng amount (khoản cùng tiền tệ như trước)', () => {
  assert.equal(accAmount({ amount: 500, currency: 'USD' }), 500);
  assert.equal(accAmount({ amount: 500, accountAmount: '' }), 500);
  assert.equal(accAmount({ amount: 500, accountAmount: null }), 500);
  assert.equal(accAmount({ amount: 500, accountAmount: 0 }), 500);
  assert.equal(accAmount({ amount: 7_800_000, accountAmount: 300 }), 300);
  const same = [{ id: 'x', date: '2026-10-15', kind: 'lend', amount: 100, currency: 'USD', accountId: 'vcb', partyId: 'p1', ts: 1 }];
  assert.equal(accountBalances(usdAccounts, same).get('vcb'), 2400);
});

test('incomeStats: chỉ tính kind income, quy VND, nhóm theo danh mục, lọc theo tài khoản / tháng', () => {
  const txs = [
    { id: '1', date: '2026-10-05', kind: 'income', amount: 11_000_000, currency: 'VND', accountId: 'mb', categoryId: 'luong' },
    { id: '2', date: '2026-10-20', kind: 'income', amount: 15000, currency: 'RUB', accountId: 'gz', categoryId: 'hocbong' },
    { id: '3', date: '2026-10-21', kind: 'income', amount: 500_000, currency: 'VND', accountId: 'mb', categoryId: '' },
    { id: '4', date: '2026-10-22', kind: 'repay_in', amount: 9_000_000, currency: 'VND', accountId: 'mb', partyId: 'p' }, // nhận trả nợ: không phải thu nhập
    { id: '5', date: '2026-10-23', kind: 'expense', amount: 100_000, currency: 'VND', accountId: 'mb' },
    { id: '6', date: '2026-09-30', kind: 'income', amount: 1, currency: 'VND', accountId: 'mb', categoryId: 'luong' }, // tháng khác
  ];
  const r = incomeStats(txs, { from: '2026-10-01', to: '2026-10-31' }, rates);
  assert.equal(r.count, 3);
  assert.equal(r.total, 11_000_000 + 15000 * 300 + 500_000);
  assert.deepEqual(r.byCur, { VND: 11_500_000, RUB: 15000 });
  assert.deepEqual(r.cats.map((c) => c.categoryId), ['luong', 'hocbong', '_none']);
  assert.equal(r.cats[1].amount, 4_500_000);
  assert.deepEqual(r.missing, []);
  const mb = incomeStats(txs, { from: '2026-10-01', to: '2026-10-31', accountId: 'mb' }, rates);
  assert.equal(mb.count, 2);
  assert.equal(mb.total, 11_500_000);
  assert.equal(incomeStats(txs, { categoryId: 'luong' }, rates).count, 2); // không giới hạn ngày
});

test('incomeStats: thiếu tỷ giá thì báo thiếu và không cộng vào tổng', () => {
  const r = incomeStats([
    { date: '2026-10-05', kind: 'income', amount: 100, currency: 'USD', categoryId: 'x' },
    { date: '2026-10-05', kind: 'income', amount: 1_000_000, currency: 'VND', categoryId: 'x' },
  ], {}, { RUB: 300 });
  assert.equal(r.total, 1_000_000);
  assert.deepEqual(r.missing, ['USD']);
  assert.equal(r.count, 2);
  assert.deepEqual(r.byCur, { USD: 100, VND: 1_000_000 });
});
