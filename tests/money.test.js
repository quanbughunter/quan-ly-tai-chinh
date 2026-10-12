import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseExpr, fmtMoney, fmtNum, roundTo } from '../web/js/money.js';

test('parseAmount: hậu tố k / tr / tỷ', () => {
  assert.equal(parseAmount('25k'), 25000);
  assert.equal(parseAmount('45 nghìn'), 45000);
  assert.equal(parseAmount('2tr'), 2_000_000);
  assert.equal(parseAmount('1,5tr'), 1_500_000);
  assert.equal(parseAmount('1.5tr'), 1_500_000);
  assert.equal(parseAmount('10,9tr'), 10_900_000);
  assert.equal(parseAmount('1.2 tỷ'), 1_200_000_000);
});

test('parseAmount: dấu chấm/phẩy', () => {
  assert.equal(parseAmount('1.500.000'), 1_500_000);
  assert.equal(parseAmount('1,500,000'), 1_500_000);
  assert.equal(parseAmount('1.250'), 1250);
  assert.equal(parseAmount('12.5'), 12.5);
  assert.equal(parseAmount('0,5'), 0.5);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('500'), 500);
});

test('parseAmount: sai định dạng', () => {
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.ok(Number.isNaN(parseAmount('12xyz')));
  assert.ok(Number.isNaN(parseAmount('')));
});

test('parseExpr: biểu thức giống ô `vnd`!D', () => {
  // giá trị đã tính trong file Excel: =-3830-10210-16025 → -30065
  assert.equal(parseExpr('=-3830-10210-16025').total, -30065);
  assert.equal(parseExpr('=-76000-363000-10102').total, -449102);
  assert.equal(parseExpr('573000+500000-3000000').total, -1_927_000);
  assert.equal(parseExpr('3tr+500k').total, 3_500_000);
  assert.equal(parseExpr('=-3830-10210-16025').parts.length, 3);
  assert.equal(parseExpr('12+x'), null);
});

test('fmtMoney / fmtNum', () => {
  assert.equal(fmtNum(1234567), '1.234.567');
  assert.equal(fmtMoney(250000, 'VND'), '250.000 ₫');
  assert.equal(fmtMoney(27_807_000, 'VND', { compact: true }), '27,81 tr');
  assert.equal(fmtMoney(1_200_000_000, 'VND', { compact: true }), '1,2 tỷ');
  assert.equal(fmtMoney(-5000, 'RUB'), '−5.000 ₽');
  assert.equal(fmtMoney(12.5, 'USDT'), '12,5 USDT');
  assert.equal(fmtMoney(null, 'VND'), '—');
});

test('roundTo tránh sai số dấu phẩy động', () => {
  assert.equal(roundTo(0.1 + 0.2, 6), 0.3);
});
