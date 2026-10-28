// Máy tính báo giá dùng chung cho màn hình Báo tỉ giá và hộp thoại lệnh: các ô nhập + kết quả tính trực tiếp.
//  • DealInputs: các ô giá báo + khối kết quả báo giá.
//  • DealActual: các ô giá thực khi đi mua / bán USDT + tỉ giá thực, tiền đi mua USDT và lãi thực.
// Ô giá thực bỏ trống thì tạm lấy theo giá báo (ô hiện giá báo mờ làm gợi ý).
import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Coins, Sparkles } from 'lucide-react';
import { store } from '@logic/store.js';
import { evalDeal } from '@logic/fx.js';
import { fmtNum } from '@logic/money.js';
import { Field } from '@/components/ui/field.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';
import { cn } from '@/lib/cn.js';

export const FIELDS = {
  sang: {
    inputs: [
      ['vndAmount', 'Số VND khách đưa', 'VND'],
      ['vndPerUsdt', 'Giá báo: VND / USDT', ''],
      ['rubPerUsdt', 'Giá báo: RUB / USDT', ''],
      ['margin', 'Lãi mong muốn (VND mỗi lô)', 'VND'],
    ],
    // [khóa, nhãn, đơn vị, loại giá (rub / vnd), tên ngắn để nhắc trong ghi chú]
    actual: [
      ['buyVndPerUsdt', 'Giá thực: mua USDT bằng VND (VND / USDT)', '', 'vnd', 'giá mua USDT bằng VND'],
      ['sellRubPerUsdt', 'Giá thực: bán USDT lấy RUB (RUB / USDT)', '', 'rub', 'giá bán USDT lấy RUB'],
    ],
  },
  ve: {
    inputs: [
      ['rubAmount', 'Số RUB khách đưa', 'RUB'],
      ['rubPerUsdt', 'Giá báo: RUB / USDT', ''],
      ['vndPerUsdt', 'Giá báo: VND / USDT', ''],
      ['margin', 'Lãi mong muốn (VND mỗi lô)', 'VND'],
    ],
    actual: [
      ['actualRubPerUsdt', 'Giá thực: mua USDT bằng RUB (RUB / USDT)', '', 'rub', 'giá mua USDT bằng RUB'],
      ['actualVndPerUsdt', 'Giá thực: bán USDT lấy VND (VND / USDT)', '', 'vnd', 'giá bán USDT lấy VND'],
    ],
  },
};

const num = (v) => (Number.isFinite(v) && v > 0 ? v : undefined);
export const signed = (n, dec = 0) => `${n > 0 ? '+' : ''}${fmtNum(n, dec)}`;
export const amountOf = (dir, inputs) => (dir === 'sang' ? inputs.vndAmount : inputs.rubAmount);

/** Giá trị ban đầu của các ô (dạng chuỗi) từ dữ liệu đã lưu. */
export function initValues(dir, inputs = {}, actual = {}) {
  const v = {};
  for (const [k] of FIELDS[dir].inputs) v[k] = inputs[k] == null ? '' : String(inputs[k]);
  for (const [k] of FIELDS[dir].actual) v[k] = actual[k] == null ? '' : String(actual[k]);
  return v;
}

/** Chuỗi trong các ô → { inputs, actual } dạng số (ô trống / sai → undefined; lãi trống → 0). */
export function parseValues(dir, vals) {
  const o = { inputs: {}, actual: {} };
  for (const [k] of FIELDS[dir].inputs) o.inputs[k] = num(readAmount(vals[k]));
  for (const [k] of FIELDS[dir].actual) o.actual[k] = num(readAmount(vals[k]));
  const mg = readAmount(vals.margin);
  o.inputs.margin = Number.isFinite(mg) ? mg : 0;
  return o;
}

/** Giá báo mặc định cho một chiều: lấy giá của lệnh gần nhất cùng chiều + lãi mặc định trong Cài đặt. */
export function defaultsFor(dir, params) {
  const last = store.all('deals').filter((d) => d.dir === dir).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
  const margin = dir === 'sang' ? params.defaultMarginSang : params.defaultMarginVe;
  const i = last && last.inputs ? { rubPerUsdt: last.inputs.rubPerUsdt, vndPerUsdt: last.inputs.vndPerUsdt } : {};
  return { ...i, margin };
}

