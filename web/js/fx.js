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

/**
 * Kết quả thực tế chiều "sang": mua USDT bằng VND, bán USDT lấy RUB trả bên Nga.
 *  USDT cần mua  = RUB phải trả ÷ giá bán thực (RUB/USDT)
 *  VND đi mua    = USDT × giá mua thực (VND/USDT)
 *  lãi thực      = VND khách đưa − VND đi mua USDT
 *  tỉ giá thực   = VND đi mua ÷ RUB phải trả (VND/RUB) — để so với giá báo
 */
export function realizedSang({ vndAmount, rubPay, sellRubPerUsdt, buyVndPerUsdt }) {
  if (!pos(rubPay) || !pos(sellRubPerUsdt) || !pos(buyVndPerUsdt)) return null;
  const usdt = rubPay / sellRubPerUsdt;
  const vndCost = usdt * buyVndPerUsdt;
  return { usdt, vndCost, vndIn: Number(vndAmount) || 0, realRate: buyVndPerUsdt / sellRubPerUsdt, profit: (Number(vndAmount) || 0) - vndCost };
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

/**
 * Kết quả thực tế chiều "về": dùng RUB khách đưa mua USDT, bán USDT lấy VND trả khách.
 *  USDT mua được = RUB khách đưa ÷ giá mua thực (RUB/USDT)
 *  VND thu về    = USDT × giá bán thực (VND/USDT)
 *  lãi thực      = VND thu về − VND trả khách
 *  tỉ giá thực   = giá bán thực ÷ giá mua thực (VND/RUB)
 */
export function realizedVe({ rubAmount, vndPay, actualRubPerUsdt, actualVndPerUsdt }) {
  if (!pos(rubAmount) || !pos(actualRubPerUsdt) || !pos(actualVndPerUsdt)) return null;
  const usdt = rubAmount / actualRubPerUsdt;
  const vndCollected = usdt * actualVndPerUsdt;
  return { usdt, vndCollected, vndOut: vndPay || 0, realRate: actualVndPerUsdt / actualRubPerUsdt, profit: vndCollected - (vndPay || 0) };
}

/**
 * Tính lại toàn bộ một lệnh đổi tiền từ dữ liệu đã nhập.
 * Giá thực chỉ điền một ô thì ô còn lại tạm lấy theo giá báo (real.assumed ghi lại ô nào bị thay thế).
 * real.rateEdge = giá báo − tỉ giá thực (sang) hoặc tỉ giá thực − giá báo (về): dương là có lợi cho mình.
 * real.vsQuote  = lãi thực − lãi dự kiến theo giá báo.
 */
export function evalDeal(deal, params = {}) {
  const lots = { ...DEFAULT_LOTS, ...params };
  const i = deal.inputs || {};
  const a = deal.actual || {};
  const dir = deal.dir === 'sang' ? 'sang' : 've';
  // hai ô giá thực: một ô tính bằng RUB/USDT, một ô bằng VND/USDT; ô bỏ trống tạm lấy theo giá báo cùng loại
  const rubKey = dir === 'sang' ? 'sellRubPerUsdt' : 'actualRubPerUsdt';
  const vndKey = dir === 'sang' ? 'buyVndPerUsdt' : 'actualVndPerUsdt';
  const fallback = { [rubKey]: i.rubPerUsdt, [vndKey]: i.vndPerUsdt };
  const q = dir === 'sang'
    ? quoteSang({ ...i, lot: lots.lotSang, refVnd: lots.refVnd })
    : quoteVe({ ...i, lot: lots.lotVe, refVnd: lots.refVnd });
  const amountReady = q && (dir === 'sang' ? q.rubPay != null : q.vndPay != null);
  let r = null;
  if (amountReady && (pos(a[rubKey]) || pos(a[vndKey]))) {
    const rub = pos(a[rubKey]) ? Number(a[rubKey]) : Number(fallback[rubKey]);
    const vnd = pos(a[vndKey]) ? Number(a[vndKey]) : Number(fallback[vndKey]);
    r = dir === 'sang'
      ? realizedSang({ vndAmount: i.vndAmount, rubPay: q.rubPay, sellRubPerUsdt: rub, buyVndPerUsdt: vnd })
      : realizedVe({ rubAmount: i.rubAmount, vndPay: q.vndPay, actualRubPerUsdt: rub, actualVndPerUsdt: vnd });
    if (r) {
      r.assumed = [rubKey, vndKey].filter((k) => !pos(a[k]));
      r.used = { [rubKey]: rub, [vndKey]: vnd };
      r.rateEdge = dir === 'sang' ? q.quote - r.realRate : r.realRate - q.quote;
      r.vsQuote = q.theoreticalProfit != null ? r.profit - q.theoreticalProfit : null;
    }
  }
  return { quote: q, real: r, profit: r ? r.profit : null };
}

/** Lãi gợi ý khi chốt: lãi thực nếu đã điền giá thực tế, không thì lãi lý thuyết theo giá báo. Đơn vị VND. */
export function suggestedProfit(deal, params = {}) {
  const r = evalDeal(deal, params);
  if (r.profit != null) return { value: r.profit, source: 'real' };
  if (r.quote && r.quote.theoreticalProfit != null) return { value: r.quote.theoreticalProfit, source: 'quote' };
  return { value: null, source: null };
}
