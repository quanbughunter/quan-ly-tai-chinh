import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, GraduationCap, Hourglass, Plus } from 'lucide-react';
import { todayStr, fmtDate, daysBetween, monthLabel } from '@logic/dates.js';
import {
  SCHOLARSHIP_NAME, SCHOLARSHIP_CURRENCY, isReceived, scholarshipAmount, defaultScholarshipAccountId,
  saveScholarship, removeScholarship, newScholarshipId, takeOpenScholarshipRequest,
} from '@logic/scholarship.js';
import { store, useStore } from '@/lib/store-hooks.js';
import { money, errMsg, fmtNum, fmtMoney } from '@/lib/format.js';
import { accountOptions, accById } from '@/lib/options.js';
import { openDialog, confirmBox, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { cn } from '@/lib/cn.js';
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
import { Row, RowList } from '@/components/row.jsx';
import { FormFooter } from '@/components/misc/form-footer.jsx';
import { StatTile } from '@/components/misc/stat-tile.jsx';

/* ───────── Hộp thoại thêm / sửa tháng ───────── */
function ScholarshipForm({ x }) {
  const { close } = useDialog();
  const isNew = !x;
  const params = store.settings().params;
  const linkedTx = x && x.txId ? store.byId('txs', x.txId) : null;

  const [month, setMonth] = useState(x ? x.month : todayStr().slice(0, 7));
  const [availableDate, setAvailableDate] = useState(x ? x.availableDate || '' : '');
  const [received, setReceived] = useState(x ? isReceived(x) : false);
  const [receivedDate, setReceivedDate] = useState(x ? x.receivedDate || '' : '');
  const [note, setNote] = useState(x ? x.note || '' : '');
  // '' = không cộng vào thẻ nào. Tháng mới hoặc đang chờ (sắp tick “đã nhận”): chọn sẵn thẻ dùng lần trước.
  // Tháng đã nhận từ trước mà chưa có khoản cộng (nhập từ sheet cũ, số dư thẻ đã tính sẵn): mặc định không cộng.
  const [accountId, setAccountId] = useState(linkedTx ? linkedTx.accountId : (x && isReceived(x) ? '' : defaultScholarshipAccountId()));
  const [amount, setAmount] = useState(x && x.amount != null ? String(x.amount) : String(scholarshipAmount(params)));
  const [saving, setSaving] = useState(false);

  const cardOpts = accountOptions({
    includeArchived: true,
    only: (a) => a.currency === SCHOLARSHIP_CURRENCY && a.kind !== 'savings' && (!a.archived || a.id === accountId),
  });
  const accOptions = [{ value: '', label: '— Không cộng vào thẻ nào —' }, ...cardOpts];

  const v = readAmount(amount);
  let hint = '';
  if (received) {
    if (!accountId) hint = linkedTx ? 'Bỏ chọn thẻ sẽ xóa khoản đã cộng trước đây khỏi số dư thẻ.' : 'Không ghi khoản thu nào — dùng khi số dư thẻ đã tính sẵn học bổng này.';
    else hint = `Số dư thẻ sẽ tăng ${Number.isFinite(v) && v > 0 ? fmtMoney(v, SCHOLARSHIP_CURRENCY) : 'đúng số tiền nhận'}. App tự ghi khoản thu này — đừng thêm lại ở mục Giao dịch.`;
  }

  const onReceivedChange = (checked) => {
    setReceived(checked);
    if (checked && !receivedDate) setReceivedDate(todayStr());
  };

  const save = async () => {
    if (!month) return toast('Chọn tháng.', 'error');
    if (received && !receivedDate) return toast('Chọn ngày thực nhận.', 'error');
    const doc = { ...(x || {}), id: x ? x.id : newScholarshipId(), month, currency: SCHOLARSHIP_CURRENCY, note: note.trim() };
    for (const [k, val] of Object.entries({ availableDate, receivedDate: received ? receivedDate : '', note: doc.note })) {
      if (val) doc[k] = val; else delete doc[k];
    }
    if (Number.isFinite(v) && v > 0) doc.amount = v; else delete doc.amount;
    const post = received && !!accountId;
    setSaving(true);
    try {
      await saveScholarship(doc, { post, accountId });
      if (post && accountId !== params.scholarshipAccountId) {
        try { await store.saveSettings({ params: { scholarshipAccountId: accountId } }); } catch { /* chỉ để nhớ lựa chọn, bỏ qua */ }
      }
      close();
      const acc = post ? accById(accountId) : null;
      toast(post ? `Đã lưu. +${fmtMoney(v, SCHOLARSHIP_CURRENCY)} vào ${acc ? acc.name : 'thẻ'}.` : 'Đã lưu.', 'ok');
    } catch (e) { setSaving(false); toast(errMsg(e), 'error'); }
  };

  const remove = async () => {
    const msg = linkedTx
      ? `Xóa tháng này? Khoản ${fmtMoney(linkedTx.amount, linkedTx.currency)} đã cộng vào thẻ cũng sẽ bị xóa khỏi số dư.`
      : 'Xóa tháng này?';
    if (!(await confirmBox(msg, { okLabel: 'Xóa', danger: true }))) return;
    try { await removeScholarship(x.id); close(); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <Modal
      title={isNew ? `Thêm tháng — ${SCHOLARSHIP_NAME}` : `Sửa tháng — ${SCHOLARSHIP_NAME}`}
      onSubmit={save}
      footer={<FormFooter onDelete={isNew ? null : remove} onCancel={close} saving={saving} />}
    >
      <div className="grid gap-4">
        <Field label="Tháng"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Field label="Ngày học bổng “có”" hint="Ngày trên hệ thống báo học bổng đã có — để theo dõi thường chậm bao lâu.">
          <Input type="date" value={availableDate} onChange={(e) => setAvailableDate(e.target.value)} />
        </Field>
        <CheckRow checked={received} onChange={onReceivedChange}>Đã nhận học bổng tháng này</CheckRow>
        <AnimatePresence initial={false}>
          {received ? (
            <motion.div key="recv" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="-m-1 overflow-hidden p-1">
              <div className="grid gap-4 rounded-2xl border bg-muted/40 p-3.5">
                <FieldRow>
                  <Field label="Ngày thực nhận"><Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} /></Field>
                  <Field label="Số tiền nhận (₽)"><MoneyInput value={amount} onChange={setAmount} currency={SCHOLARSHIP_CURRENCY} /></Field>
                </FieldRow>
                <Field label="Cộng vào thẻ" hint={hint}><Select options={accOptions} value={accountId} onChange={setAccountId} /></Field>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <Field label="Ghi chú"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

const openForm = (x) => openDialog(() => <ScholarshipForm x={x} />);

/* ───────── Màn hình ───────── */
export default function Scholarship() {
  const ver = useStore();

  // Mở tháng theo yêu cầu từ màn hình Giao dịch (bấm vào khoản học bổng tự động).
  useEffect(() => {
    const rq = takeOpenScholarshipRequest();
    if (!rq) return;
    const x = store.byId('scholarships', rq);
    if (x) openForm(x);
  }, []);

  const view = useMemo(() => {
    const list = [...store.all('scholarships')].sort((a, b) => ((b.month || '') > (a.month || '') ? 1 : -1));
    const delays = list.filter((x) => x.availableDate && x.receivedDate).map((x) => daysBetween(x.availableDate, x.receivedDate));
    const waiting = list.filter((x) => !isReceived(x));
    const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
    const posted = list.filter((x) => x.txId && store.byId('txs', x.txId));
    const postedTotal = posted.reduce((s, x) => s + (Number(store.byId('txs', x.txId).amount) || 0), 0);
    return { list, waiting, avg, posted, postedTotal };
  }, [ver]);
  const { list, waiting, avg, posted, postedTotal } = view;

  return (
    <div className="grid gap-4">
      <PageHeader
        title={SCHOLARSHIP_NAME}
        actions={<Button onClick={() => openForm(null)}><Plus />Thêm tháng</Button>}
      />

      <Card>
        <CardContent className="grid gap-3 pt-4 sm:pt-5">
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile label="Tháng đã nhận">{list.length - waiting.length}</StatTile>
            <StatTile label="Đang chờ" valueClassName={waiting.length ? 'text-expense' : ''}>{waiting.length}</StatTile>
            <StatTile label="Chậm TB (ngày)">{avg == null ? '—' : fmtNum(avg, 1)}</StatTile>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {`Mỗi tháng: ${money(scholarshipAmount(store.settings().params), SCHOLARSHIP_CURRENCY)}`}
            {posted.length ? ` · Đã cộng vào thẻ: ${money(postedTotal, SCHOLARSHIP_CURRENCY)} (${posted.length} tháng)` : ''}
          </p>
        </CardContent>
      </Card>

      {!list.length ? (
        <Card><EmptyState icon={GraduationCap}>Chưa có tháng nào. Bấm “Thêm tháng”, tick “Đã nhận” và chọn thẻ để cộng học bổng vào số dư.</EmptyState></Card>
      ) : (
        <Card className="overflow-hidden">
          <RowList>
            {list.map((x, i) => {
              const delay = x.availableDate && x.receivedDate ? daysBetween(x.availableDate, x.receivedDate) : null;
              const tx = x.txId ? store.byId('txs', x.txId) : null;
              const acc = tx ? accById(tx.accountId) : null;
              return (
                <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.22 }}>
                  <Row
                    onClick={() => openForm(x)}
                    tone={x.receivedDate ? 'income' : 'warning'}
                    icon={x.receivedDate ? <CircleCheck strokeWidth={2.2} /> : <Hourglass strokeWidth={2.2} />}
                    title={monthLabel(x.month || '0000-00')}
                    right={x.amount ? <span className="tnum text-[15px] font-bold text-income">{money(x.amount, x.currency || SCHOLARSHIP_CURRENCY)}</span> : null}
                  >
                    <span className="text-[13px] leading-snug text-muted-foreground">{`Có: ${x.availableDate ? fmtDate(x.availableDate) : '—'} · Nhận: ${x.receivedDate ? fmtDate(x.receivedDate) : 'chưa nhận'}`}</span>
                    {acc || delay != null ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {acc ? <Badge variant="success">{`→ ${acc.name}`}</Badge> : null}
                        {delay != null ? <Badge variant={delay > 3 ? 'warning' : 'success'} className={cn(delay > 3 && 'font-bold')}>{delay > 0 ? `+${delay} ngày` : 'đúng hạn'}</Badge> : null}
                      </span>
                    ) : null}
                  </Row>
                </motion.div>
              );
            })}
          </RowList>
        </Card>
      )}
    </div>
  );
}
