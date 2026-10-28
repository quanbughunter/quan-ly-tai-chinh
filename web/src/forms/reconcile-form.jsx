import { useState } from 'react';
import { Check } from 'lucide-react';
import { store } from '@/lib/store-hooks.js';
import { fmtMoney } from '@logic/money.js';
import { todayStr } from '@logic/dates.js';
import { accountBalances } from '@logic/calc.js';
import { openDialog, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg, money } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';

/** Nhập số dư thực tế → tạo giao dịch "Điều chỉnh" cho đúng phần chênh. */
function ReconcileForm({ account: a }) {
  const { close } = useDialog();
  const [bal] = useState(() => accountBalances(store.all('accounts'), store.all('txs')).get(a.id) || 0);
  const [text, setText] = useState(() => String(bal));
  const v = readAmount(text);
  const diff = Number.isNaN(v) ? null : v - bal;

  async function onSave() {
    if (Number.isNaN(v)) return toast('Nhập số dư thực tế.', 'error');
    const d = v - bal;
    if (d === 0) { close(); return toast('Số dư đã khớp.', 'ok'); }
    try {
      await store.put('txs', { date: todayStr(), kind: 'adjust', amount: d, currency: a.currency, accountId: a.id, note: 'Điều chỉnh số dư' });
      close();
      return toast('Đã điều chỉnh.', 'ok');
    } catch (e) { return toast(errMsg(e), 'error'); }
  }

  return (
    <Modal
      title={`Điều chỉnh số dư — ${a.name}`}
      size="sm"
      onSubmit={onSave}
      footer={(
        <>
          <Button variant="ghost" onClick={close}>Hủy</Button>
          <Button type="submit"><Check />Điều chỉnh</Button>
        </>
      )}
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
          <span className="text-sm text-muted-foreground">Số dư theo sổ</span>
          <strong className="tnum text-base">{money(bal, a.currency)}</strong>
        </div>
        <Field label={`Số dư thực tế (${a.currency})`} hint="Nhập số bạn thấy trong ngân hàng / ví. App tạo một giao dịch “Điều chỉnh” cho phần chênh.">
          <MoneyInput value={text} onChange={setText} currency={a.currency} />
        </Field>
        {diff != null ? (
          <p className={cn('tnum rounded-xl px-3 py-2 text-sm font-semibold', diff === 0 ? 'bg-income/12 text-income' : 'bg-warning/15 text-warning-foreground')}>
            Chênh lệch: {fmtMoney(diff, a.currency, { sign: true })}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export function openReconcile(account) {
  return openDialog(() => <ReconcileForm account={account} />);
}
