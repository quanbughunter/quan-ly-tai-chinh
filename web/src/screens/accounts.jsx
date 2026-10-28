import { useMemo, useState } from 'react';
import { ArrowLeftRight, Banknote, Coins, CreditCard, Landmark, Pencil, PiggyBank, Plus, Scale, Smartphone, Wallet } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { money } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';
import { accountBalances } from '@logic/calc.js';
import { ACCOUNT_KINDS } from '@logic/model.js';
import { CURRENCIES } from '@logic/money.js';
import { openAccountForm, openReconcile, openTxForm } from '@/forms/index.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Section } from '@/components/ui/card.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { IconBubble, RowList } from '@/components/row.jsx';
import { Reveal, useFirstRender } from '@/components/overview/reveal.jsx';

const KIND_ICON = { cash: Banknote, bank: Landmark, card: CreditCard, ewallet: Smartphone, savings: PiggyBank, crypto: Coins };

let showArchived = false; // giữ nguyên khi chuyển màn hình rồi quay lại

function AccountRow({ account: a, balance, n }) {
  const Icon = KIND_ICON[a.kind] || Wallet;
  return (
    <div className={cn('px-4 py-3 sm:px-5', a.archived && 'opacity-60')} data-account={a.id}>
      <div className="flex items-center gap-3">
        <a href={`#/tx?account=${a.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
          <IconBubble tone={a.archived ? 'muted' : 'primary'}><Icon strokeWidth={2} /></IconBubble>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] font-semibold leading-snug">
              <span className="truncate">{a.name}</span>
              {a.networth === false ? <Badge variant="muted">không tính tài sản</Badge> : null}
              {a.archived ? <Badge variant="muted">đã ẩn</Badge> : null}
            </span>
            <span className="truncate text-[13px] text-muted-foreground">{`${ACCOUNT_KINDS[a.kind] || a.kind} · ${n} giao dịch`}</span>
          </span>
        </a>
        <span className={cn('tnum shrink-0 text-base font-extrabold', balance < 0 && 'text-expense')}>{money(balance, a.currency)}</span>
      </div>
      <div className="mt-1.5 flex justify-end gap-1">
        <Button size="sm" variant="ghost" title="Nhập số dư thực tế" onClick={() => openReconcile(a)}><Scale className="size-3.5" />Khớp số dư</Button>
        <Button size="sm" variant="ghost" onClick={() => openAccountForm(a)}><Pencil className="size-3.5" />Sửa</Button>
      </div>
    </div>
  );
}

export default function Accounts() {
  const ver = useStore();
  const first = useFirstRender();
  const [, force] = useState(0);
  const accounts = store.all('accounts');

  const { bal, counts } = useMemo(() => {
    const txs = store.all('txs');
    const c = new Map();
    for (const t of txs) {
      for (const id of [t.accountId, t.toAccountId]) if (id) c.set(id, (c.get(id) || 0) + 1);
    }
    return { bal: accountBalances(accounts, txs), counts: c };
  }, [ver]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <PageHeader
      title="Tài khoản"
      actions={(
        <>
          <Button variant="outline" onClick={() => openTxForm({ group: 'transfer' })}><ArrowLeftRight className="size-4" />Chuyển / đổi</Button>
          <Button onClick={() => openAccountForm()}><Plus className="size-4" />Thêm</Button>
        </>
      )}
    />
  );

  if (!accounts.length) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {header}
        <EmptyState icon={Wallet} action={<Button onClick={() => openAccountForm()}><Plus className="size-4" />Tạo tài khoản đầu tiên</Button>}>
          Chưa có tài khoản. Tạo thẻ ngân hàng, ví tiền mặt, ví USDT… Mỗi tài khoản có một tiền tệ riêng.
        </EmptyState>
      </div>
    );
  }

  const visible = accounts.filter((a) => showArchived || !a.archived);
  const order = [...CURRENCIES, ...new Set(visible.map((a) => a.currency).filter((c) => !CURRENCIES.includes(c)))];
  const sections = order.map((cur) => {
    const list = visible.filter((a) => a.currency === cur).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
    const total = list.filter((a) => a.networth !== false).reduce((s, a) => s + (bal.get(a.id) || 0), 0);
    return { cur, list, total };
  }).filter((x) => x.list.length);

  return (
    <div className="grid grid-cols-1 gap-4">
      {header}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {sections.map(({ cur, list, total }, i) => (
          <Reveal key={cur} enabled={first} index={i}>
            <Section title={cur} right={<b className="tnum text-base font-extrabold">{money(total, cur)}</b>} flush>
              <RowList>{list.map((a) => <AccountRow key={a.id} account={a} balance={bal.get(a.id) || 0} n={counts.get(a.id) || 0} />)}</RowList>
            </Section>
          </Reveal>
        ))}
      </div>
      {accounts.some((a) => a.archived) ? (
        <div className="flex justify-center">
          <CheckRow checked={showArchived} onChange={(v) => { showArchived = v; force((x) => x + 1); }}>Hiện tài khoản đã ẩn</CheckRow>
        </div>
      ) : null}
    </div>
  );
}
