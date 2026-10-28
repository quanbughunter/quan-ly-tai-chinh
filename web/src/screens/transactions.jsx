import { useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { money } from '@/lib/format.js';
import { accountOptions, categoryOptions } from '@/lib/options.js';
import { filterTxs, groupByDate, toBase } from '@logic/calc.js';
import { todayStr, addMonths, monthRange } from '@logic/dates.js';
import { TX_KINDS } from '@logic/model.js';
import { openTxForm } from '@/forms/index.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select } from '@/components/ui/select.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { MonthNav } from '@/components/overview/month-nav.jsx';
import { StatTile, StatGrid } from '@/components/overview/stat-tile.jsx';
import { DayGroup } from '@/components/overview/day-group.jsx';
import { FilterSearch } from '@/components/overview/filter-search.jsx';
import { useFilters } from '@/components/overview/use-filters.js';
import { useFirstRender } from '@/components/overview/reveal.jsx';

// Bộ lọc giữ nguyên khi chuyển màn hình rồi quay lại.
const F = { month: todayStr().slice(0, 7), all: false, accountId: '', categoryId: '', kind: '', q: '' };

const kindOptions = [{ value: '', label: 'Mọi loại' }, ...Object.entries(TX_KINDS).map(([value, label]) => ({ value, label }))];

export default function Transactions({ params = {} }) {
  const ver = useStore();
  const first = useFirstRender();
  const [, set] = useFilters(F);
  // #/tx?account=<id> (bấm vào tên tài khoản): lọc theo tài khoản đó, mọi thời gian — áp dụng một lần mỗi khi tham số đổi.
  const applied = useRef(undefined);
  if (params.account !== undefined && applied.current !== params.account) {
    applied.current = params.account;
    F.accountId = params.account;
    F.all = true;
  }
  const rates = store.settings().rates;

  const { items, inc, exp, groups } = useMemo(() => {
    const range = F.all ? {} : monthRange(F.month);
    const list = filterTxs(store.all('txs'), { ...range, accountId: F.accountId, categoryId: F.categoryId, kind: F.kind, q: F.q });
    let i = 0;
    let e = 0;
    for (const t of list) {
      const v = toBase(t.amount, t.currency, rates) ?? 0;
      if (t.kind === 'income') i += v;
      else if (t.kind === 'expense') e += v;
    }
    return { items: list, inc: i, exp: e, groups: groupByDate(list, rates) };
  }, [ver, F.month, F.all, F.accountId, F.categoryId, F.kind, F.q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader title="Giao dịch" actions={<Button onClick={() => openTxForm()}><Plus className="size-4" />Thêm</Button>} />

      <MonthNav month={F.month} all={F.all} onPrev={() => set({ month: addMonths(F.month, -1) })} onNext={() => set({ month: addMonths(F.month, 1) })} onAll={(all) => set({ all })} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1"><FilterSearch value={F.q} onChange={(q) => set({ q })} /></div>
        <Select aria-label="Tài khoản" options={[{ value: '', label: 'Mọi tài khoản' }, ...accountOptions({ includeArchived: true })]} value={F.accountId} onChange={(v) => set({ accountId: v })} />
        <Select aria-label="Danh mục" options={categoryOptions(null, 'Mọi danh mục')} value={F.categoryId} onChange={(v) => set({ categoryId: v })} />
        <div className="col-span-2 lg:col-span-1"><Select aria-label="Loại giao dịch" options={kindOptions} value={F.kind} onChange={(v) => set({ kind: v })} /></div>
      </div>

      <StatGrid>
        <StatTile label="Thu" tone="pos">{money(inc, 'VND', { compact: true })}</StatTile>
        <StatTile label="Chi" tone="neg">{money(exp, 'VND', { compact: true })}</StatTile>
        <StatTile label="Chênh" tone={inc - exp >= 0 ? 'pos' : 'neg'}>{money(inc - exp, 'VND', { compact: true, sign: true })}</StatTile>
      </StatGrid>

      {!items.length ? (
        <EmptyState>Không có giao dịch nào khớp bộ lọc.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {groups.map((g, i) => <DayGroup key={g.date} group={g} index={i} animated={first && i < 6} onOpen={(t) => openTxForm({ tx: t })} />)}
        </div>
      )}
    </div>
  );
}
