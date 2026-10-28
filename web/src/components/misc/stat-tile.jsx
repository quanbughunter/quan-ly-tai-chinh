import { cn } from '@/lib/cn.js';

/** Ô số liệu: nhãn nhỏ phía trên, giá trị lớn phía dưới. */
export function StatTile({ label, children, className, valueClassName }) {
  return (
    <div className={cn('flex min-w-0 flex-col justify-between gap-2 rounded-2xl bg-muted/60 px-3.5 py-3', className)}>
      <div className="text-xs font-semibold leading-tight text-muted-foreground">{label}</div>
      <div className={cn('tnum text-2xl font-extrabold leading-none tracking-tight', valueClassName)}>{children}</div>
    </div>
  );
}
