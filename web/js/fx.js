// Nghiệp vụ đổi tiền RUB ↔ VND qua USDT: báo giá (sang / về) và lãi thực khi chốt giao dịch.
// Công thức chuyển nguyên từ các tab `sang` và `về`. Mọi tỷ giá dùng đơn vị tự nhiên
// (ví dụ 26.000 VND/USDT, 80 RUB/USDT), không phải "26,0" như trong sheet cũ.

export const DEFAULT_LOTS = { lotSang: 1200000, lotVe: 5000, refVnd: 23100000 };

const pos = (x) => Number(x) > 0;

/**
 * Chiều "sang": khách đưa VND, bên Nga nhận RUB.
 *  giá báo (VND/RUB) = (VND/USDT ÷ RUB/USDT) ÷ (1 − lãi ÷ cỡ lô)
 *  RUB phải trả      = VND ÷ giá báo
 */
export function quoteSang({ vndPerUsdt, rubPerUsdt, vndAmount, margin, lot = DEFAULT_LOTS.lotSang, refVnd = DEFAULT_LOTS.refVnd }) {
  if (!pos(vndPerUsdt) || !pos(rubPerUsdt)) return null;
  const m = Number(margin) || 0;
  const denom = 1 - m / lot;
  if (!(denom > 0)) return null;
  const base = vndPerUsdt / rubPerUsdt;
  const quote = base / denom;
  const rubPay = pos(vndAmount) ? vndAmount / quote : null;
  // lãi nếu giao dịch đúng giá gốc: VND khách đưa × (lãi ÷ cỡ lô)
  const theoreticalProfit = pos(vndAmount) ? vndAmount * (m / lot) : null;
  return { base, quote, rubPay, theoreticalProfit, rubForRef: refVnd / quote };
}

/** Kết quả thực tế chiều "sang": bán USDT lấy RUB, mua USDT bằng VND. */
export function realizedSang({ vndAmount, rubPay, sellRubPerUsdt, buyVndPerUsdt }) {
  if (!pos(rubPay) || !pos(sellRubPerUsdt) || !pos(buyVndPerUsdt)) return null;
  const usdt = rubPay / sellRubPerUsdt;
  const vndCost = usdt * buyVndPerUsdt;
  return { usdt, vndCost, profit: vndAmount - vndCost };
}

/**
 * Chiều "về": khách đưa RUB, nhận VND.
 *  giá báo (VND/RUB) = VND/USDT ÷ RUB/USDT − lãi ÷ cỡ lô
 *  VND trả khách     = giá báo × RUB nhận
 */
export function quoteVe({ rubPerUsdt, vndPerUsdt, rubAmount, margin, lot = DEFAULT_LOTS.lotVe, refVnd = DEFAULT_LOTS.refVnd }) {
  if (!pos(rubPerUsdt) || !pos(vndPerUsdt)) return null;
  const m = Number(margin) || 0;
  const base = vndPerUsdt / rubPerUsdt;
  const quote = base - m / lot;
  if (!(quote > 0)) return null;
  const vndPay = pos(rubAmount) ? quote * rubAmount : null;
  const theoreticalProfit = pos(rubAmount) ? rubAmount * base - rubAmount * quote : null;
  return { base, quote, vndPay, theoreticalProfit, rubForRef: refVnd / quote };
}

/** Kết quả thực tế chiều "về". */
export function realizedVe({ rubAmount, vndPay, actualRubPerUsdt, actualVndPerUsdt }) {
  if (!pos(rubAmount) || !pos(actualRubPerUsdt) || !pos(actualVndPerUsdt)) return null;
  const usdt = rubAmount / actualRubPerUsdt;
  const vndCollected = usdt * actualVndPerUsdt;
  return { usdt, vndCollected, profit: vndCollected - (vndPay || 0) };
}

/** Tính lại toàn bộ một lệnh đổi tiền từ dữ liệu đã nhập. */
export function evalDeal(deal, params = {}) {
  const lots = { ...DEFAULT_LOTS, ...params };
  const i = deal.inputs || {};
  const a = deal.actual || {};
  if (deal.dir === 'sang') {
    const q = quoteSang({ ...i, lot: lots.lotSang, refVnd: lots.refVnd });
    const r = q && q.rubPay != null && (a.sellRubPerUsdt || a.buyVndPerUsdt)
      ? realizedSang({ vndAmount: i.vndAmount, rubPay: q.rubPay, sellRubPerUsdt: a.sellRubPerUsdt, buyVndPerUsdt: a.buyVndPerUsdt })
      : null;
    return { quote: q, real: r, profit: r ? r.profit : null };
  }
  const q = quoteVe({ ...i, lot: lots.lotVe, refVnd: lots.refVnd });
  const r = q && q.vndPay != null && (a.actualRubPerUsdt || a.actualVndPerUsdt)
    ? realizedVe({ rubAmount: i.rubAmount, vndPay: q.vndPay, actualRubPerUsdt: a.actualRubPerUsdt, actualVndPerUsdt: a.actualVndPerUsdt })
    : null;
  return { quote: q, real: r, profit: r ? r.profit : null };
}

/** Lãi gợi ý khi chốt: lãi thực nếu đã điền giá thực tế, không thì lãi lý thuyết theo giá báo. Đơn vị VND. */
export function suggestedProfit(deal, params = {}) {
  const r = evalDeal(deal, params);
  if (r.profit != null) return { value: r.profit, source: 'real' };
  if (r.quote && r.quote.theoreticalProfit != null) return { value: r.quote.theoreticalProfit, source: 'quote' };
  return { value: null, source: null };
}
