import { fmtDayLong } from '@logic/dates.js';
import { Card } from '@/components/ui/card.jsx';
import { RowList } from '@/components/row.jsx';
import { TxRow } from '@/components/tx-row.jsx';
import { money } from '@/lib/format.js';
import { Reveal } from './reveal.jsx';

/** Một ngày: tiêu đề (thứ, ngày, tổng thu/chi trong ngày) + danh sách giao dịch. g = phần tử của groupByDate(). */
export function DayGroup({ group: g, onOpen, index = 0, animated = false, showExpense = true }) {
  const totals = [g.income ? `+${money(g.income, 'VND', { compact: true })}` : '', showExpense && g.expense ? `−${money(g.expense, 'VND', { compact: true })}` : ''].filter(Boolean).join('  ');
  return (
    <Reveal index={index} enabled={animated} className="grid grid-cols-1 gap-2" data-day={g.date}>
      <div className="flex items-baseline justify-between gap-3 px-1 pt-1 text-[13px]">
        <span className="font-bold text-foreground/80">{fmtDayLong(g.date)}</span>
        <span className="tnum text-xs font-medium text-muted-foreground">{totals}</span>
      </div>
      <Card className="overflow-hidden">
        <RowList>{g.items.map((t) => <TxRow key={t.id} tx={t} onClick={() => onOpen(t)} />)}</RowList>
      </Card>
    </Reveal>
  );
}
