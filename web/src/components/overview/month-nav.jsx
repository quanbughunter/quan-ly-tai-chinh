import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel } from '@logic/dates.js';
import { Button } from '@/components/ui/button.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';

/** Thanh chọn tháng (‹ Tháng 10/2026 ›) + ô "Tất cả thời gian". */
export function MonthNav({ month, all, onPrev, onNext, onAll }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="inline-flex items-center gap-1 rounded-2xl border bg-card p-1 shadow-xs">
        <Button variant="ghost" size="icon-sm" aria-label="Tháng trước" disabled={all} onClick={onPrev}><ChevronLeft className="size-5" /></Button>
        <strong className="min-w-36 px-1 text-center text-[15px] font-bold">{all ? 'Tất cả thời gian' : monthLabel(month)}</strong>
        <Button variant="ghost" size="icon-sm" aria-label="Tháng sau" disabled={all} onClick={onNext}><ChevronRight className="size-5" /></Button>
      </div>
      <CheckRow checked={all} onChange={onAll} className="text-sm font-medium">Tất cả thời gian</CheckRow>
    </div>
  );
}
