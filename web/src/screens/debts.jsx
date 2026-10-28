import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight, ChevronLeft, HandCoins, Pencil, Plus, UserPlus } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { money } from '@/lib/format.js';
import { debtBalances, lastDebtDates, DEBT_SIGN } from '@logic/calc.js';
import { fmtDate, daysBetween, todayStr } from '@logic/dates.js';
import { roundTo } from '@logic/money.js';
import { openTxForm, openPartyForm } from '@/forms/index.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, Section } from '@/components/ui/card.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { CurrencyChips } from '@/components/currency-chips.jsx';
import { RowList } from '@/components/row.jsx';
import { TxRow } from '@/components/tx-row.jsx';
import { LinkRow } from '@/components/overview/link-row.jsx';
import { Avatar } from '@/components/overview/avatar.jsx';
import { Reveal, useFirstRender } from '@/components/overview/reveal.jsx';

let showSettled = false; // giữ nguyên khi chuyển màn hình rồi quay lại

export default function Debts({ params = {} }) {
  return params.id ? <PartyDetail id={params.id} /> : <DebtList />;
}

function DebtList() {
  const ver = useStore();
  const first = useFirstRender();
  const [, force] = useState(0);

  const { rows, owedToMe, iOwe } = useMemo(() => {
    const txs = store.all('txs');
    const debts = debtBalances(txs);
    const last = lastDebtDates(txs);
    const parties = store.all('parties').filter((p) => (p.role || 'person') === 'person' || p.role === 'family' || debts.has(p.id));
    const list = parties.map((p) => ({ p, o: debts.get(p.id) || {}, d: last.get(p.id) }))
      .filter((x) => showSettled || Object.values(x.o).some((v) => Math.abs(v) > 1e-9))
      .sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    // Tổng theo tiền tệ
    const owed = {};
    const owe = {};
    for (const o of debts.values()) {
      for (const [c, v] of Object.entries(o)) {
        if (v > 0) owed[c] = roundTo((owed[c] || 0) + v, 6);
        else if (v < 0) owe[c] = roundTo((owe[c] || 0) - v, 6);
      }
    }
    return { rows: list, owedToMe: owed, iOwe: owe };
  }, [ver, showSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Vay nợ"
        actions={(
          <>
            <Button variant="outline" onClick={() => openPartyForm()}><UserPlus className="size-4" />Người mới</Button>
            <Button onClick={() => openTxForm({ group: 'debt', kind: 'lend' })}><Plus className="size-4" />Khoản vay nợ</Button>
          </>
        )}
      />

      <Reveal enabled={first} index={0}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground"><span className="grid size-6 place-content-center rounded-lg bg-income/12 text-income"><ArrowDownLeft className="size-3.5" /></span>Người khác nợ mình</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5"><CurrencyChips values={owedToMe} /></div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground"><span className="grid size-6 place-content-center rounded-lg bg-expense/12 text-expense"><ArrowUpRight className="size-3.5" /></span>Mình nợ người khác</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5"><CurrencyChips values={iOwe} /></div>
          </Card>
        </div>
      </Reveal>

      {!rows.length ? (
        <EmptyState icon={HandCoins}>Chưa có khoản vay nợ nào đang mở.</EmptyState>
      ) : (
        <Reveal enabled={first} index={1}>
          <Card className="overflow-hidden">
            <RowList>
              {rows.map(({ p, o, d }) => {
                const age = d ? daysBetween(d, todayStr()) : null;
                return (
                  <LinkRow
                    key={p.id}
                    href={`#/debts/${p.id}`}
                    icon={<Avatar name={p.name} />}
                    title={p.name}
                    sub={d ? `Gần nhất ${fmtDate(d)}${age > 30 ? ` · ${age} ngày trước` : ''}` : 'Chưa có giao dịch'}
                    right={<CurrencyChips values={o} signed />}
                  />
                );
              })}
            </RowList>
          </Card>
        </Reveal>
      )}

      <div className="flex justify-center">
        <CheckRow checked={showSettled} onChange={(v) => { showSettled = v; force((x) => x + 1); }}>Hiện cả người đã tất toán</CheckRow>
      </div>
    </div>
  );
}

const ACTIONS = [
  { kind: 'lend', label: 'Cho vay thêm', icon: ArrowUpRight },
  { kind: 'repay_in', label: 'Nhận trả', icon: ArrowDownLeft },
  { kind: 'borrow', label: 'Đi vay', icon: ArrowDownRight },
  { kind: 'repay_out', label: 'Trả nợ', icon: ArrowUpLeft },
];

function PartyDetail({ id }) {
  const ver = useStore();
  const first = useFirstRender();
  const p = store.byId('parties', id);

  const { withRun, run } = useMemo(() => {
    const list = store.all('txs').filter((t) => t.partyId === id && DEBT_SIGN[t.kind])
      .sort((a, b) => (a.date === b.date ? (a.ts || 0) - (b.ts || 0) : a.date < b.date ? -1 : 1));
    const acc = {};
    const out = list.map((t) => {
      acc[t.currency] = roundTo((acc[t.currency] || 0) + DEBT_SIGN[t.kind] * t.amount, 6);
      return { t, run: { ...acc } };
    });
    return { withRun: out, run: acc };
  }, [ver, id]);

  const back = <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground"><a href="#/debts"><ChevronLeft className="size-4" />Quay lại</a></Button>;

  if (!p) {
    return (
      <div className="grid grid-cols-1 gap-4">
        <PageHeader title="Vay nợ" />
        <EmptyState icon={HandCoins} action={<Button asChild variant="outline"><a href="#/debts"><ChevronLeft className="size-4" />Quay lại</a></Button>}>Không tìm thấy người này.</EmptyState>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title={p.name}
        back={back}
        actions={<Button variant="outline" onClick={() => openPartyForm(p, { onDeleted: () => { location.hash = '#/debts'; } })}><Pencil className="size-4" />Sửa</Button>}
      />

      <Reveal enabled={first} index={0}>
        <Section title="Số dư hiện tại">
          <div className="flex flex-wrap gap-2 [&_[data-slot=badge]]:px-3.5 [&_[data-slot=badge]]:py-1 [&_[data-slot=badge]]:text-base [&_[data-slot=badge]]:font-extrabold"><CurrencyChips values={run} signed /></div>
          <p className="mt-2.5 text-[13px] text-muted-foreground">Dương: người này nợ mình. Âm: mình nợ người này. Tính riêng từng tiền tệ.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACTIONS.map(({ kind, label, icon: Icon }) => (
              <Button key={kind} variant="outline" onClick={() => openTxForm({ group: 'debt', kind, partyId: id })}><Icon className="size-4" />{label}</Button>
            ))}
          </div>
        </Section>
      </Reveal>

      {!withRun.length ? (
        <EmptyState>Chưa có giao dịch với người này.</EmptyState>
      ) : (
        <Reveal enabled={first} index={1}>
          <Section title="Lịch sử" flush>
            <RowList>
              {[...withRun].reverse().map(({ t, run: r }) => (
                <div key={t.id}>
                  <TxRow tx={t} showDate onClick={() => openTxForm({ tx: t })} />
                  <div className="tnum -mt-1.5 pb-2.5 pl-[4.5rem] pr-4 text-xs text-muted-foreground sm:pl-[4.75rem]">{`Số dư sau: ${money(r[t.currency], t.currency, { sign: true })}`}</div>
                </div>
              ))}
            </RowList>
          </Section>
        </Reveal>
      )}
    </div>
  );
}
