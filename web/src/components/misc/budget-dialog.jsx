import { useState } from 'react';
import { store } from '@/lib/store-hooks.js';
import { errMsg } from '@/lib/format.js';
import { categoryOptions, currencyOptions } from '@/lib/options.js';
import { openDialog, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { Field, FieldRow } from '@/components/ui/field.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Modal } from '@/components/ui/modal.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';
import { FormFooter } from './form-footer.jsx';

function BudgetForm({ b }) {
  const { close } = useDialog();
  const [categoryId, setCategoryId] = useState(b ? b.categoryId || '' : '');
  const [currency, setCurrency] = useState(b ? b.currency || 'VND' : 'VND');
  const [amount, setAmount] = useState(b && b.amount != null ? String(b.amount) : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = readAmount(amount);
    if (!(v > 0)) return toast('Nhập hạn mức lớn hơn 0.', 'error');
    if (store.all('budgets').some((x) => x.id !== (b && b.id) && (x.categoryId || '') === categoryId)) return toast('Danh mục này đã có ngân sách — bấm vào dòng đó để sửa.', 'error');
    setSaving(true);
    try { await store.put('budgets', { ...(b || {}), categoryId, amount: v, currency }); close(); toast('Đã lưu.', 'ok'); } catch (e) { setSaving(false); toast(errMsg(e), 'error'); }
  };

  const remove = async () => {
    try { await store.del('budgets', b.id); close(); toast('Đã xóa.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <Modal title={b ? 'Sửa ngân sách' : 'Thêm ngân sách'} onSubmit={save} footer={<FormFooter onDelete={b ? remove : null} onCancel={close} saving={saving} />}>
      <div className="grid gap-4">
        <Field label="Danh mục"><Select options={categoryOptions('expense', 'Tổng chi mọi danh mục')} value={categoryId} onChange={setCategoryId} /></Field>
        <FieldRow>
          <Field label="Hạn mức mỗi tháng"><MoneyInput value={amount} onChange={setAmount} currency={currency} /></Field>
          <Field label="Tiền tệ"><Select options={currencyOptions} value={currency} onChange={setCurrency} /></Field>
        </FieldRow>
      </div>
    </Modal>
  );
}

export const openBudget = (b) => openDialog(() => <BudgetForm b={b} />);
