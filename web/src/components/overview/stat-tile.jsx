import { cn } from '@/lib/cn.js';

const TONE = { pos: 'text-income', neg: 'text-expense', warn: 'text-warning-foreground', '': '' };

/** Ô số liệu nhỏ: nhãn xám + số lớn. tone: 'pos' | 'neg' | ''. */
export function StatTile({ label, children, tone = '', className, sub }) {
  return (
    <div className={cn('min-w-0 rounded-2xl bg-muted/60 px-3 py-3 sm:px-3.5', className)}>
      <div className="text-xs font-medium leading-tight text-muted-foreground">{label}</div>
      <div className={cn('tnum mt-1 truncate text-[15px] font-extrabold leading-tight tracking-tight min-[400px]:text-[17px] sm:text-lg', TONE[tone])}>{children}</div>
      {sub ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function StatGrid({ children, className, cols = 3 }) {
  return <div className={cn('grid gap-2', cols === 3 ? 'grid-cols-3' : 'grid-cols-2', className)}>{children}</div>;
}
