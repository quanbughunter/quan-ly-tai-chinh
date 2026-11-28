import test from 'node:test';
import assert from 'node:assert/strict';
import { pressKey } from '../web/js/calcpad.js';
import { parseExpr, toEditable } from '../web/js/money.js';

const press = (keys, start = '') => keys.reduce((t, k) => pressKey(t, k), start);

test('gõ 45k × 3 bằng phím', () => {
  assert.equal(press(['4', '5', 'k', '×', '3']), '45k×3');
  assert.equal(parseExpr('45k×3').total, 135_000);
});

test('phím 000 chỉ gõ được sau một chữ số', () => {
  assert.equal(press(['5', '000']), '5000');
  assert.equal(press(['000']), '');
  assert.equal(press(['5', '+', '000']), '5+');
});

test('k / tr / tỷ chỉ gõ được sau chữ số, không gõ chồng', () => {
  assert.equal(press(['k']), '');
  assert.equal(press(['2', 'tr', 'k']), '2tr');
  assert.equal(press(['2', 'tr', '+', '5', '0', '0', 'k']), '2tr+500k');
  assert.equal(press(['1', 'tỷ']), '1tỷ');
});

test('dấu phẩy thập phân: một lần trong mỗi số, đầu số thì thêm 0', () => {
  assert.equal(press(['1', ',', '5', 'tr']), '1,5tr');
  assert.equal(press(['1', ',', ',']), '1,');
  assert.equal(press([',']), '0,');
  assert.equal(press(['2', '+', ',', '5']), '2+0,5');
  assert.equal(press(['1', ',', '5', '+', '2', ',', '5']), '1,5+2,5');
});

test('phép tính: bấm liền hai phép thì đổi phép, đầu biểu thức chỉ cho dấu trừ', () => {
  assert.equal(press(['5', '+', '-']), '5-');
  assert.equal(press(['×']), '');
  assert.equal(press(['-', '5']), '-5');
  assert.equal(press(['(', '×']), '(');
  assert.equal(press(['(', '-', '5']), '(-5');
});

test('ngoặc: tự thêm × khi liền sau số, chỉ đóng khi còn ngoặc mở', () => {
  assert.equal(press(['2', '(', '3', '+', '4', ')']), '2×(3+4)');
  assert.equal(press([')']), '');
  assert.equal(press(['(', '3', ')', ')']), '(3)');
  assert.equal(press(['(', '3', ')', '4']), '(3)×4');
  assert.equal(parseExpr(press(['2', '(', '3', '+', '4', ')'])).total, 14);
});

test('xóa lùi: bỏ cả "tr" / "tỷ" một lần; xóa hết', () => {
  assert.equal(press(['back'], '2tr'), '2');
  assert.equal(press(['back'], '2tỷ'), '2');
  assert.equal(press(['back'], '45k'), '45');
  assert.equal(press(['back'], ''), '');
  assert.equal(press(['clear'], '45k×3'), '');
});

test('bấm số sau k / tr / tỷ là phần lẻ: 5 tr 2 → 5tr2 = 5,2 triệu', () => {
  assert.equal(press(['5', 'tr', '2']), '5tr2');
  assert.equal(parseExpr(press(['5', 'tr', '2'])).total, 5_200_000);
  assert.equal(press(['5', 'k', '3']), '5k3');
  assert.equal(press(['5', 'k', '3', '4', '5', '6']), '5k345');         // k tối đa 3 chữ số lẻ
  assert.equal(press(['5', 'tr', '2', '000']), '5tr2000');
  assert.equal(press(['5', 'k', '3', '000']), '5k3');                   // quá chỗ thì không gõ
  assert.equal(press(['5', 'tr', '2', 'k']), '5tr2');                   // không gõ chồng đơn vị
  assert.equal(press(['5', 'tr', '2', ',']), '5tr2');                   // không thêm dấu phẩy
  assert.equal(press(['1', ',', '5', 'tr', '2']), '1,5tr');             // 1,5tr đã có phần lẻ
  assert.equal(press(['5', 'tr', '2', '+', '3', '0', '0', 'k']), '5tr2+300k');
  assert.equal(parseExpr(press(['5', 'tr', '2', '+', '3', '0', '0', 'k'])).total, 5_500_000);
  assert.equal(press(['back'], '5tr2'), '5tr');
  assert.equal(press(['5', 'tr', '2', '(']), '5tr2×(');
});

test('mọi chuỗi bàn phím tạo ra đều đọc được (hoặc chưa xong), và "=" quay lại số đọc được', () => {
  const t = press(['4', '5', '0', 'k', '÷', '3']);
  const r = parseExpr(t);
  assert.equal(r.total, 150_000);
  assert.equal(parseExpr(toEditable(r.total, 'VND')).total, 150_000);
});
