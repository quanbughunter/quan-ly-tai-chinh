import test from 'node:test';
import assert from 'node:assert/strict';
import { splitEven, planShare, buildShareTxs, describeShare, planSendHome, buildSendHomeTx, describeSendHome } from '../web/js/share.js';

// Mọi tên và số liệu ở đây là tự đặt.

const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);
const names = { a: 'An', b: 'Bình' };
const nameOf = (id) => names[id] || id;

test('chia đều: tổng luôn bằng số tiền, số lẻ dồn cho phần đầu', () => {
  assert.deepEqual(splitEven(450, 3, 'RUB'), [150, 150, 150]);
  assert.deepEqual(splitEven(100000, 3, 'VND'), [33334, 33333, 33333]);
  assert.deepEqual(splitEven(10, 3, 'RUB'), [3.34, 3.33, 3.33]);
  assert.equal(splitEven(10, 3, 'RUB').reduce((s, v) => s + v, 0), 10);
  assert.deepEqual(splitEven(5, 0, 'VND'), []);
});

test('cộng nợ, tính cả phần mình: mình + 2 người chia đều ba phần', () => {
  const p = planShare({ mode: 'add', amount: 450, currency: 'RUB', partyIds: ['a', 'b'], includeMe: true });
  assert.equal(p.ok, true);
  assert.deepEqual(p.shares, { a: 150, b: 150 });
  assert.equal(p.myShare, 150);
});

test('cộng nợ: số lẻ do người trả gánh, hai người kia không bị tính dư', () => {
  const p = planShare({ mode: 'add', amount: 100000, currency: 'VND', partyIds: ['a', 'b'], includeMe: true });
  assert.deepEqual(p.shares, { a: 33333, b: 33333 });
  assert.equal(p.myShare, 33334);
  assert.equal(sum(p.shares) + p.myShare, 100000);
});

test('cộng nợ, không tính phần mình: chia hết cho những người được chọn', () => {
  const p = planShare({ mode: 'add', amount: 100000, currency: 'VND', partyIds: ['a', 'b'], includeMe: false });
  assert.deepEqual(p.shares, { a: 50000, b: 50000 });
  assert.equal(p.myShare, 0);
  const q = planShare({ mode: 'add', amount: 100001, currency: 'VND', partyIds: ['a', 'b'], includeMe: false });
  assert.equal(sum(q.shares), 100001);
});

test('phần nhập tay: người còn lại (và mình) chia đều phần dư', () => {
  const p = planShare({ mode: 'add', amount: 600, currency: 'RUB', partyIds: ['a', 'b'], includeMe: true, manual: { a: 300 } });
  assert.deepEqual(p.shares, { a: 300, b: 150 });
  assert.equal(p.myShare, 150);
  // nhập tay hết, không tính phần mình → phải khớp đúng
  assert.equal(planShare({ mode: 'add', amount: 600, currency: 'RUB', partyIds: ['a', 'b'], manual: { a: 300, b: 300 } }).ok, true);
  const short = planShare({ mode: 'add', amount: 600, currency: 'RUB', partyIds: ['a', 'b'], manual: { a: 300, b: 200 } });
  assert.equal(short.ok, false);
  assert.match(short.error, /thiếu/);
});

test('phần nhập tay vượt tổng hoặc ≤ 0 → báo lỗi', () => {
  const over = planShare({ mode: 'add', amount: 600, currency: 'RUB', partyIds: ['a', 'b'], includeMe: true, manual: { a: 500, b: 200 } });
  assert.equal(over.ok, false);
  assert.match(over.error, /vượt/);
  assert.equal(planShare({ mode: 'add', amount: 600, currency: 'RUB', partyIds: ['a'], manual: { a: 0 } }).ok, false);
});

test('trừ nợ: chia đều số tiền nhận được cho người đã chọn, không có phần của mình', () => {
  const p = planShare({ mode: 'sub', amount: 300, currency: 'RUB', partyIds: ['a', 'b'], includeMe: true });
  assert.deepEqual(p.shares, { a: 150, b: 150 });
  assert.equal(p.myShare, 0);
  const one = planShare({ mode: 'sub', amount: 300, currency: 'RUB', partyIds: ['a'] });
  assert.deepEqual(one.shares, { a: 300 });
});

test('không chọn ai / số tiền sai / quá nhỏ → lỗi; chế độ none → không làm gì', () => {
  assert.equal(planShare({ mode: 'add', amount: 450, currency: 'RUB', partyIds: [] }).ok, false);
  assert.equal(planShare({ mode: 'add', amount: 0, currency: 'RUB', partyIds: ['a'] }).ok, false);
  assert.equal(planShare({ mode: 'sub', amount: 2, currency: 'VND', partyIds: ['a', 'b', 'c'] }).ok, false);
  const n = planShare({ mode: 'none', amount: 450, currency: 'RUB', partyIds: ['a'] });
  assert.equal(n.ok, true);
  assert.deepEqual(n.shares, {});
});

