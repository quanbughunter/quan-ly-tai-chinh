// Danh sách lệnh đã lưu (báo giá / đã chốt), gom theo tháng, và khung "lệnh chờ cộng lãi vào thẻ".
import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Info } from 'lucide-react';
import { store } from '@logic/store.js';
import { evalDeal } from '@logic/fx.js';
import { todayStr, fmtDate, monthLabel } from '@logic/dates.js';
import { DIR_LABEL, statusOf, dealProfit, defaultProfitAccountId, pendingPost, postPending, skipPending } from '@logic/deals.js';
import { confirmBox } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg, money } from '@/lib/format.js';
import { accountOptions } from '@/lib/options.js';
import { cn } from '@/lib/cn.js';
import { Section } from '@/components/ui/card.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Select } from '@/components/ui/select.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { IconBubble, RowList } from '@/components/row.jsx';
import { openDealForm } from './deal-dialog.jsx';

const profitCls = (p) => (p >= 0 ? 'text-income' : 'text-expense');

/** Lệnh đã chốt nhưng chưa cộng lãi vào thẻ (ví dụ nhập từ sheet cũ): hỏi một lần. */
export function PendingBanner({ list, params }) {
  const total = list.reduce((s, d) => s + (dealProfit(d, params) || 0), 0);
  const opts = accountOptions({ only: (a) => a.currency === 'VND' });
  const [accountId, setAccountId] = useState(() => defaultProfitAccountId({ vndOnly: true }));
  const onPost = async () => {
    if (!(await confirmBox(`Cộng lãi của ${list.length} lệnh vào thẻ đã chọn, đúng ngày của từng lệnh?`, { okLabel: 'Cộng vào thẻ' }))) return;
    try { const n = await postPending(accountId); toast(`Đã cộng lãi của ${n} lệnh vào thẻ.`, 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const onSkip = async () => {
    if (!(await confirmBox('Không cộng các lệnh này? Dùng khi số dư thẻ của bạn đã có sẵn khoản lãi đó.', { okLabel: 'Không cộng' }))) return;
    try { await skipPending(); toast('Đã bỏ qua.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <motion.div data-testid="pending-post" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-4">
      <div className="flex items-start gap-2.5 text-[14px] font-medium">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>{`${list.length} lệnh đã chốt (lãi ${money(total, 'VND', { sign: true })}) chưa được cộng vào thẻ.`}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {opts.length ? <div className="min-w-44 flex-1 sm:max-w-64"><Select options={opts} value={accountId} onChange={setAccountId} /></div> : null}
        <Button size="sm" disabled={!opts.length} onClick={onPost}>Cộng vào thẻ</Button>
        <Button size="sm" variant="outline" onClick={onSkip}>Đã có trong số dư — bỏ qua</Button>
      </div>
    </motion.div>
  );
}

function DealRow({ d, params, i }) {
  const st = statusOf(d);
  const r = evalDeal(d, params);
  const party = d.partyId && store.byId('parties', d.partyId);
  const inp = d.inputs || {};
  const amount = d.dir === 'sang' ? money(inp.vndAmount, 'VND') : money(inp.rubAmount, 'RUB');
  const pay = r.quote ? (d.dir === 'sang' ? money(r.quote.rubPay, 'RUB') : money(r.quote.vndPay, 'VND')) : '—';
  const p = st === 'done' ? dealProfit(d, params) : null;
  const sub = [fmtDate(d.date), party ? party.name : null, d.note].filter(Boolean).join(' · ');
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }} data-testid="deal-row" data-status={st}>
      <button
        type="button"
        onClick={() => openDealForm(d)}
        className="flex w-full min-w-0 items-start gap-3 px-4 pt-3 pb-1.5 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent active:bg-accent sm:px-5"
      >
        <IconBubble tone="neutral"><span aria-hidden>{d.dir === 'sang' ? '🇻🇳' : '🇷🇺'}</span></IconBubble>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="break-words text-[15px] font-semibold leading-snug">{`${DIR_LABEL[d.dir]} · ${amount} → ${pay}`}</span>
          {sub ? <span className="break-words text-[13px] text-muted-foreground">{sub}</span> : null}
        </span>
        {st === 'done' ? <span className={cn('tnum shrink-0 pt-0.5 text-[15px] font-bold', profitCls(p))}>{money(p, 'VND', { sign: true })}</span> : null}
      </button>
      <div className="flex items-center justify-between gap-2 pb-3 pl-[4.75rem] pr-4 sm:pr-5">
        {st === 'done'
          ? (d.profitTxId ? <Badge variant="success">đã cộng vào thẻ</Badge> : d.postSkipped ? <Badge variant="muted">không cộng thẻ</Badge> : <Badge variant="warning">chưa cộng thẻ</Badge>)
          : <Badge variant="muted">báo giá</Badge>}
        {st === 'quote' ? <Button size="sm" onClick={() => openDealForm(d, { confirm: true })}><Check className="size-4" />Chốt giao dịch</Button> : null}
      </div>
    </motion.div>
  );
}

let lastFilter = 'all';

export function DealList({ params }) {
  const [filter, setFilterState] = useState(lastFilter);
  const setFilter = (v) => { lastFilter = v; setFilterState(v); };
  const deals = [...store.all('deals')];
  if (!deals.length) return <EmptyState>Chưa có lệnh nào. Tính giá cho khách ở trên, rồi lưu báo giá hoặc chốt giao dịch.</EmptyState>;

  const nQuote = deals.filter((d) => statusOf(d) === 'quote').length;
  const nDone = deals.length - nQuote;
  const shown = deals.filter((d) => filter === 'all' || statusOf(d) === filter)
    .sort((a, b) => (a.date === b.date ? (b.ts || 0) - (a.ts || 0) : a.date < b.date ? 1 : -1));
  const doneAll = deals.filter((d) => statusOf(d) === 'done');
  const total = doneAll.reduce((s, d) => s + (dealProfit(d, params) || 0), 0);
  const thisMonth = todayStr().slice(0, 7);
  const m = doneAll.filter((d) => (d.date || '').startsWith(thisMonth)).reduce((s, d) => s + (dealProfit(d, params) || 0), 0);

  const byMonth = new Map();
  for (const d of shown) {
    const k = (d.date || '').slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(d);
  }
  let idx = 0;
  return (
    <div className="grid grid-cols-1 gap-4">
      <Segmented
        aria-label="Lọc lệnh"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `Tất cả (${deals.length})` },
          { value: 'quote', label: `Chờ chốt (${nQuote})` },
          { value: 'done', label: `Đã chốt (${nDone})` },
        ]}
      />
      <p data-testid="deal-summary" className="text-center text-[13px] text-muted-foreground">
        Lãi đã chốt: tháng này <b className={cn('tnum', profitCls(m))}>{money(m, 'VND', { sign: true })}</b>
        {' · '}tất cả <b className={cn('tnum', profitCls(total))}>{money(total, 'VND', { sign: true })}</b>
      </p>
      {!shown.length ? (
        <EmptyState>{filter === 'quote' ? 'Không có báo giá nào đang chờ chốt.' : 'Chưa có lệnh nào đã chốt.'}</EmptyState>
      ) : [...byMonth.entries()].map(([k, list]) => {
        const profit = list.reduce((s, d) => s + (dealProfit(d, params) || 0), 0);
        const hasDone = list.some((d) => statusOf(d) === 'done');
        return (
          <Section
            key={k}
            title={monthLabel(k)}
            flush
            right={hasDone ? <strong className={cn('tnum text-sm', profitCls(profit))}>{`Lãi ${money(profit, 'VND', { sign: true })}`}</strong> : null}
          >
            <RowList>{list.map((d) => <DealRow key={d.id} d={d} params={params} i={idx++} />)}</RowList>
          </Section>
        );
      })}
    </div>
  );
}

export { pendingPost };
