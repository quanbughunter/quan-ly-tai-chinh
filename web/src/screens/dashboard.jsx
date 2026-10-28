import { useMemo, useState } from 'react';
import { Eye, EyeOff, PenLine, Plus, Upload, FlaskConical, Wallet as WalletIcon } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { money, fmtPct, errMsg, fmtNum, hidden } from '@/lib/format.js';
import { toast } from '@/lib/toast.js';
import { overview, periodStats, monthlySeries, budgetStatus } from '@logic/calc.js';
import { statusOf, dealProfit } from '@logic/deals.js';
import { todayStr, monthLabel, monthRange } from '@logic/dates.js';
import { seedDemo } from '@logic/demo.js';
import { openQuickAdd, openAccountForm } from '@/forms/index.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Section } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { MonthlyBars, CategoryDonut, chartColor } from '@/components/charts.jsx';
import { CurrencyChips } from '@/components/currency-chips.jsx';
import { RowList } from '@/components/row.jsx';
import { NetWorthCard } from '@/components/overview/net-worth-card.jsx';
import { StatTile, StatGrid } from '@/components/overview/stat-tile.jsx';
import { BarRows } from '@/components/overview/bar-rows.jsx';
import { LinkRow } from '@/components/overview/link-row.jsx';
import { Avatar } from '@/components/overview/avatar.jsx';
import { Reveal, useFirstRender } from '@/components/overview/reveal.jsx';

const MoreLink = ({ href, children }) => <a className="text-[13px] font-semibold text-primary hover:underline" href={href}>{children}</a>;

function QuickBar() {
  const [text, setText] = useState('');
  return (
    <form
      className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 pl-3.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25"
      onSubmit={(e) => { e.preventDefault(); openQuickAdd(text); setText(''); }}
    >
      <PenLine className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nhập nhanh: cafe 25k, ăn trưa 45k, +lương 10tr…"
        aria-label="Nhập nhanh"
        className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
      />
      <Button type="submit" size="sm" className="h-9 px-4">Thêm</Button>
    </form>
  );
}

function EyeButton({ hidden }) {
  const label = hidden ? 'Hiện số dư' : 'Ẩn số dư';
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={hidden}
      onClick={() => store.saveSettings({ hideAmounts: !hidden }).catch((e) => toast(errMsg(e), 'error'))}
    >
      {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </Button>
  );
}

