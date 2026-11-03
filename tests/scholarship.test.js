import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isReceived, scholarshipAmount, receivingAccounts, pickScholarshipAccountId, scholarshipTxFor, DEFAULT_SCHOLARSHIP_AMOUNT,
  isReceivingAccount, monthOfDate, defaultScholarshipMonth, resolveScholarshipInput, cleanScholarshipNote,
  validateScholarshipEntry, planScholarshipEntry, orphanScholarshipTxs, planAdoption, scholarshipByMonth,
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

/* ───────── Thêm học bổng từ Thêm giao dịch / Nhập nhanh ───────── */

test('thẻ nhận học bổng: ₽, còn dùng, không phải sổ tiết kiệm', () => {
  assert.equal(isReceivingAccount(accs[1]), true);
  assert.equal(isReceivingAccount(accs[0]), false); // VND
  assert.equal(isReceivingAccount(accs[3]), false); // tiết kiệm
  assert.equal(isReceivingAccount(accs[4]), false); // đã ẩn
  assert.equal(isReceivingAccount(undefined), false);
});

test('tháng mặc định: tháng của ngày có, không có thì tháng của ngày nhận', () => {
  assert.equal(monthOfDate('2026-10-29'), '2026-10');
  assert.equal(monthOfDate('hôm nay'), '');
  assert.equal(defaultScholarshipMonth('2026-10-30', '2026-11-02'), '2026-10');
  assert.equal(defaultScholarshipMonth('', '2026-11-02'), '2026-11');
  assert.equal(defaultScholarshipMonth('', ''), '');
  assert.deepEqual(resolveScholarshipInput({ month: '', availableDate: '' }, '2026-11-02'), { month: '2026-11', availableDate: '', receivedDate: '2026-11-02' });
  assert.deepEqual(resolveScholarshipInput({ month: '2026-09', availableDate: '2026-10-30' }, '2026-11-02'), { month: '2026-09', availableDate: '2026-10-30', receivedDate: '2026-11-02' });
});

test('ghi chú chỉ lặp từ khóa «học bổng» thì bỏ, còn lại giữ nguyên', () => {
  assert.equal(cleanScholarshipNote('học bổng'), '');
  assert.equal(cleanScholarshipNote('  Học bổng MIIGAiK '), '');
  assert.equal(cleanScholarshipNote('стипендия'), '');
  assert.equal(cleanScholarshipNote(''), '');
  assert.equal(cleanScholarshipNote('học bổng kỳ 1 bù'), 'học bổng kỳ 1 bù');
  assert.equal(cleanScholarshipNote('  thưởng thêm '), 'thưởng thêm');
});

const ok = { month: '2026-10', availableDate: '2026-10-29', receivedDate: '2026-11-02', amount: 15000, accountId: 'gaz' };

test('kiểm tra khoản học bổng: đủ dữ liệu và thẻ ₽ → không lỗi', () => {
  assert.equal(validateScholarshipEntry(ok, accs), '');
  assert.equal(validateScholarshipEntry({ ...ok, availableDate: '' }, accs), ''); // ngày có không bắt buộc
  assert.equal(validateScholarshipEntry({ ...ok, availableDate: ok.receivedDate }, accs), ''); // có và nhận cùng ngày
});

test('kiểm tra khoản học bổng: thiếu tháng, ngày, số tiền hoặc thẻ không phải ₽ → báo lỗi tiếng Việt', () => {
  assert.match(validateScholarshipEntry({ ...ok, month: '' }, accs), /tháng/);
  assert.match(validateScholarshipEntry({ ...ok, month: '2026-13' }, accs), /tháng/);
  assert.match(validateScholarshipEntry({ ...ok, receivedDate: '' }, accs), /ngày thực nhận/);
  assert.match(validateScholarshipEntry({ ...ok, availableDate: 'abc' }, accs), /không hợp lệ/);
  assert.match(validateScholarshipEntry({ ...ok, availableDate: '2026-11-03' }, accs), /không thể sau/);
  assert.match(validateScholarshipEntry({ ...ok, amount: 0 }, accs), /số tiền/);
  assert.match(validateScholarshipEntry({ ...ok, amount: undefined }, accs), /số tiền/);
  assert.match(validateScholarshipEntry({ ...ok, accountId: 'mb' }, accs), /thẻ ₽/); // thẻ VND
  assert.match(validateScholarshipEntry({ ...ok, accountId: 'sav' }, accs), /thẻ ₽/); // sổ tiết kiệm
  assert.match(validateScholarshipEntry({ ...ok, accountId: '' }, accs), /thẻ ₽/);
});

test('dựng dòng tháng: tháng mới → đã nhận, ₽, đúng ngày có / ngày nhận, không có txId', () => {
  const doc = planScholarshipEntry({ id: 's9', month: '2026-10', availableDate: '2026-10-29', receivedDate: '2026-11-02', amount: 15000.004, note: '' });
  assert.deepEqual(doc, { id: 's9', month: '2026-10', currency: 'RUB', receivedDate: '2026-11-02', amount: 15000, availableDate: '2026-10-29' });
});

