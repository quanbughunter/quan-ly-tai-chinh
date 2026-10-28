import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick } from '../web/js/quickadd.js';
import { buildQuickDocs, isMismatch, itemOk, newDebt, newHome } from '../web/js/quicksave.js';
import { accountBalances, periodStats } from '../web/js/calc.js';

// Mọi số liệu và tên ở đây là tự đặt.

const withState = (text, opts) => parseQuick(text, opts).map((p) => (p.error ? p : { ...p, debt: newDebt(), home: newHome() }));
const MB = { id: 'mb', name: 'Thẻ MB', currency: 'VND' };

test('có tài khoản: giao dịch gắn đúng tài khoản và tiền tệ', () => {
  const { docs } = buildQuickDocs({ items: withState('cafe 25k, ăn trưa 45k'), account: MB, date: '2026-10-28' });
  assert.equal(docs.length, 2);
  assert.ok(docs.every((d) => d.accountId === 'mb' && d.currency === 'VND' && d.kind === 'expense'));
  assert.deepEqual(docs.map((d) => d.amount), [25000, 45000]);
});

test('không gắn tài khoản: accountId rỗng, tiền tệ lấy theo từng khoản', () => {
  const items = withState('cafe 25k; grab 12 usd; +lương 300 rub');
  const { docs } = buildQuickDocs({ items, account: null, date: '2026-10-28' });
  assert.equal(docs.length, 3);
  assert.ok(docs.every((d) => d.accountId === ''));
  assert.deepEqual(docs.map((d) => d.currency), ['VND', 'USD', 'RUB']);
  assert.deepEqual(docs.map((d) => d.kind), ['expense', 'expense', 'income']);
});

test('không gắn tài khoản thì không khoản nào bị coi là lệch tiền tệ', () => {
  const [usd] = withState('grab 12 usd');
  assert.equal(isMismatch(usd, MB), true); // thẻ VND, khoản USD
  assert.equal(isMismatch(usd, null), false);
});

test('khoản không gắn tài khoản không đổi số dư thẻ nào nhưng vẫn vào thống kê chi', () => {
  const { docs } = buildQuickDocs({ items: withState('cafe 25k'), account: null, date: '2026-10-28' });
  const txs = docs.map((d, i) => ({ ...d, id: `t${i}` }));
  const bal = accountBalances([{ ...MB, opening: 1_000_000 }], txs);
  assert.equal(bal.get('mb'), 1_000_000);
  const st = periodStats(txs, { from: '2026-10-01', to: '2026-10-31' }, { VND: 1 });
  assert.equal(st.expense, 25000);
});

test('khoản thu gửi cho bố khi không gắn tài khoản: hai giao dịch, đều không gắn tài khoản', () => {
  const items = withState('+lương 10tr', { defaultKind: 'income' });
  items[0].home = { on: true, manual: 8_000_000, bad: false };
  const { docs, sent } = buildQuickDocs({ items, account: null, date: '2026-10-28', familyCategoryId: 'fam' });
  assert.equal(sent, 1);
  assert.equal(docs.length, 2);
  assert.deepEqual(docs.map((d) => [d.kind, d.amount, d.accountId]), [['income', 10_000_000, ''], ['expense', 8_000_000, '']]);
  assert.equal(docs[1].categoryId, 'fam');
});

test('chia nợ khi không gắn tài khoản: giao dịch cho vay vẫn ghi đúng người, không gắn tài khoản', () => {
  const items = withState('ăn lẩu 600k');
  items[0].debt = { mode: 'add', partyIds: ['a', 'b'], includeMe: true, manual: {}, bad: {} };
  const names = { a: 'An', b: 'Bình' };
  const { docs, shared, lastPeople } = buildQuickDocs({ items, account: null, date: '2026-10-28', nameOf: (id) => names[id] });
  assert.equal(shared, 1);
  assert.deepEqual(lastPeople, ['a', 'b']);
  assert.deepEqual(docs.map((d) => [d.kind, d.amount, d.partyId || '', d.accountId]), [
    ['lend', 200000, 'a', ''], ['lend', 200000, 'b', ''], ['expense', 200000, '', ''],
  ]);
});

test('khoản lỗi hoặc lệch tiền tệ bị bỏ qua; mốc thời gian tăng dần để giữ thứ tự', () => {
  const items = [...withState('cafe 25k; grab 12 usd'), { raw: 'abc', error: 'Không thấy số tiền' }];
  assert.equal(itemOk(items[1]), true);
  items[1].mismatch = isMismatch(items[1], MB);
  const { docs } = buildQuickDocs({ items, account: MB, date: '2026-10-28', now: () => 1000 });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].ts, 1001);
});