function Onboarding() {
  return (
    <Section title="Bắt đầu">
      <EmptyState
        icon={WalletIcon}
        action={(
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Button onClick={() => openAccountForm()}><Plus className="size-4" />Tạo tài khoản</Button>
            <Button variant="outline" onClick={() => { location.hash = '#/settings'; }}><Upload className="size-4" />Nhập dữ liệu từ file</Button>
            {store.mode === 'local' ? (
              <Button variant="ghost" onClick={async () => { try { await seedDemo(); toast('Đã tạo dữ liệu mẫu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); } }}>
                <FlaskConical className="size-4" />Tạo dữ liệu mẫu
              </Button>
            ) : null}
          </div>
        )}
      >
        Chưa có tài khoản nào. Hãy tạo tài khoản đầu tiên (ví dụ: Thẻ MB, Tiền mặt).
      </EmptyState>
    </Section>
  );
}

/** Lãi trong ô hẹp: >= 1 triệu rút gọn "tr", từ 100 nghìn rút gọn "k" (ô rộng ~70px trên điện thoại), còn lại ghi đủ. */
function shortProfit(v) {
  if (hidden()) return '•••••';
  const a = Math.abs(v);
  if (a >= 1e5 && a < 1e6) return `${v > 0 ? '+' : '−'}${fmtNum(a / 1e3, 1)}k ₫`;
  return money(v, 'VND', { compact: true, sign: true });
}

export default function Dashboard() {
  const ver = useStore();
  const first = useFirstRender();
  const s = store.settings();
  const rates = s.rates;
  const accounts = store.all('accounts');
  const month = todayStr().slice(0, 7);

  const data = useMemo(() => {
    const txs = store.all('txs');
    if (!accounts.length) return null;
    const ov = overview({ accounts, txs, rates });
    const st = periodStats(txs, monthRange(month), rates);
    const series = monthlySeries(txs, month, 6, rates);
    return { ov, st, series };
  }, [ver, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = <PageHeader title="Tổng quan" actions={<EyeButton hidden={!!s.hideAmounts} />} />;
  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {header}
        <QuickBar />
        <Onboarding />
      </div>
    );
  }
  const { ov, st, series } = data;

  // Cơ cấu chi tháng này
  const top = st.cats.slice(0, 6);
  const other = st.cats.slice(6).reduce((x, c) => x + c.amount, 0);
  const slices = top.map((c, i) => {
    const cat = c.categoryId !== '_none' ? store.byId('categories', c.categoryId) : null;
    return { key: c.categoryId, name: cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Chưa phân loại', value: c.amount, color: chartColor(i) };
  });
  if (other > 0) slices.push({ key: '_other', name: 'Khác', value: other, color: 'var(--chart-8)' });
  const sliceTotal = slices.reduce((x, d) => x + d.value, 0);

  // Ngân sách
  const budgets = store.all('budgets');
  const bs = budgets.length ? budgetStatus(budgets, st.cats, rates).sort((x, y) => y.pct - x.pct).slice(0, 5) : [];

  // Công nợ
  const debtRows = [...ov.debts.entries()].map(([pid, o]) => ({ party: store.byId('parties', pid), o }))
    .filter((x) => x.party && Object.values(x.o).some((v) => Math.abs(v) > 1e-9))
    .sort((x, y) => Math.max(...Object.values(y.o).map(Math.abs)) - Math.max(...Object.values(x.o).map(Math.abs)))
    .slice(0, 5);

  // Lãi đổi tiền tháng này (chỉ tính các lệnh đã chốt)
  const allDeals = store.all('deals');
  const deals = allDeals.filter((d) => statusOf(d) === 'done' && (d.date || '').startsWith(month));
  const waiting = allDeals.filter((d) => statusOf(d) === 'quote').length;
  const profit = deals.reduce((sum, d) => sum + (dealProfit(d, s.params) || 0), 0);

  const chartSeries = series.map((x) => ({ label: `T${Number(x.month.slice(5))}`, title: monthLabel(x.month), a: x.income, b: x.expense }));

  return (
    <div className="grid grid-cols-1 gap-4">
      {header}
      <Reveal enabled={first} index={0}><NetWorthCard ov={ov} /></Reveal>
      <Reveal enabled={first} index={1}><QuickBar /></Reveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid grid-cols-1 gap-4">
          <Reveal enabled={first} index={2}>
            <Section title={monthLabel(month)} right={<span className="flex gap-3"><MoreLink href="#/income">Thu nhập ›</MoreLink><MoreLink href="#/tx">Giao dịch ›</MoreLink></span>}>
              <StatGrid>
                <StatTile label="Thu" tone="pos">{money(st.income, 'VND', { compact: true })}</StatTile>
                <StatTile label="Chi" tone="neg">{money(st.expense, 'VND', { compact: true })}</StatTile>
                <StatTile label="Còn lại" tone={st.net >= 0 ? 'pos' : 'neg'}>{money(st.net, 'VND', { compact: true, sign: true })}</StatTile>
              </StatGrid>
              {slices.length ? (
                <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
                  <CategoryDonut data={slices}>
                    <span className="text-[11px] font-medium text-muted-foreground">Tổng chi</span>
                    <span className="tnum text-base font-extrabold">{money(sliceTotal, 'VND', { compact: true })}</span>
                  </CategoryDonut>
                  <ul className="grid w-full min-w-0 flex-1 gap-2">
                    {slices.map((d) => (
                      <li key={d.key} className="flex items-center gap-2.5 text-[13.5px]">
                        <i className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                        <span className="min-w-0 flex-1 truncate">{d.name}</span>
                        <b className="tnum shrink-0 font-bold">{money(d.value, 'VND', { compact: true })}</b>
                        <span className="tnum w-9 shrink-0 text-right text-xs text-muted-foreground">{sliceTotal > 0 ? fmtPct(d.value / sliceTotal) : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <EmptyState className="py-6">Tháng này chưa có khoản chi nào.</EmptyState>}
            </Section>
          </Reveal>

          <Reveal enabled={first} index={3}>
            <Section title="6 tháng gần nhất"><MonthlyBars series={chartSeries} cur={s.baseCurrency} /></Section>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {bs.length ? (
            <Reveal enabled={first} index={3}>
              <Section title="Ngân sách tháng" right={<MoreLink href="#/settings">Chỉnh ›</MoreLink>}>
                <BarRows rows={bs.map((x) => {
                  const cat = x.budget.categoryId ? store.byId('categories', x.budget.categoryId) : null;
                  return {
                    key: x.budget.id || x.budget.categoryId || 'all',
                    label: cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Tổng chi',
                    text: `${money(x.spent, 'VND', { compact: true })} / ${money(x.limit, 'VND', { compact: true })} · ${fmtPct(x.pct)}`,
                    pct: x.pct,
                    over: x.pct > 1,
                  };
                })}
                />
              </Section>
            </Reveal>
          ) : null}

          {debtRows.length ? (
            <Reveal enabled={first} index={4}>
              <Section title="Công nợ" right={<MoreLink href="#/debts">Tất cả ›</MoreLink>} flush>
                <RowList>
                  {debtRows.map((x) => (
                    <LinkRow key={x.party.id} href={`#/debts/${x.party.id}`} icon={<Avatar name={x.party.name} tone="primary" />} title={x.party.name} right={<CurrencyChips values={x.o} signed />} />
                  ))}
                </RowList>
              </Section>
            </Reveal>
          ) : null}

          {deals.length || waiting ? (
            <Reveal enabled={first} index={5}>
              <Section title="Báo tỉ giá tháng này" right={<MoreLink href="#/fx">Mở ›</MoreLink>}>
                <StatGrid>
                  <StatTile label="Đã chốt">{String(deals.length)}</StatTile>
                  <StatTile label="Lãi" tone={profit >= 0 ? 'pos' : 'neg'}>{shortProfit(profit)}</StatTile>
                  <StatTile label="Chờ chốt">{String(waiting)}</StatTile>
                </StatGrid>
              </Section>
            </Reveal>
          ) : null}
        </div>
      </div>
    </div>
  );
}
