import test from 'node:test';
import assert from 'node:assert/strict';
import { partyUsage, planPartyDelete, deleteParty } from '../web/js/partydel.js';

// Mọi dữ liệu ở đây là số tự đặt.

const txs = [
  { id: 't1', kind: 'lend', amount: 5_000_000, currency: 'VND', partyId: 'p1', accountId: 'a1' },
  { id: 't2', kind: 'repay_in', amount: 2_000_000, currency: 'VND', partyId: 'p1', accountId: 'a1' },
  { id: 't3', kind: 'lend', amount: 100, currency: 'USD', partyId: 'p1', accountId: 'a2' },
  { id: 't4', kind: 'borrow', amount: 300_000, currency: 'VND', partyId: 'p2', accountId: 'a1' },
  { id: 't5', kind: 'expense', amount: 50_000, currency: 'VND', accountId: 'a1' },
];
const deals = [
  { id: 'd1', dir: 'sang', status: 'done', partyId: 'p1' },
  { id: 'd2', dir: 've', status: 'quote', partyId: 'p2' },
];

test('người chưa có gì gắn vào thì used = false', () => {
  const u = partyUsage('p9', { txs, deals });
  assert.equal(u.used, false);
  assert.deepEqual(u.balance, {});
});

test('đếm giao dịch, lệnh đổi tiền và số dư theo từng tiền tệ', () => {
  const u = partyUsage('p1', { txs, deals });
  assert.equal(u.used, true);
  assert.deepEqual(u.txs.map((t) => t.id), ['t1', 't2', 't3']);
  assert.deepEqual(u.deals.map((d) => d.id), ['d1']);
  assert.deepEqual(u.balance, { VND: 3_000_000, USD: 100 });
});

test('mình nợ người đó thì số dư âm; đã tất toán thì không còn trong balance', () => {
  assert.deepEqual(partyUsage('p2', { txs, deals }).balance, { VND: -300_000 });
  const settled = [
    { id: 'x1', kind: 'lend', amount: 1_000, currency: 'VND', partyId: 'p3' },
    { id: 'x2', kind: 'repay_in', amount: 1_000, currency: 'VND', partyId: 'p3' },
  ];
  const u = partyUsage('p3', { txs: settled });
  assert.deepEqual(u.balance, {});
  assert.equal(u.used, true); // đã tất toán nhưng vẫn có giao dịch
});

test('kế hoạch xóa: xóa giao dịch của người đó, chỉ bỏ tên người ở lệnh đổi tiền', () => {
  const plan = planPartyDelete('p1', { txs, deals });
  assert.deepEqual(plan.txIds, ['t1', 't2', 't3']);
  assert.deepEqual(plan.dealDocs, [{ id: 'd1', dir: 'sang', status: 'done', partyId: '' }]);
  assert.equal(deals[0].partyId, 'p1'); // không sửa dữ liệu gốc
});

function fakeStore() {
  const calls = [];
  const data = { txs: [...txs], deals: [...deals], parties: [{ id: 'p1' }, { id: 'p2' }] };
  return {
    calls, data,
    all: (c) => data[c],
    async delMany(c, ids) { calls.push(['delMany', c, ids]); data[c] = data[c].filter((x) => !ids.includes(x.id)); },
    async putMany(c, docs) { calls.push(['putMany', c, docs.map((d) => d.id)]); data[c] = data[c].map((x) => docs.find((d) => d.id === x.id) || x); },
    async del(c, id) { calls.push(['del', c, id]); data[c] = data[c].filter((x) => x.id !== id); },
  };
}

test('xóa: giao dịch → lệnh đổi tiền → người, người khác không bị đụng tới', async () => {
  const s = fakeStore();
  const r = await deleteParty(s, 'p1');
  assert.deepEqual(r, { txs: 3, deals: 1 });
  assert.deepEqual(s.calls.map((c) => c[0]), ['delMany', 'putMany', 'del']);
  assert.deepEqual(s.data.txs.map((t) => t.id), ['t4', 't5']);
  assert.deepEqual(s.data.parties.map((p) => p.id), ['p2']);
  assert.equal(s.data.deals.find((d) => d.id === 'd1').partyId, '');
  assert.equal(s.data.deals.find((d) => d.id === 'd2').partyId, 'p2');
});

test('người chưa có gì: chỉ gọi xóa người', async () => {
  const s = fakeStore();
  s.data.parties.push({ id: 'p7' });
  assert.deepEqual(await deleteParty(s, 'p7'), { txs: 0, deals: 0 });
  assert.deepEqual(s.calls, [['del', 'parties', 'p7']]);
});

test('lỗi khi xóa giao dịch thì người vẫn còn (chưa bị xóa)', async () => {
  const s = fakeStore();
  s.delMany = async () => { throw new Error('mất mạng'); };
  await assert.rejects(() => deleteParty(s, 'p1'), /mất mạng/);
  assert.ok(s.data.parties.some((p) => p.id === 'p1'));
});
