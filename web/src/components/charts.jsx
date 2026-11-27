// Biểu đồ bằng Recharts: cột thu/chi theo tháng và vòng tròn cơ cấu chi tiêu.
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtMoney } from '@logic/money.js';
import { store } from '@logic/store.js';
import { cn } from '@/lib/cn.js';

export const chartColor = (i) => `var(--chart-${(i % 8) + 1})`;

const niceTop = (max) => {
  let pow = 10 ** Math.floor(Math.log10(max));
  if (pow * 10 <= max) pow *= 10;
  return [1, 2, 3, 4, 6, 8, 10].find((k) => k * pow >= max) * pow; // nửa trục luôn là số tròn
};
const trim1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
export function tickLabel(v, cur) {
  if (v === 0) return '0';
  if (cur === 'VND') {
    if (v >= 1e9) return `${trim1(v / 1e9)} tỷ`;
    if (v >= 1e6) return `${trim1(v / 1e6)} tr`;
    if (v >= 1e3) return `${trim1(v / 1e3)}k`;
    return String(v);
  }
  if (v >= 1e6) return `${trim1(v / 1e6)}M`;
  if (v >= 1e3) return `${trim1(v / 1e3)}k`;
  return trim1(v);
}

function MonthTip({ active, payload, cur, hide }) {
  if (!active || !payload || !payload.length) return null;
  const s = payload[0].payload;
  const f = (v) => (hide ? '•••••' : fmtMoney(v, cur));
  const net = s.a - s.b;
  return (
    <div className="min-w-40 rounded-xl border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl">
      <div className="mb-1.5 text-[13px] font-bold">{s.title || s.label}</div>
      <div className="grid gap-1 text-[13px]">
        <div className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[var(--chart-2)]" /><span className="flex-1 text-muted-foreground">Thu</span><b className="tnum">{f(s.a)}</b></div>
        <div className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[var(--chart-4)]" /><span className="flex-1 text-muted-foreground">Chi</span><b className="tnum">{f(s.b)}</b></div>
        <div className="mt-0.5 flex items-center gap-2 border-t pt-1.5"><span className="flex-1 text-muted-foreground">Còn lại</span><b className={cn('tnum', net < 0 ? 'text-expense' : 'text-income')}>{hide ? '•••••' : `${net > 0 ? '+' : ''}${fmtMoney(net, cur)}`}</b></div>
      </div>
    </div>
  );
}

/** series: [{ label, title, a (thu), b (chi) }], cũ → mới. */
export function MonthlyBars({ series, cur = 'VND', height = 220 }) {
  const hide = !!store.settings().hideAmounts;
  const max = Math.max(0, ...series.flatMap((s) => [s.a, s.b]));
  const top = max > 0 ? niceTop(max) : 1;
  const [showTable, setShowTable] = useState(false);
  const f = (v) => (hide ? '•••••' : fmtMoney(v, cur));
  const fn = (v) => (hide ? '•••••' : `${v > 0 ? '+' : ''}${fmtMoney(v, cur)}`);
  return (
    <div>
      <div style={{ height }} role="img" aria-label="Biểu đồ cột thu chi theo tháng">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis width={hide ? 8 : 46} tickLine={false} axisLine={false} domain={[0, top]} ticks={[0, top / 2, top]} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(v) => (hide ? '' : tickLabel(v, cur))} />
            <Tooltip cursor={{ fill: 'var(--accent)', opacity: 0.6, radius: 8 }} content={<MonthTip cur={cur} hide={hide} />} />
            <Bar dataKey="a" fill="var(--chart-2)" radius={[6, 6, 2, 2]} maxBarSize={22} animationDuration={600} />
            <Bar dataKey="b" fill="var(--chart-4)" radius={[6, 6, 2, 2]} maxBarSize={22} animationDuration={600} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[var(--chart-2)]" />Thu</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[var(--chart-4)]" />Chi</span>
        </div>
        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? 'Ẩn bảng' : 'Xem dạng bảng'}
        </button>
      </div>
      {showTable ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-semibold">Tháng</th><th className="py-1 text-right font-semibold">Thu</th><th className="py-1 text-right font-semibold">Chi</th><th className="py-1 text-right font-semibold">Còn lại</th></tr></thead>
            <tbody>
              {[...series].reverse().map((s) => (
                <tr key={s.title || s.label} className="border-t"><td className="py-1.5">{s.title || s.label}</td><td className="tnum py-1.5 text-right">{f(s.a)}</td><td className="tnum py-1.5 text-right">{f(s.b)}</td><td className="tnum py-1.5 text-right">{fn(s.a - s.b)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** data: [{ key, name, value, color? }]. children hiển thị ở giữa vòng. */
export function CategoryDonut({ data, size = 176, children }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const rows = total > 0 ? data : [{ key: 'empty', name: '', value: 1, color: 'var(--muted)' }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label="Biểu đồ vòng cơ cấu chi tiêu">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={total > 0 && data.length > 1 ? 2.5 : 0} cornerRadius={5} stroke="none" startAngle={90} endAngle={-270} animationDuration={700}>
            {rows.map((d, i) => <Cell key={d.key || i} fill={d.color || chartColor(i)} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {children ? <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">{children}</div> : null}
    </div>
  );
}