/** Trạng thái các ô + kết quả tính lại. */
export function useDealValues(dir, inputs, actual, params) {
  const [vals, setVals] = useState(() => initValues(dir, inputs, actual));
  const setVal = useCallback((k, t) => setVals((p) => ({ ...p, [k]: t })), []);
  const parsed = useMemo(() => parseValues(dir, vals), [dir, vals]);
  const result = evalDeal({ dir, ...parsed }, params);
  return { vals, setVal, parsed, result };
}

/** Số đổi giá trị thì nháy nhẹ một lần (nội dung đổi ngay, không chờ hiệu ứng). */
export function Flash({ children, className }) {
  return (
    <motion.span key={String(children)} initial={{ opacity: 0.35, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className={cn('inline-block', className)}>
      {children}
    </motion.span>
  );
}

/* ───────── Khối kết quả ───────── */

function quoteRows(dir, q, params) {
  const rows = [];
  if (!q) return rows;
  if (dir === 'sang') {
    rows.push({ label: 'Giá báo', value: `${fmtNum(q.quote, 2)} ₫ / RUB`, big: true });
    if (q.rubPay != null) rows.push({ label: 'RUB phải trả', value: `${fmtNum(q.rubPay, 2)} ₽`, big: true });
    rows.push({ label: `${fmtNum(params.refVnd)} ₫ tương đương`, value: `${fmtNum(q.rubForRef, 2)} ₽` });
    if (q.theoreticalProfit != null) rows.push({ label: 'Lãi dự kiến', value: `${fmtNum(q.theoreticalProfit, 0)} ₫` });
  } else {
    rows.push({ label: 'Giá báo', value: `${fmtNum(q.quote, 2)} ₫ / RUB`, big: true });
    if (q.vndPay != null) rows.push({ label: 'VND trả khách', value: `${fmtNum(q.vndPay, 0)} ₫`, big: true });
    if (q.theoreticalProfit != null) rows.push({ label: 'Lãi dự kiến', value: `${fmtNum(q.theoreticalProfit, 0)} ₫` });
  }
  return rows;
}

/** Thẻ kết quả báo giá: nền tím, số lớn. */
export function QuotePanel({ dir, quote, params }) {
  const rows = quoteRows(dir, quote, params);
  if (!rows.length) {
    return <div className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Nhập đủ giá và lãi để có giá báo.</div>;
  }
  const big = rows.filter((r) => r.big);
  const small = rows.filter((r) => !r.big);
  return (
    <div data-testid="quote-panel" className="overflow-hidden rounded-2xl bg-gradient-to-br from-hero-from to-hero-to p-4 text-white shadow-lg shadow-primary/20">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {big.map((r) => (
          <div key={r.label} className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">{r.label}</div>
            <div className="tnum mt-0.5 break-words text-2xl font-extrabold leading-tight sm:text-[26px]"><Flash>{r.value}</Flash></div>
          </div>
        ))}
      </div>
      {small.length ? (
        <div className="mt-3 grid grid-cols-1 gap-1 border-t border-white/15 pt-3 text-[13px]">
          {small.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <span className="text-white/75">{r.label}</span>
              <b className="tnum"><Flash>{r.value}</Flash></b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const toneText = (good) => (good ? 'text-income' : 'text-expense');

function Line({ label, value, tone, minor }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', minor ? 'text-[13px]' : 'text-[15px]')}>
      <span className="text-muted-foreground">{label}</span>
      <b className={cn('tnum text-right', tone)}><Flash>{value}</Flash></b>
    </div>
  );
}

/** Khối kết quả giá thực: tỉ giá thực, tiền đi mua USDT, lãi thực. */
export function RealPanel({ dir, real: R, fields }) {
  const empty = dir === 'sang'
    ? 'Nhập giá thực mua USDT bằng VND và bán USDT lấy RUB để thấy tỉ giá thực, số VND đi mua USDT và lãi thực.'
    : 'Nhập giá thực mua USDT bằng RUB và bán USDT lấy VND để thấy tỉ giá thực, số VND thu về và lãi thực.';
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!R ? (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{empty}</motion.div>
      ) : (
        <motion.div key="real" data-testid="real-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4">
          <RealBody dir={dir} R={R} fields={fields} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RealBody({ dir, R, fields }) {
  const good = (x) => x >= 0;
  const sang = dir === 'sang';
  const names = R.assumed.length ? fields.actual.filter((f) => R.assumed.includes(f[0])).map((f) => `${f[4]} (${fmtNum(R.used[f[0]], 2)})`) : [];
  return (
    <>
      <div className="grid grid-cols-1 gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-muted-foreground">Tỉ giá thực</span>
          <b className="tnum text-xl font-extrabold"><Flash>{`${fmtNum(R.realRate, 2)} ₫ / RUB`}</Flash></b>
        </div>
        <Line minor label="Chênh so với giá báo" value={`${signed(R.rateEdge, 2)} ₫ / RUB`} tone={toneText(good(R.rateEdge))} />
        <Line label={sang ? 'USDT cần mua' : 'USDT mua được'} value={`${fmtNum(R.usdt, 4)} USDT`} />
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-primary/10 px-3.5 py-3 text-primary">
        <span className="grid size-9 shrink-0 place-content-center rounded-xl bg-primary/15"><Coins className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{sang ? 'Cần mua USDT bằng' : 'Bán USDT thu về'}</div>
          <div className="tnum break-words text-[22px] font-extrabold leading-tight"><Flash>{`${fmtNum(sang ? R.vndCost : R.vndCollected, 0)} ₫`}</Flash></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <Line label={sang ? 'Khách đưa' : 'VND trả khách'} value={`${fmtNum(sang ? R.vndIn : R.vndOut, 0)} ₫`} />
      </div>

      <div className={cn('rounded-xl px-3.5 py-3', good(R.profit) ? 'bg-income/10' : 'bg-expense/10')}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            {good(R.profit) ? <ArrowUpRight className="size-4 text-income" /> : <ArrowDownRight className="size-4 text-expense" />}Lãi thực
          </span>
          <b className={cn('tnum text-2xl font-extrabold', toneText(good(R.profit)))}><Flash>{`${signed(R.profit, 0)} ₫`}</Flash></b>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sang ? '= khách đưa − tiền mua USDT' : '= VND thu về − VND trả khách'}</p>
        {R.vsQuote != null ? <div className="mt-2"><Line minor label="So với lãi dự kiến" value={`${signed(R.vsQuote, 0)} ₫`} tone={toneText(good(R.vsQuote))} /></div> : null}
      </div>

      {names.length ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Sparkles className="mt-0.5 size-3.5 shrink-0" />Chưa nhập {names.join(' và ')} → tạm lấy theo giá báo.</p>
      ) : null}
    </>
  );
}

/* ───────── Ô nhập ───────── */

function InputBlock({ title, children }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {title ? <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>{title}</span><span className="h-px flex-1 bg-border" /></div> : null}
      {children}
    </div>
  );
}

/** Bốn khối của máy tính: ô giá báo → kết quả báo giá → ô giá thực → kết quả giá thực.
 *  split: trên máy tính để bàn xếp 2 cột (ô nhập bên trái, kết quả bên phải, cùng hàng). */
export function DealBody({ dir, vals, setVal, parsed, result, params, split = false }) {
  const spec = FIELDS[dir];
  const f = spec.inputs;
  const qi = parsed.inputs;
  const one = (row) => {
    const [key, label, unit] = row;
    return (
      <Field key={key} label={label}>
        <MoneyInput value={vals[key]} onChange={(t) => setVal(key, t)} currency={unit || ''} />
      </Field>
    );
  };
  return (
    <div className={cn('grid grid-cols-1 items-start gap-x-6 gap-y-5', split && 'lg:grid-cols-2')}>
      <InputBlock title="Giá báo khách">
        {one(f[0])}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{one(f[1])}{one(f[2])}</div>
        {one(f[3])}
      </InputBlock>
      <div className={cn(split && 'lg:pt-6')}><QuotePanel dir={dir} quote={result.quote} params={params} /></div>
      <InputBlock title="Giá thực khi đi mua / bán USDT">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {spec.actual.map(([key, label, unit, kind]) => {
            const quoted = kind === 'rub' ? qi.rubPerUsdt : qi.vndPerUsdt;
            return (
              <Field key={key} label={label}>
                <MoneyInput value={vals[key]} onChange={(t) => setVal(key, t)} currency={unit || ''} placeholder={quoted ? fmtNum(quoted, 2) : '0'} />
              </Field>
            );
          })}
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">Có thể bỏ trống — lúc đó tạm lấy theo giá báo.</p>
      </InputBlock>
      <div className={cn(split && 'lg:pt-6')}><RealPanel dir={dir} real={result.real} fields={spec} /></div>
    </div>
  );
}
