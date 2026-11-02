import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseExpr, fmtMoney, fmtNum, roundTo, impliedRate, roundCur, toEditable } from '../web/js/money.js';

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

test('impliedRate: viết "1 đơn vị lớn = n đơn vị nhỏ", thiếu số hoặc cùng tiền tệ thì rỗng', () => {
  assert.equal(impliedRate(7_800_000, 'VND', 300, 'USD'), `1 USD = ${fmtNum(26000, 2)} VND`);
  assert.equal(impliedRate(300, 'USD', 7_800_000, 'VND'), `1 USD = ${fmtNum(26000, 2)} VND`);
  assert.equal(impliedRate(1500, 'RUB', 5, 'USD'), `1 USD = ${fmtNum(300, 2)} RUB`);
  assert.equal(impliedRate('', 'VND', 300, 'USD'), '');
  assert.equal(impliedRate(100, 'USD', 100, 'USD'), '');
  assert.equal(impliedRate(0, 'VND', 300, 'USD'), '');
});

test('máy tính: nhân chia và ngoặc, vẫn dùng k / tr', () => {
  const v = (x) => { const r = parseExpr(x); return r ? r.total : null; };
  assert.equal(v('45k*3'), 135_000);
  assert.equal(v('450k/3'), 150_000);
  assert.equal(v('2×3'), 6);
  assert.equal(v('10÷4'), 2.5);
  assert.equal(v('3x25k'), 75_000);          // x đứng giữa hai số = nhân
  assert.equal(v('3 x 25k'), 75_000);
  assert.equal(v('3trx2'), 6_000_000);       // "tr" rồi x
  assert.equal(v('1,5tr*2'), 3_000_000);
  assert.equal(v('1.500.000/3'), 500_000);
  assert.equal(v('(2tr+500k)*2'), 5_000_000);
  assert.equal(v('10-(2+3)*2'), 0);
  assert.equal(v('=-3k+5k*1'), 2_000);
});

test('máy tính: đúng thứ tự phép tính, nhân chia trước cộng trừ', () => {
  assert.equal(parseExpr('2tr+300k*2').total, 2_600_000);
  assert.equal(parseExpr('2tr-300k/3').total, 1_900_000);
  assert.equal(parseExpr('(2tr-300k)/2').total, 850_000);
  assert.equal(parseExpr('-(1+2)*3').total, -9);
});

test('máy tính: biểu thức sai hoặc chia cho 0 thì trả null', () => {
  for (const bad of ['1/0', '(1+2', '1+2)', '5*', '*5', 'x3', '12xyz', '3*abc', '()', '2k*', '1/(2-2)']) {
    assert.equal(parseExpr(bad), null, bad);
  }
});

test('máy tính: cộng trừ thuần giữ nguyên cách trả parts cũ', () => {
  assert.equal(parseExpr('3tr+500k-120000').parts.length, 3);
  assert.deepEqual(parseExpr('45k*3').parts, [135_000]);
});

test('roundCur: VND làm tròn đồng, ngoại tệ 2 số lẻ, tỷ giá (tiền tệ rỗng) giữ nguyên', () => {
  assert.equal(roundCur(666666.666667, 'VND'), 666_667);
  assert.equal(roundCur(12.3456, 'USD'), 12.35);
  assert.equal(roundCur(26.12345, ''), 26.12345);
});

test('toEditable: đưa vào ô nhập rồi đọc lại ra đúng số cũ', () => {
  for (const [n, cur] of [[135000, 'VND'], [666666.666667, 'VND'], [12.5, 'USD'], [-0.25, 'USD'], [1.234, ''], [0.5, ''], [1234.567, ''], [26.3, ''], [0, 'VND']]) {
    const t = toEditable(n, cur);
    assert.equal(parseExpr(t).total, cur ? roundCur(n, cur) : n, `${n} ${cur} → "${t}"`);
  }
  assert.equal(toEditable(1.234, ''), '1.2340');   // tránh bị đọc thành 1234
  assert.equal(toEditable(NaN), '');
});
