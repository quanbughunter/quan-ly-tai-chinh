// Thu nhập: mọi khoản tiền mình kiếm được (lương, học bổng, lãi đổi tiền…) ở một chỗ.
// Chỉ lấy giao dịch kind "income" của MỌI tài khoản; nhận trả nợ / đi vay không phải thu nhập nên không có ở đây.
import { useMemo } from 'react';
import { Plus, TriangleAlert } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { money, fmtPct } from '@/lib/format.js';
import { accountOptions, categoryOptions } from '@/lib/options.js';
import { filterTxs, groupByDate, incomeStats } from '@logic/calc.js';
import { todayStr, addMonths, monthRange } from '@logic/dates.js';
import { openTxForm, openQuickAdd } from '@/forms/index.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Section } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { CurrencyChips } from '@/components/currency-chips.jsx';
import { MonthNav } from '@/components/overview/month-nav.jsx';
import { StatTile, StatGrid } from '@/components/overview/stat-tile.jsx';
import { DayGroup } from '@/components/overview/day-group.jsx';
import { BarRows } from '@/components/overview/bar-rows.jsx';
import { useFilters } from '@/components/overview/use-filters.js';
import { useFirstRender } from '@/components/overview/reveal.jsx';

// Bộ lọc giữ nguyên khi chuyển màn hình rồi quay lại.
const F = { month: todayStr().slice(0, 7), all: false, accountId: '', categoryId: '' };

export default function Income() {
  const ver = useStore();
  const first = useFirstRender();
  const [, set] = useFilters(F);
  const rates = store.settings().rates;

  const { stats, items, groups } = useMemo(() => {
    const range = F.all ? {} : monthRange(F.month);
    const q = { ...range, accountId: F.accountId, categoryId: F.categoryId };
    const txs = store.all('txs');
    const list = filterTxs(txs, { ...q, kind: 'income' });
    return { stats: incomeStats(txs, q, rates), items: list, groups: groupByDate(list, rates) };
  }, [ver, F.month, F.all, F.accountId, F.categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = Object.keys(stats.byCur);
  const showCur = cur.length > 1 || (cur.length === 1 && cur[0] !== 'VND');
  const showSources = stats.cats.length > 1 || (stats.cats.length === 1 && !F.categoryId);

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader title="Thu nhập" actions={<Button onClick={() => openQuickAdd('', { income: true })}><Plus className="size-4" />Thêm khoản thu</Button>} />

      <MonthNav month={F.month} all={F.all} onPrev={() => set({ month: addMonths(F.month, -1) })} onNext={() => set({ month: addMonths(F.month, 1) })} onAll={(all) => set({ all })} />

      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Tài khoản" options={[{ value: '', label: 'Mọi tài khoản' }, ...accountOptions({ includeArchived: true })]} value={F.accountId} onChange={(v) => set({ accountId: v })} />
        <Select aria-label="Nguồn thu" options={categoryOptions('income', 'Mọi nguồn thu')} value={F.categoryId} onChange={(v) => set({ categoryId: v })} />
      </div>

      <StatGrid>
        <StatTile label="Tổng thu" tone="pos">{money(stats.total, 'VND', { compact: true })}</StatTile>
        <StatTile label="Số khoản">{String(stats.count)}</StatTile>
        <StatTile label="Trung bình / khoản">{money(stats.count ? stats.total / stats.count : 0, 'VND', { compact: true })}</StatTile>
      </StatGrid>

      {showCur || stats.missing.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {showCur ? <CurrencyChips values={stats.byCur} /> : null}
          {stats.missing.length ? (
            <a href="#/settings" className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
              <TriangleAlert className="size-3" />Thiếu tỷ giá {stats.missing.join(', ')} — chưa tính vào tổng
            </a>
          ) : null}
        </div>
      ) : null}

      {showSources ? (
        <Section title="Theo nguồn thu">
          <BarRows rows={stats.cats.map((c) => {
            const cat = c.categoryId !== '_none' ? store.byId('categories', c.categoryId) : null;
            const pct = stats.total > 0 ? c.amount / stats.total : 0;
            return {
              key: c.categoryId,
              label: cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Chưa phân loại',
              text: `${money(c.amount, 'VND', { compact: true })} · ${fmtPct(pct)}`,
              pct,
              warn: 2,
            };
          })}
          />
        </Section>
      ) : null}

      {!items.length ? (
        <EmptyState>{F.all ? 'Chưa có khoản thu nào.' : 'Tháng này chưa có khoản thu nào. Bấm “Thêm khoản thu” để ghi lương, học bổng, tiền làm thêm…'}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {groups.map((g, i) => <DayGroup key={g.date} group={g} index={i} animated={first && i < 6} showExpense={false} onOpen={(t) => openTxForm({ tx: t })} />)}
        </div>
      )}
    </div>
  );
}
