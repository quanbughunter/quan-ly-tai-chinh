import { TriangleAlert } from 'lucide-react';
import { money } from '@/lib/format.js';
import { AnimatedMoney } from './animated-money.jsx';

function Mini({ label, children, neg }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/12 px-2.5 py-2.5 backdrop-blur-sm min-[400px]:px-3">
      <div className="text-[11px] font-medium leading-tight text-white/70 min-[400px]:text-[11.5px]">{label}</div>
      <div className={`tnum mt-0.5 truncate text-[15px] font-bold ${neg ? 'text-rose-200' : 'text-white'}`}>{children}</div>
    </div>
  );
}

/** Thẻ nổi bật: tổng tài sản ròng quy ra ₫ + tiền thật / cho vay / nợ + số dư theo từng tiền tệ. */
export function NetWorthCard({ ov }) {
  const b = ov.base;
  const cash = Object.entries(ov.cash).filter(([, v]) => Math.abs(v) > 1e-9);
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-hero-from to-hero-to p-5 text-white shadow-xl shadow-primary/25 sm:p-6" aria-label="Tổng tài sản">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 size-64 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 -z-10 size-56 rounded-full bg-[oklch(0.78_0.14_330)]/25 blur-3xl" />
      <div className="text-[13px] font-semibold text-white/75">Tổng tài sản ròng (quy ra ₫)</div>
      <div className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight sm:text-5xl">
        <AnimatedMoney className="tnum" value={b.net} opts={{ compact: true }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="Tiền thật">{money(b.cash, 'VND', { compact: true })}</Mini>
        <Mini label="Đang cho vay">{money(b.receivable, 'VND', { compact: true })}</Mini>
        <Mini label="Đang nợ" neg>{money(b.payable, 'VND', { compact: true })}</Mini>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {cash.length ? cash.map(([cur, v]) => (
          <span key={cur} className={`tnum rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold ${v < 0 ? 'text-rose-200' : 'text-white'}`}>{money(v, cur)}</span>
        )) : <span className="tnum rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">0</span>}
        {ov.missing.length ? (
          <a href="#/settings" className="inline-flex items-center gap-1 rounded-full bg-amber-300/90 px-2.5 py-0.5 text-xs font-bold text-amber-950">
            <TriangleAlert className="size-3" />Thiếu tỷ giá {ov.missing.join(', ')} — chỉnh trong Cài đặt
          </a>
        ) : null}
      </div>
    </section>
  );
}
