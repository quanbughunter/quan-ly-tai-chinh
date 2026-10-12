import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteSang, realizedSang, quoteVe, realizedVe, evalDeal, suggestedProfit } from '../web/js/fx.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

// Mọi số trong file này là số tự đặt (không phải dữ liệu thật). Giá trị kỳ vọng được tính tay từ công thức nêu trong chú thích.

test('sang: báo giá = (VND/USDT ÷ RUB/USDT) ÷ (1 − lãi ÷ cỡ lô)', () => {
  // 26.000 ÷ 80 = 325 VND/RUB; lãi 60.000 trên cỡ lô 1.200.000 → ÷ 0,95
  const q = quoteSang({ vndPerUsdt: 26000, rubPerUsdt: 80, vndAmount: 6_000_000, margin: 60_000 });
  near(q.base, 325);
  near(q.quote, 342.10526315789474);
  near(q.rubPay, 17538.46153846154); // 6.000.000 × 0,95 ÷ 325
  near(q.rubForRef, 67523.07692307692); // 23.100.000 ÷ giá báo
});

test('sang: kết quả thực tế = VND nhận − VND bỏ ra mua USDT', () => {
  const q = quoteSang({ vndPerUsdt: 26000, rubPerUsdt: 80, vndAmount: 6_000_000, margin: 60_000 });
  const r = realizedSang({ vndAmount: 6_000_000, rubPay: q.rubPay, sellRubPerUsdt: 82, buyVndPerUsdt: 25900 });
  near(r.usdt, 213.88367729831145); // 17.538,46 ÷ 82
  near(r.vndCost, 5539587.242026267); // × 25.900
  near(r.profit, 460412.75797373336);
});

test('về: báo giá = VND/USDT ÷ RUB/USDT − lãi ÷ cỡ lô', () => {
  // 26.500 ÷ 80 = 331,25; lãi 100.000 ÷ cỡ lô 5.000 = 20 → 311,25
  const q = quoteVe({ rubPerUsdt: 80, vndPerUsdt: 26500, rubAmount: 4000, margin: 100_000 });
  near(q.base, 331.25);
  near(q.quote, 311.25);
  near(q.vndPay, 1_245_000);
  near(q.theoreticalProfit, 80_000);
  near(q.rubForRef, 74216.86746987952);
});

test('về: kết quả thực tế = VND thu về − VND trả khách', () => {
  const q = quoteVe({ rubPerUsdt: 80, vndPerUsdt: 26500, rubAmount: 4000, margin: 100_000 });
  const r = realizedVe({ rubAmount: 4000, vndPay: q.vndPay, actualRubPerUsdt: 78, actualVndPerUsdt: 26300 });
  near(r.usdt, 51.282051282051285);
  near(r.vndCollected, 1348717.9487179487);
  near(r.profit, 103717.94871794875);
});

test('evalDeal dùng tham số cỡ lô trong Cài đặt', () => {
  const deal = {
    dir: 've',
    inputs: { rubPerUsdt: 80, vndPerUsdt: 26500, rubAmount: 4000, margin: 100_000 },
    actual: { actualRubPerUsdt: 78, actualVndPerUsdt: 26300 },
  };
  near(evalDeal(deal, { lotVe: 5000 }).profit, 103717.94871794875);
  // đổi cỡ lô → giá báo đổi (không còn hằng số chôn trong công thức)
  assert.notEqual(evalDeal(deal, { lotVe: 10000 }).quote.quote, evalDeal(deal, { lotVe: 5000 }).quote.quote);
});

test('evalDeal: chưa có giá thực tế thì chưa có lãi thực', () => {
  const ev = evalDeal({ dir: 'sang', inputs: { vndPerUsdt: 26000, rubPerUsdt: 80, vndAmount: 6_000_000, margin: 60_000 }, actual: {} });
  assert.equal(ev.profit, null);
  assert.ok(ev.quote.quote > 0);
});

test('báo giá từ chối đầu vào vô lý', () => {
  assert.equal(quoteSang({ vndPerUsdt: 0, rubPerUsdt: 84 }), null);
  assert.equal(quoteSang({ vndPerUsdt: 26000, rubPerUsdt: 84, margin: 2_000_000 }), null); // lãi ≥ cỡ lô
  assert.equal(quoteVe({ rubPerUsdt: 79, vndPerUsdt: 28000, margin: 99_999_999 }), null);
});

test('lãi lý thuyết: sang = VND × lãi ÷ cỡ lô; về = RUB × lãi ÷ cỡ lô', () => {
  const s = quoteSang({ vndPerUsdt: 26000, rubPerUsdt: 80, vndAmount: 6_000_000, margin: 60_000 });
  near(s.theoreticalProfit, 300_000); // 6.000.000 × 60.000 ÷ 1.200.000
  // nếu giao dịch đúng giá gốc thì lãi thực trùng lãi lý thuyết
  const r = realizedSang({ vndAmount: 6_000_000, rubPay: s.rubPay, sellRubPerUsdt: 80, buyVndPerUsdt: 26000 });
  near(r.profit, 300_000);
  const v = quoteVe({ rubPerUsdt: 80, vndPerUsdt: 26500, rubAmount: 4000, margin: 100_000 });
  near(v.theoreticalProfit, 80_000); // 4.000 × 100.000 ÷ 5.000
});

test('suggestedProfit: ưu tiên lãi thực, không có thì lấy lãi lý thuyết', () => {
  const base = { dir: 'sang', inputs: { vndPerUsdt: 26000, rubPerUsdt: 80, vndAmount: 6_000_000, margin: 60_000 } };
  const none = suggestedProfit({ ...base, actual: {} });
  assert.equal(none.source, 'quote');
  near(none.value, 300_000);
  const real = suggestedProfit({ ...base, actual: { sellRubPerUsdt: 82, buyVndPerUsdt: 25900 } });
  assert.equal(real.source, 'real');
  assert.ok(real.value > 300_000);
  assert.equal(suggestedProfit({ dir: 'sang', inputs: {}, actual: {} }).value, null);
});
