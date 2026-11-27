import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, HandCoins, CornerDownLeft, Landmark, CornerUpRight, SlidersHorizontal, Circle } from 'lucide-react';
import { store } from '@logic/store.js';
import { TX_KINDS } from '@logic/model.js';
import { fmtDate } from '@logic/dates.js';
import { accAmount } from '@logic/calc.js';
import { money } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';
import { Row } from './row.jsx';

const KIND_VIEW = {
  income: { icon: ArrowDownLeft, tone: 'income' },
  expense: { icon: ArrowUpRight, tone: 'expense' },
  transfer: { icon: ArrowLeftRight, tone: 'primary' },
  lend: { icon: HandCoins, tone: 'warning' },
  repay_in: { icon: CornerDownLeft, tone: 'income' },
  borrow: { icon: Landmark, tone: 'warning' },
  repay_out: { icon: CornerUpRight, tone: 'expense' },
  adjust: { icon: SlidersHorizontal, tone: 'muted' },
};
const POSITIVE = new Set(['income', 'repay_in', 'borrow']);
const NEGATIVE = new Set(['expense', 'lend', 'repay_out']);

/** Số tiền có dấu của một giao dịch + lớp 'pos' | 'neg' | '' dùng để tô màu. */
export function signedAmount(t) {
  if (POSITIVE.has(t.kind)) return { value: t.amount, cls: 'pos' };
  if (NEGATIVE.has(t.kind)) return { value: -t.amount, cls: 'neg' };
  if (t.kind === 'adjust') return { value: t.amount, cls: t.amount >= 0 ? 'pos' : 'neg' };
  return { value: t.amount, cls: '' }; // chuyển / đổi
}

export function txTitle(t) {
  if (t.note) return t.note;
  const c = t.categoryId && store.byId('categories', t.categoryId);
  if (c) return c.name;
  const p = t.partyId && store.byId('parties', t.partyId);
  if (p) return `${TX_KINDS[t.kind]} · ${p.name}`;
  return TX_KINDS[t.kind] || t.kind;
}

export const amountClass = (cls) => (cls === 'pos' ? 'text-income' : cls === 'neg' ? 'text-expense' : 'text-foreground');

export function TxRow({ tx: t, onClick, showDate = false }) {
  const c = t.categoryId && store.byId('categories', t.categoryId);
  const a = t.accountId && store.byId('accounts', t.accountId);
  const to = t.toAccountId && store.byId('accounts', t.toAccountId);
  const p = t.partyId && store.byId('parties', t.partyId);
  const sub = [
    showDate ? fmtDate(t.date) : null,
    t.kind === 'transfer' ? `${a ? a.name : '?'} → ${to ? to.name : '?'}` : a ? a.name : null,
    c && t.note ? c.name : null,
    p && (t.note || c) ? p.name : null,
  ].filter(Boolean).join(' · ');
  const amt = signedAmount(t);
  const view = KIND_VIEW[t.kind] || { icon: Circle, tone: 'muted' };
  const Icon = view.icon;
  const extra = [];
  if (t.kind === 'transfer' && t.toAmount != null && to && to.currency !== t.currency) extra.push(`→ ${money(t.toAmount, to.currency)}`);
  // Khoản vay nợ khác tiền tệ với tài khoản: hiện thêm số tiền thật sự ra / vào tài khoản.
  if (a && t.accountAmount != null && t.accountAmount !== '' && a.currency !== t.currency && amt.cls) {
    const v = accAmount(t);
    extra.push(`${a.name}: ${money(amt.cls === 'pos' ? v : -v, a.currency, { sign: amt.cls === 'pos' })}`);
  }
  return (
    <Row
      onClick={onClick}
      tone={view.tone}
      icon={c && c.icon ? <span aria-hidden>{c.icon}</span> : <Icon strokeWidth={2.2} />}
      title={txTitle(t)}
      sub={sub}
      right={(
        <>
          <span className={cn('tnum text-[15px] font-bold', amountClass(amt.cls))}>{money(amt.value, t.currency, { sign: amt.cls === 'pos' })}</span>
          {extra.map((x) => <span key={x} className="tnum text-xs text-muted-foreground">{x}</span>)}
        </>
      )}
    />
  );
}
