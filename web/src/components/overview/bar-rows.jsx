import { Progress } from '@/components/ui/progress.jsx';
import { cn } from '@/lib/cn.js';

/** Danh sách "nhãn … số liệu" kèm thanh tiến độ bên dưới (ngân sách, nguồn thu). rows: [{ key, label, text, pct, over, warn }] */
export function BarRows({ rows }) {
  return (
    <div className="grid gap-3.5">
      {rows.map((r) => (
        <div key={r.key} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className={cn('tnum shrink-0 text-xs text-muted-foreground', r.over && 'font-bold text-expense')}>{r.text}</span>
          </div>
          <Progress pct={r.pct} warn={r.warn} />
        </div>
      ))}
    </div>
  );
}
