import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Trash2 } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { TX_KINDS } from '@logic/model.js';
import { todayStr } from '@logic/dates.js';
import { fmtNum, impliedRate } from '@logic/money.js';
import { openDialog, useDialog, confirmBox } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg } from '@/lib/format.js';
import { lsGet, lsSet } from '@/lib/storage.js';
import { accountOptions, categoryOptions, partyOptions, currencyOptions, accById } from '@/lib/options.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field, FieldRow } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';
import { SelectWithAdd, InfoNote } from '@/components/forms/pickers.jsx';
import { DEBT_KINDS, NO_ACCOUNT_LABEL, NO_ACCOUNT_NOTE } from './constants.js';
import { openAccountForm } from './account-form.jsx';
import { openPartyForm } from './party-form.jsx';
import { openDealTxNotice, openScholarshipTxNotice } from './notices.jsx';

const GROUPS = [
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'transfer', label: 'Chuyển / đổi' },
  { value: 'debt', label: 'Vay nợ' },
  { value: 'adjust', label: 'Điều chỉnh' },
];
const groupOf = (kind) => (DEBT_KINDS.includes(kind) ? 'debt' : kind || 'expense');
const str = (v) => (v == null ? '' : String(v));

function defaultAccountId(init, t) {
  const last = lsGet('qltc:lastAccount');
  const pick = init.accountId || (t && t.accountId) || (last && accById(last) ? last : '') || (accountOptions()[0] || {}).value || '';
  return accById(pick) ? pick : '';
}

function initialState(init, t, defAcc) {
  return {
    group: t ? groupOf(t.kind) : init.group || (init.kind ? groupOf(init.kind) : 'expense'),
    debtKind: t && DEBT_KINDS.includes(t.kind) ? t.kind : (DEBT_KINDS.includes(init.kind) ? init.kind : 'lend'),
    date: t ? t.date : init.date || todayStr(),
    accountId: t ? (accById(t.accountId) ? t.accountId : '') : defAcc,
    toAccountId: t ? t.toAccountId || '' : '',
    amount: t ? str(t.amount) : '',
    toAmount: t ? str(t.toAmount) : '',
    // Tiền tệ của khoản: theo tài khoản; Vay nợ chọn riêng; khoản Chi/Thu không gắn tài khoản cũng chọn riêng.
    currency: t ? t.currency : (accById(defAcc) || {}).currency || 'VND',
    accountAmount: t ? str(t.accountAmount) : '',
    partyId: t ? t.partyId || '' : init.partyId || '',
    categoryId: t ? t.categoryId || '' : '',
    note: t ? t.note || '' : '',
  };
}