test('dựng dòng tháng: tháng đang chờ → giữ mã và ngày có cũ nếu lần này bỏ trống, đánh dấu đã nhận', () => {
  const waiting = { id: 's1', month: '2026-10', currency: 'RUB', amount: 15000, availableDate: '2026-10-29', note: 'chờ' };
  const doc = planScholarshipEntry({ existing: waiting, id: 'khac', month: '2026-10', availableDate: '', receivedDate: '2026-11-02', amount: 15000 });
  assert.equal(doc.id, 's1');
  assert.equal(doc.availableDate, '2026-10-29');
  assert.equal(doc.receivedDate, '2026-11-02');
  assert.equal(doc.note, 'chờ');
  assert.ok(isReceived(doc));
});

test('dựng dòng tháng: nhập lại tháng đã nhận → cập nhật chính dòng đó (không tạo dòng thứ hai), ngày mới thắng ngày cũ', () => {
  const got = { id: 's1', month: '2026-10', currency: 'RUB', amount: 15000, availableDate: '2026-10-29', receivedDate: '2026-11-02', txId: 't1' };
  const doc = planScholarshipEntry({ existing: got, id: 'khac', month: '2026-10', availableDate: '2026-10-30', receivedDate: '2026-11-03', amount: 16000, note: 'bù' });
  assert.equal(doc.id, 's1');
  assert.equal(doc.availableDate, '2026-10-30');
  assert.equal(doc.receivedDate, '2026-11-03');
  assert.equal(doc.amount, 16000);
  assert.equal(doc.note, 'bù');
  assert.equal('txId' in doc, false); // txId do saveScholarship tự tìm lại, tránh trỏ nhầm
});

test('tìm tháng đã có theo mã tháng', () => {
  const list = [{ id: 'a', month: '2026-09' }, { id: 'b', month: '2026-10' }];
  assert.equal(scholarshipByMonth('2026-10', list).id, 'b');
  assert.equal(scholarshipByMonth('2026-11', list), null);
  assert.equal(scholarshipByMonth('', list), null);
});

/* ───────── Khoản thu «Học bổng» nhập từ trước, chưa gắn tháng ───────── */

const tx = (o) => ({ id: 't', kind: 'income', categoryId: 'cat', currency: 'RUB', accountId: 'gaz', amount: 15000, date: '2026-10-05', ...o });

test('khoản chưa gắn: đúng danh mục, ₽, vào thẻ nhận được, chưa có scholarshipId / dealId', () => {
  const txs = [
    tx({ id: '1', date: '2026-10-05' }),
    tx({ id: '2', date: '2026-09-04' }),
    tx({ id: 'daGan', scholarshipId: 's1' }),
    tx({ id: 'lai', dealId: 'd1' }),
    tx({ id: 'vnd', currency: 'VND', accountId: 'mb' }),
    tx({ id: 'tk', accountId: 'sav' }),
    tx({ id: 'chi', kind: 'expense' }),
    tx({ id: 'khac', categoryId: 'luong' }),
    tx({ id: 'zero', amount: 0 }),
  ];
  assert.deepEqual(orphanScholarshipTxs(txs, accs, 'cat').map((t) => t.id), ['2', '1']); // theo ngày tăng dần
  assert.deepEqual(orphanScholarshipTxs(txs, accs, ''), []);
});

test('gắn khoản có sẵn vào tháng: tháng chưa có hoặc đang chờ thì gắn; tháng đã nhận / trùng nhau thì bỏ qua để khỏi tính hai lần', () => {
  const orphans = [
    tx({ id: 'a', date: '2026-08-05' }), // tháng 8 chưa có dòng → gắn
    tx({ id: 'b', date: '2026-09-04' }), // tháng 9 đang chờ → gắn
    tx({ id: 'c', date: '2026-10-05' }), // tháng 10 đã có giao dịch riêng → bỏ qua
    tx({ id: 'd', date: '2026-11-01' }), // tháng 11 đã nhận (không cộng thẻ) → bỏ qua
    tx({ id: 'e', date: '2026-08-20' }), // trùng tháng 8 với khoản a → bỏ qua
  ];
  const rows = [
    { id: 's9', month: '2026-09', availableDate: '2026-09-02' },
    { id: 's10', month: '2026-10', receivedDate: '2026-10-05', txId: 'x10' },
    { id: 's11', month: '2026-11', receivedDate: '2026-11-01' },
  ];
  const { adopt, skipped } = planAdoption(orphans, rows, [{ id: 'x10' }]);
  assert.deepEqual(adopt.map((x) => [x.tx.id, x.month, x.existing ? x.existing.id : null]), [['a', '2026-08', null], ['b', '2026-09', 's9']]);
  assert.deepEqual(skipped.map((t) => t.id), ['c', 'd', 'e']);
});
