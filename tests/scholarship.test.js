import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isReceived, scholarshipAmount, receivingAccounts, pickScholarshipAccountId, scholarshipTxFor, DEFAULT_SCHOLARSHIP_AMOUNT,
} from '../web/js/scholarship.js';

// Mọi dữ liệu ở đây là số tự đặt.

const accs = [
  { id: 'mb', name: 'Thẻ MB', currency: 'VND', kind: 'bank' },
  { id: 'gaz', name: 'Thẻ Gazprom', currency: 'RUB', kind: 'card' },
  { id: 'psp', name: 'Thẻ PSPB', currency: 'RUB', kind: 'card' },
  { id: 'sav', name: 'Tiết kiệm RUB', currency: 'RUB', kind: 'savings' },
  { id: 'old', name: 'Gazprom cũ', currency: 'RUB', kind: 'card', archived: true },
];

test('đã nhận ⇔ có ngày thực nhận', () => {
  assert.equal(isReceived({ receivedDate: '2025-03-12' }), true);
  assert.equal(isReceived({ availableDate: '2025-03-10' }), false);
  assert.equal(isReceived(null), false);
});

test('số tiền mỗi tháng: cài đặt, không có thì 15.000 ₽', () => {
  assert.equal(DEFAULT_SCHOLARSHIP_AMOUNT, 15000);
  assert.equal(scholarshipAmount({}), 15000);
  assert.equal(scholarshipAmount({ scholarshipAmount: 0 }), 15000);
  assert.equal(scholarshipAmount({ scholarshipAmount: 16500 }), 16500);
});

test('thẻ nhận học bổng: chỉ tài khoản ₽ còn dùng, không phải sổ tiết kiệm', () => {
  assert.deepEqual(receivingAccounts(accs).map((a) => a.id), ['gaz', 'psp']);
});

test('thẻ chọn sẵn: lần chọn trước → Gazprom → PSPB → thẻ ₽ đầu tiên', () => {
  assert.equal(pickScholarshipAccountId(accs, {}), 'gaz');
  assert.equal(pickScholarshipAccountId(accs, { scholarshipAccountId: 'psp' }), 'psp');
  assert.equal(pickScholarshipAccountId(accs, { scholarshipAccountId: 'mb' }), 'gaz'); // không phải thẻ ₽ → bỏ
  assert.equal(pickScholarshipAccountId(accs, { scholarshipAccountId: 'old' }), 'gaz'); // thẻ đã ẩn → bỏ
  assert.equal(pickScholarshipAccountId(accs.filter((a) => a.id !== 'gaz'), {}), 'psp');
  assert.equal(pickScholarshipAccountId([{ id: 'x', name: 'Ví', currency: 'RUB', kind: 'ewallet' }], {}), 'x');
  assert.equal(pickScholarshipAccountId([{ id: 'mb', name: 'MB', currency: 'VND', kind: 'bank' }], {}), '');
});

test('giao dịch học bổng: khoản thu ₽ đúng ngày nhận, gắn scholarshipId', () => {
  const item = { id: 's1', month: '2025-03', amount: 15000, receivedDate: '2025-03-12' };
  assert.deepEqual(scholarshipTxFor(item, { accountId: 'psp', categoryId: 'c1' }), {
    date: '2025-03-12', kind: 'income', amount: 15000, currency: 'RUB', accountId: 'psp',
    categoryId: 'c1', note: 'Học bổng MIIGAiK · Tháng 3/2025', scholarshipId: 's1',
  });
});

test('giao dịch học bổng: chưa nhận, chưa chọn thẻ hoặc số tiền ≤ 0 → không ghi gì', () => {
  const item = { id: 's1', month: '2025-03', amount: 15000, receivedDate: '2025-03-12' };
  assert.equal(scholarshipTxFor({ ...item, receivedDate: '' }, { accountId: 'psp' }), null);
  assert.equal(scholarshipTxFor(item, {}), null);
  assert.equal(scholarshipTxFor({ ...item, amount: 0 }, { accountId: 'psp' }), null);
  assert.equal(scholarshipTxFor({ ...item, amount: undefined }, { accountId: 'psp' }), null);
  assert.equal(scholarshipTxFor(null, { accountId: 'psp' }), null);
});

test('giao dịch học bổng: làm tròn đến 0,01 ₽', () => {
  assert.equal(scholarshipTxFor({ id: 's', month: '2025-03', amount: 15000.004, receivedDate: '2025-03-12' }, { accountId: 'a' }).amount, 15000);
  assert.equal(scholarshipTxFor({ id: 's', month: '2025-03', amount: 15000.456, receivedDate: '2025-03-12' }, { accountId: 'a' }).amount, 15000.46);
});
