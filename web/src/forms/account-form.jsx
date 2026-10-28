import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { store } from '@/lib/store-hooks.js';
import { ACCOUNT_KINDS } from '@logic/model.js';
import { openDialog, useDialog, confirmBox } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg } from '@/lib/format.js';
import { currencyOptions } from '@/lib/options.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field, FieldRow } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';

function AccountForm({ account: a, onSaved }) {
  const { close } = useDialog();
  const used = a ? store.all('txs').some((t) => t.accountId === a.id || t.toAccountId === a.id) : false;
  const [st, setSt] = useState(() => ({
    name: a ? a.name : '', kind: a ? a.kind : 'bank', currency: a ? a.currency : 'VND',
    networth: a ? a.networth !== false : true, archived: a ? !!a.archived : false,
    opening: a && a.opening ? String(a.opening) : '',
  }));
  const patch = (p) => setSt((s) => ({ ...s, ...p }));

  async function onSave() {
    if (!st.name.trim()) return toast('Nhập tên tài khoản.', 'error');
    const op = readAmount(st.opening);
    try {
      const d = await store.put('accounts', {
        ...(a || {}), name: st.name.trim(), kind: st.kind, currency: st.currency,
        opening: Number.isNaN(op) ? 0 : op, networth: st.networth, archived: st.archived,
      });
      close();
      toast('Đã lưu tài khoản.', 'ok');
      if (onSaved) onSaved(d);
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  async function onDelete() {
    if (!(await confirmBox(`Xóa tài khoản “${a.name}”?`, { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('accounts', a.id); close(); toast('Đã xóa tài khoản.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  }

  return (
    <Modal
      title={a ? 'Sửa tài khoản' : 'Thêm tài khoản'}
      onSubmit={onSave}
      footer={(
        <>
          {a && !used ? <Button variant="ghost" className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}><Trash2 />Xóa</Button> : null}
          <Button variant="ghost" onClick={close}>Hủy</Button>
          <Button type="submit"><Check />Lưu</Button>
        </>
      )}
    >
      <div className="grid gap-4">
        <Field label="Tên tài khoản">
          <Input value={st.name} placeholder="Ví dụ: Thẻ MB, Gazprom…" onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <FieldRow>
          <Field label="Loại">
            <Select options={Object.entries(ACCOUNT_KINDS).map(([value, label]) => ({ value, label }))} value={st.kind} onChange={(v) => patch({ kind: v })} />
          </Field>
          <Field label="Tiền tệ" hint={used ? 'Đã có giao dịch nên không đổi được tiền tệ.' : null}>
            <Select options={currencyOptions} value={st.currency} onChange={(v) => patch({ currency: v })} disabled={used} />
          </Field>
        </FieldRow>
        <Field label="Số dư đầu kỳ" hint="Số dư ghi nhận trước giao dịch đầu tiên. Số dư hiện tại luôn được tính từ đây + giao dịch.">
          <MoneyInput value={st.opening} onChange={(v) => patch({ opening: v })} currency={st.currency} />
        </Field>
        <div className="grid gap-3 rounded-2xl bg-muted/60 p-3.5">
          <CheckRow checked={st.networth} onChange={(v) => patch({ networth: v })}>Tính vào tổng tài sản</CheckRow>
          <CheckRow checked={st.archived} onChange={(v) => patch({ archived: v })}>Ẩn (lưu trữ) tài khoản này</CheckRow>
        </div>
      </div>
    </Modal>
  );
}

export function openAccountForm(account = null, { onSaved } = {}) {
  return openDialog(() => <AccountForm account={account} onSaved={onSaved} />);
}
