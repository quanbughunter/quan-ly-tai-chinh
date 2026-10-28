import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, FileCheck, Plus } from 'lucide-react';
import { roundTo } from '@logic/money.js';
import { todayStr, fmtDate } from '@logic/dates.js';
import { store, useStore } from '@/lib/store-hooks.js';
import { money, errMsg } from '@/lib/format.js';
import { currencyOptions } from '@/lib/options.js';
import { openDialog, confirmBox, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { Field, FieldRow } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';
import { Modal } from '@/components/ui/modal.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';
import { IconBubble } from '@/components/row.jsx';
import { CurrencyChips } from '@/components/currency-chips.jsx';
import { FormFooter } from '@/components/misc/form-footer.jsx';

/* ───────── Hộp thoại thêm / sửa ───────── */
function DormForm({ d }) {
  const { close } = useDialog();
  const isNew = !d;
  const [paidDate, setPaidDate] = useState(d ? d.paidDate : todayStr());
  const [currency, setCurrency] = useState(d ? d.currency || 'RUB' : 'RUB');
  const [amount, setAmount] = useState(d && d.amount != null ? String(d.amount) : '');
  const [period, setPeriod] = useState(d ? d.period || '' : '');
  const [payer, setPayer] = useState(d ? d.payer || '' : '');
  const [receiptSent, setReceiptSent] = useState(d ? !!d.receiptSent : false);
  const [note, setNote] = useState(d ? d.note || '' : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = readAmount(amount);
    if (!(v > 0)) return toast('Nhập số tiền lớn hơn 0.', 'error');
    setSaving(true);
    try {
      await store.put('dorm', { ...(d || {}), paidDate, currency, receiptSent, amount: v, note: note.trim(), payer: payer.trim(), period: period.trim() });
      close();
      toast('Đã lưu.', 'ok');
    } catch (e) { setSaving(false); toast(errMsg(e), 'error'); }
  };

  const remove = async () => {
    if (!(await confirmBox('Xóa khoản này?', { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('dorm', d.id); close(); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <Modal
      title={isNew ? 'Thêm khoản KTX' : 'Sửa khoản KTX'}
      onSubmit={save}
      footer={<FormFooter onDelete={isNew ? null : remove} onCancel={close} saving={saving} />}
    >
      <div className="grid gap-4">
        <Field label="Ngày đóng"><Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></Field>
        <FieldRow>
          <Field label="Số tiền"><MoneyInput value={amount} onChange={setAmount} currency={currency} /></Field>
          <Field label="Tiền tệ"><Select options={currencyOptions} value={currency} onChange={setCurrency} /></Field>
        </FieldRow>
        <Field label="Kỳ / mục đích"><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ví dụ: tháng 11/2025 hoặc 12/2025–3/2026" /></Field>
        <Field label="Tài khoản thanh toán / người đóng"><Input value={payer} onChange={(e) => setPayer(e.target.value)} /></Field>
        <CheckRow checked={receiptSent} onChange={setReceiptSent}>Đã gửi chứng từ (check)</CheckRow>
        <Field label="Ghi chú"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

const openForm = (d) => openDialog(() => <DormForm d={d} />);

/* ───────── Màn hình ───────── */
export default function Dorm() {
  const ver = useStore();
  const { list, totals, pending } = useMemo(() => {
    const items = [...store.all('dorm')].sort((a, b) => (a.paidDate === b.paidDate ? (b.ts || 0) - (a.ts || 0) : (a.paidDate || '') < (b.paidDate || '') ? 1 : -1));
    const sums = {};
    for (const d of items) sums[d.currency || 'RUB'] = roundTo((sums[d.currency || 'RUB'] || 0) + (Number(d.amount) || 0), 6);
    return { list: items, totals: sums, pending: items.filter((d) => !d.receiptSent) };
  }, [ver]);

  const toggleReceipt = async (d, checked) => {
    try { await store.put('dorm', { ...d, receiptSent: checked }); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="grid gap-4">
      <PageHeader title="Tiền KTX" actions={<Button onClick={() => openForm(null)}><Plus />Thêm khoản</Button>} />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:pt-5">
          <div className="grid gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Đã đóng (tổng)</span>
            <div className="flex flex-wrap gap-1.5"><CurrencyChips values={totals} /></div>
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Chưa gửi chứng từ</span>
            <div className="flex flex-wrap gap-1.5"><Badge variant={pending.length ? 'warning' : 'success'}>{pending.length} khoản</Badge></div>
          </div>
        </CardContent>
      </Card>

      {!list.length ? (
        <Card><EmptyState icon={Building2}>Chưa có khoản KTX nào.</EmptyState></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/70">
            {list.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.22 }} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <button type="button" onClick={() => openForm(d)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
                  <IconBubble tone={d.receiptSent ? 'income' : 'warning'}>{d.receiptSent ? <FileCheck strokeWidth={2} /> : <Building2 strokeWidth={2} />}</IconBubble>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{`${d.period || 'Khoản KTX'} · ${money(d.amount, d.currency || 'RUB')}`}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{[fmtDate(d.paidDate), d.payer, d.note].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                <CheckRow checked={!!d.receiptSent} onChange={(v) => toggleReceipt(d, v)} className="shrink-0 text-[13px] font-medium text-muted-foreground">
                  <span className="hidden sm:inline">Đã gửi check</span><span className="sm:hidden">Đã gửi</span>
                </CheckRow>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
