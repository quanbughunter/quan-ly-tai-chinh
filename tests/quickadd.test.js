import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick, guessCategoryName } from '../web/js/quickadd.js';

test('nhiều khoản trong một lần gõ', () => {
  const r = parseQuick('cafe 25k, ăn trưa 45k; grab 38k');
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((x) => x.amount), [25000, 45000, 38000]);
  assert.deepEqual(r.map((x) => x.note), ['cafe', 'ăn trưa', 'grab']);
  assert.deepEqual(r.map((x) => x.categoryName), ['Ăn uống', 'Ăn uống', 'Đi lại']);
});

test('dấu phẩy thập phân không bị tách nhầm', () => {
  const r = parseQuick('quà mẹ 1,5tr');
  assert.equal(r.length, 1);
  assert.equal(r[0].amount, 1_500_000);
  assert.equal(r[0].categoryName, 'Biếu gia đình');
});

test('thu nhập bằng dấu +', () => {
  const r = parseQuick('+lương 10,9tr');
  assert.equal(r[0].kind, 'income');
  assert.equal(r[0].amount, 10_900_000);
  assert.equal(r[0].categoryName, 'Lương');
});

test('nhận diện tiền tệ', () => {
  const r = parseQuick('ship 12 usd; sữa 366 rub; trà 45k');
  assert.deepEqual(r.map((x) => x.currency), ['USD', 'RUB', 'VND']);
  assert.deepEqual(r.map((x) => x.amount), [12, 366, 45000]);
  assert.equal(parseQuick('cơm 50', { defaultCurrency: 'RUB' })[0].currency, 'RUB');
});

test('số tiền đứng trước ghi chú', () => {
  const r = parseQuick('45k trà sữa');
  assert.equal(r[0].amount, 45000);
  assert.equal(r[0].note, 'trà sữa');
});

test('báo lỗi khi không có số', () => {
  assert.ok(parseQuick('chỉ có chữ')[0].error);
});

test('từ khóa ngắn không khớp nhầm', () => {
  assert.equal(guessCategoryName('xem phim'), 'Du lịch / giải trí'); // "xe" không khớp "xem"
  assert.equal(guessCategoryName('đi xe buýt'), 'Đi lại');
});