test('dựng giao dịch cộng nợ: lend cho từng người + chi tiêu phần mình, tổng chi tài khoản = số tiền', () => {
  const plan = planShare({ mode: 'add', amount: 450, currency: 'RUB', partyIds: ['a', 'b'], includeMe: true });
  const txs = buildShareTxs({ mode: 'add', plan, date: '2025-03-12', currency: 'RUB', accountId: 'acc', note: 'ăn trưa', categoryId: 'food', nameOf });
  assert.equal(txs.length, 3);
  assert.deepEqual(txs[0], { date: '2025-03-12', kind: 'lend', amount: 150, currency: 'RUB', accountId: 'acc', partyId: 'a', categoryId: '', note: 'ăn trưa · phần của An' });
  assert.equal(txs[1].partyId, 'b');
  assert.deepEqual(txs[2], { date: '2025-03-12', kind: 'expense', amount: 150, currency: 'RUB', accountId: 'acc', categoryId: 'food', note: 'ăn trưa (phần mình)' });
  assert.equal(txs.reduce((s, t) => s + t.amount, 0), 450);
  assert.ok(txs.every((t) => t.accountId === 'acc'));
});

test('dựng giao dịch cộng nợ không tính phần mình: không có khoản chi', () => {
  const plan = planShare({ mode: 'add', amount: 300, currency: 'RUB', partyIds: ['a', 'b'], includeMe: false });
  const txs = buildShareTxs({ mode: 'add', plan, date: '2025-03-12', currency: 'RUB', accountId: 'acc', note: '', nameOf });
  assert.deepEqual(txs.map((t) => t.kind), ['lend', 'lend']);
  assert.equal(txs[0].note, 'Tiền ăn · phần của An');
});

test('dựng giao dịch trừ nợ: repay_in cho từng người, không phát sinh thu nhập', () => {
  const plan = planShare({ mode: 'sub', amount: 300, currency: 'RUB', partyIds: ['a', 'b'] });
  const txs = buildShareTxs({ mode: 'sub', plan, date: '2025-03-12', currency: 'RUB', accountId: 'acc', note: 'trả tiền ăn', nameOf });
  assert.deepEqual(txs.map((t) => t.kind), ['repay_in', 'repay_in']);
  assert.deepEqual(txs.map((t) => t.amount), [150, 150]);
  assert.equal(txs[0].note, 'trả tiền ăn · An trả');
  assert.equal(buildShareTxs({ mode: 'sub', plan: { ok: false }, nameOf }).length, 0);
});

test('mô tả tác động để người dùng kiểm tra', () => {
  const plan = planShare({ mode: 'add', amount: 450, currency: 'RUB', partyIds: ['a', 'b'], includeMe: true });
  const text = describeShare({ mode: 'add', amount: 450, currency: 'RUB', plan, nameOf });
  assert.match(text, /mình trả hết/);
  assert.match(text, /An nợ thêm/);
  assert.match(text, /Chi tiêu của mình/);
  const sub = describeShare({ mode: 'sub', amount: 300, currency: 'RUB', plan: planShare({ mode: 'sub', amount: 300, currency: 'RUB', partyIds: ['a'] }), nameOf });
  assert.match(sub, /nợ giảm/);
  assert.equal(describeShare({ mode: 'add', amount: 1, currency: 'RUB', plan: { ok: false, error: 'Chọn ít nhất một người.' } }), 'Chọn ít nhất một người.');
});

test('gửi bố: để trống = gửi cả khoản, không giữ lại gì', () => {
  const p = planSendHome({ amount: 11_000_000, currency: 'VND' });
  assert.deepEqual(p, { ok: true, amount: 11_000_000, keep: 0 });
  assert.match(describeSendHome({ plan: p, currency: 'VND' }), /Gửi bố cả 11\.000\.000 ₫/);
});

test('gửi bố một phần: phần còn lại giữ trong tài khoản', () => {
  const p = planSendHome({ amount: 11_000_000, sendAmount: 8_000_000, currency: 'VND' });
  assert.equal(p.ok, true);
  assert.equal(p.amount, 8_000_000);
  assert.equal(p.keep, 3_000_000);
  assert.match(describeSendHome({ plan: p, currency: 'VND' }), /giữ lại 3\.000\.000 ₫/);
});

test('gửi bố: số gửi vượt khoản thu hoặc không dương thì báo lỗi', () => {
  assert.equal(planSendHome({ amount: 100, sendAmount: 150, currency: 'RUB' }).ok, false);
  assert.equal(planSendHome({ amount: 100, sendAmount: 0, currency: 'RUB' }).ok, false);
  assert.equal(planSendHome({ amount: 0, currency: 'RUB' }).ok, false);
  assert.equal(planSendHome({ amount: 100, sendAmount: 100, currency: 'RUB' }).ok, true); // đúng bằng khoản thu
});

test('gửi bố: số lẻ RUB không bị lệch', () => {
  const p = planSendHome({ amount: 10.1, sendAmount: 3.05, currency: 'RUB' });
  assert.equal(p.amount, 3.05);
  assert.equal(p.keep, 7.05);
});

test('buildSendHomeTx: khoản chi trừ cùng tài khoản, ghi chú nói rõ gửi ai', () => {
  const t = buildSendHomeTx({ date: '2026-10-16', amount: 8_000_000, currency: 'VND', accountId: 'mb', categoryId: 'c1', note: 'lương' });
  assert.deepEqual(t, { date: '2026-10-16', kind: 'expense', amount: 8_000_000, currency: 'VND', accountId: 'mb', categoryId: 'c1', note: 'Gửi bố · lương' });
  assert.equal(buildSendHomeTx({ date: 'd', amount: 1, currency: 'VND', accountId: 'a' }).note, 'Gửi bố');
});