function TxForm({ init }) {
  useStore();
  const { close } = useDialog();
  const t = init.tx || null;
  const [defAcc] = useState(() => defaultAccountId(init, t));
  const [st, setSt] = useState(() => initialState(init, t, defAcc));
  const patch = (p) => setSt((s) => ({ ...s, ...p }));

  const { group } = st;
  const isDebt = group === 'debt';
  const kind = isDebt ? st.debtKind : group;
  const a = accById(st.accountId);
  const to = accById(st.toAccountId);
  const canNone = group === 'expense' || group === 'income' || isDebt;
  const noAcc = !a && (group === 'expense' || group === 'income');
  const cur = isDebt ? st.currency : a ? a.currency : st.currency;
  const cross = isDebt && !!a && a.currency !== cur; // khoản nợ khác tiền tệ với tài khoản
  const outflow = st.debtKind === 'lend' || st.debtKind === 'repay_out';

  const setGroup = (v) => setSt((s) => {
    const n = { ...s, group: v };
    if ((v === 'transfer' || v === 'adjust') && !s.accountId) n.accountId = defAcc;
    const acc = accById(n.accountId);
    if (v === 'debt' && acc) n.currency = acc.currency; // mặc định: khoản nợ cùng tiền tệ với tài khoản
    return n;
  });
  const setAccount = (v) => setSt((s) => {
    const acc = accById(v);
    return { ...s, accountId: v, currency: acc ? acc.currency : s.currency };
  });

  const amtLabel = group === 'adjust' ? 'Số tiền điều chỉnh (+ hoặc −)' : cross ? 'Số tiền ghi nợ' : 'Số tiền';
  const amtNum = readAmount(st.amount);

  let rateText = '';
  if (cross) rateText = impliedRate(amtNum, cur, readAmount(st.accountAmount), a.currency);
  let transferRate = '';
  const toCross = group === 'transfer' && to && a && to.currency !== a.currency;
  if (toCross) {
    const x = amtNum;
    const y = readAmount(st.toAmount);
    if (x > 0 && y > 0) transferRate = y / x < 1 ? `Tỷ giá ngầm: 1 ${to.currency} = ${fmtNum(x / y, 2)} ${a.currency}` : `Tỷ giá ngầm: 1 ${a.currency} = ${fmtNum(y / x, 2)} ${to.currency}`;
  }

  async function onSave() {
    const amount = amtNum;
    const debtCur = isDebt ? st.currency : null;
    if (kind === 'adjust') { if (!amount) return toast('Nhập số tiền điều chỉnh khác 0.', 'error'); } else if (!(amount > 0)) return toast('Nhập số tiền lớn hơn 0.', 'error');
    if (!st.date) return toast('Chọn ngày.', 'error');
    if (!isDebt && !canNone && !a) return toast('Chọn tài khoản.', 'error');
    if (isDebt && !st.partyId) return toast('Chọn người liên quan đến khoản vay nợ.', 'error');
    const doc = {
      id: t ? t.id : undefined, ts: t ? t.ts : undefined,
      date: st.date, kind, amount, currency: debtCur || (a ? a.currency : st.currency),
      accountId: a ? a.id : '', note: st.note.trim(),
    };
    if (debtCur && a && a.currency !== debtCur) {
      const aa = readAmount(st.accountAmount);
      if (!(aa > 0)) return toast(`Nhập số tiền ${outflow ? 'trừ khỏi' : 'cộng vào'} tài khoản (${a.currency}).`, 'error');
      doc.accountAmount = aa;
    }
    if (group === 'expense' || group === 'income') doc.categoryId = st.categoryId || '';
    if (isDebt) doc.partyId = st.partyId;
    if (group === 'transfer') {
      if (!to) return toast('Chọn tài khoản nhận.', 'error');
      if (to.id === a.id) return toast('Tài khoản nhận phải khác tài khoản gửi.', 'error');
      doc.toAccountId = to.id;
      if (to.currency !== a.currency) {
        const ta = readAmount(st.toAmount);
        if (!(ta > 0)) return toast(`Nhập số tiền nhận được (${to.currency}).`, 'error');
        doc.toAmount = ta;
      }
    }
    try {
      await store.put('txs', doc);
      if (a) lsSet('qltc:lastAccount', a.id);
      close();
      toast(t ? 'Đã cập nhật giao dịch.' : 'Đã lưu giao dịch.', 'ok');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  async function onDelete() {
    if (!(await confirmBox('Xóa giao dịch này? Số dư sẽ được tính lại.', { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('txs', t.id); close(); toast('Đã xóa.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  }

  const footer = (
    <>
      {t ? <Button variant="ghost" className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}><Trash2 />Xóa</Button> : null}
      <Button variant="ghost" onClick={close}>Hủy</Button>
      <Button type="submit"><Check />Lưu</Button>
    </>
  );

  return (
    <Modal title={t ? 'Sửa giao dịch' : 'Thêm giao dịch'} onSubmit={onSave} footer={footer}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Segmented options={GROUPS} value={group} onChange={setGroup} aria-label="Loại giao dịch" className="[&_button]:px-2 [&_button]:text-[12.5px] sm:[&_button]:px-3 sm:[&_button]:text-[13px]" />

        {isDebt ? (
          <>
            <Field label="Loại">
              <Select options={DEBT_KINDS.map((k) => ({ value: k, label: TX_KINDS[k] }))} value={st.debtKind} onChange={(v) => patch({ debtKind: v })} />
            </Field>
            <Field label="Người">
              <SelectWithAdd options={partyOptions()} value={st.partyId} onChange={(v) => patch({ partyId: v })} addLabel="Người mới" onAdd={() => openPartyForm({ onSaved: (p) => patch({ partyId: p.id }) })} />
            </Field>
          </>
        ) : null}

        <FieldRow>
          <Field label="Ngày"><Input type="date" value={st.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
          <Field label={group === 'transfer' ? 'Từ tài khoản' : 'Tài khoản'}>
            <SelectWithAdd
              options={accountOptions({ none: canNone ? NO_ACCOUNT_LABEL : null })}
              value={st.accountId}
              onChange={setAccount}
              placeholder="Chọn tài khoản"
              addLabel="Tài khoản mới"
              onAdd={() => openAccountForm(null, { onSaved: (d) => patch({ accountId: d.id, currency: d.currency }) })}
            />
          </Field>
        </FieldRow>

        <AnimatePresence initial={false}>
          {noAcc ? (
            <motion.div key="noacc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="-mt-2 overflow-hidden">
              <InfoNote tone="primary">{NO_ACCOUNT_NOTE}</InfoNote>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {group === 'transfer' ? (
          <Field label="Sang tài khoản">
            <SelectWithAdd
              options={accountOptions({ none: '— Chọn —' })}
              value={st.toAccountId}
              onChange={(v) => patch({ toAccountId: v })}
              addLabel="Tài khoản mới"
              onAdd={() => openAccountForm(null, { onSaved: (d) => patch({ toAccountId: d.id }) })}
            />
          </Field>
        ) : null}

        {isDebt || noAcc ? (
          <Field
            label={isDebt ? 'Tiền tệ khoản nợ' : 'Tiền tệ'}
            hint={isDebt && a && a.currency !== cur ? `Khác tiền tệ của tài khoản (${a.currency}) — nhập thêm số tiền thực ra / vào tài khoản bên dưới.` : null}
          >
            <Select options={currencyOptions} value={st.currency} onChange={(v) => patch({ currency: v })} />
          </Field>
        ) : null}

        <Field label={`${amtLabel}${cur && (a || isDebt || noAcc) ? ` (${cur})` : ''}`} hint="Gõ được: 25k, 1,5tr, 3tr+500k">
          <MoneyInput value={st.amount} onChange={(v) => patch({ amount: v })} currency={cur} />
        </Field>

        {cross ? (
          <div className="grid gap-1.5">
            <Field label={`${outflow ? 'Trừ khỏi' : 'Cộng vào'} ${a.name} (${a.currency})`} hint="Số tiền thực tế đi ra / đi vào tài khoản này.">
              <MoneyInput value={st.accountAmount} onChange={(v) => patch({ accountAmount: v })} currency={a.currency} />
            </Field>
            {rateText ? <p className="tnum text-xs text-muted-foreground">Tỷ giá ngầm: {rateText}</p> : null}
          </div>
        ) : null}

        {toCross ? (
          <div className="grid gap-1.5">
            <Field label={`Số nhận được (${to.currency})`}>
              <MoneyInput value={st.toAmount} onChange={(v) => patch({ toAmount: v })} currency={to.currency} />
            </Field>
            {transferRate ? <p className="tnum text-xs text-muted-foreground">{transferRate}</p> : null}
          </div>
        ) : null}

        {group === 'expense' || group === 'income' ? (
          <Field label="Danh mục">
            <Select options={categoryOptions(group)} value={st.categoryId} onChange={(v) => patch({ categoryId: v })} />
          </Field>
        ) : null}

        <Field label="Ghi chú">
          <Input value={st.note} placeholder="Ví dụ: ăn trưa, tiền nhà…" onChange={(e) => patch({ note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/** init: { tx?, group?, kind?, partyId?, accountId?, date? } */
export function openTxForm(init = {}) {
  const t = init.tx || null;
  if (t && t.dealId) return openDealTxNotice(t);
  if (t && t.scholarshipId) return openScholarshipTxNotice(t);
  if (!store.all('accounts').length && (init.group === 'transfer' || init.group === 'adjust')) {
    // Chuyển / điều chỉnh cần tài khoản: mở form tạo tài khoản ngay, lưu xong quay lại form giao dịch.
    toast('Chưa có tài khoản nào — tạo tài khoản đầu tiên nhé.');
    openAccountForm(null, { onSaved: () => openTxForm(init) });
    return null;
  }
  return openDialog(() => <TxForm init={init} />);
}
