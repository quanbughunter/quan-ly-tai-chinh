import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Calculator, Save, Undo2 } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { todayStr } from '@logic/dates.js';
import { parseExpr, roundCur, toEditable } from '@logic/money.js';
import { buildQuickDocs, itemOk, HOME_NAME } from '@logic/quicksave.js';
import { openDialog, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg } from '@/lib/format.js';
import { lsGet, lsSet } from '@/lib/storage.js';
import { accountOptions, partyById, accById } from '@/lib/options.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field, FieldRow } from '@/components/ui/field.jsx';
import { Input, Textarea } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { CalcPad } from '@/components/ui/calc-pad.jsx';
import { MoneyInput } from '@/components/ui/money-input.jsx';
import { InfoNote } from '@/components/forms/pickers.jsx';
import { QuickItem, QuickErrorRow } from '@/components/forms/quick-item.jsx';
import { buildItems, catByName, homeKey, settleItem, schEntryOf, schProblemOf, SHARE_PEOPLE_KEY } from '@/components/forms/quick-helpers.js';
import { saveScholarshipEntry } from '@logic/scholarship.js';
import { NO_ACCOUNT_LABEL, NO_ACCOUNT_NOTE } from './constants.js';

const nameOf = (id) => (partyById(id) || {}).name || '?';

function QuickAdd({ initialText, income }) {
  useStore();
  const { close } = useDialog();
  const [accountId, setAccountId] = useState(() => {
    const last = lsGet('qltc:lastAccount');
    if (last && accById(last)) return last;
    return (accountOptions()[0] || {}).value || ''; // không có tài khoản nào → "không gắn tài khoản"
  });
  const [date, setDate] = useState(todayStr);
  const [text, setText] = useState(initialText);
  const account = accById(accountId) || null;
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcText, setCalcText] = useState('');
  const calcCur = account ? account.currency : 'VND';
  const [items, setItems] = useState(() => buildItems(initialText, { account, income }));

  const reparse = (nextText, nextAccount) => setItems((prev) => buildItems(nextText, { account: nextAccount, income, prev }));
  const onText = (v) => { setText(v); reparse(v, account); };
  const onAccount = (v) => { setAccountId(v); reparse(text, accById(v) || null); };

  // Máy tính: tính xong bấm "Chèn" thì số đó được thêm vào cuối ô văn bản (ví dụ "cafe " + 450k/3 → "cafe 150000").
  const insertCalc = () => {
    const r = parseExpr(calcText);
    if (!r || !(r.total > 0)) { toast('Nhập phép tính cho ra số lớn hơn 0.', 'error'); return; }
    const num = toEditable(roundCur(r.total, calcCur), calcCur);
    onText(`${text}${!text || /[\s,;]$/.test(text) ? '' : ' '}${num}`);
    setCalcText('');
    setCalcOpen(false);
  };

  // Đổi danh mục sang / khỏi «Học bổng» thì tiền tệ và thẻ của khoản đổi theo → settleItem tính lại.
  const patch = (uid, p) => setItems((all) => all.map((x) => (x.uid === uid ? settleItem({ ...x, ...p }, account) : x)));
  const patchSch = (uid, p) => setItems((all) => all.map((x) => (x.uid === uid ? settleItem({ ...x, sch: { ...x.sch, ...p } }, account) : x)));
  const patchDebt = (uid, p) => setItems((all) => all.map((x) => (x.uid === uid ? { ...x, debt: { ...x.debt, ...p } } : x)));
  const patchHome = (uid, p) => setItems((all) => all.map((x) => (x.uid === uid ? { ...x, home: { ...x.home, ...p } } : x)));
  const remove = (uid) => patch(uid, { dropped: true });
  const applyAll = (uid) => {
    const src = items.find((x) => x.uid === uid);
    const others = items.filter((x) => x.uid !== uid && !x.error && !x.mismatch && !x.dropped && x.kind === 'expense');
    if (!others.length) { toast('Chỉ có một khoản.', 'info'); return; }
    const ids = new Set(others.map((x) => x.uid));
    setItems((all) => all.map((x) => (ids.has(x.uid)
      ? { ...x, debt: { ...x.debt, mode: src.debt.mode, partyIds: [...src.debt.partyIds], includeMe: src.debt.includeMe, manual: {}, bad: {}, text: {} } }
      : x)));
    toast(`Đã áp dụng cho ${others.length} khoản khác.`, 'ok');
  };

  const shown = items.filter((x) => !x.dropped);
  const droppedCount = items.length - shown.length;
  const problemOf = (x) => schProblemOf(x, date);
  const okItems = shown.filter((x) => itemOk(x) && !problemOf(x));
  const bad = shown.length - okItems.length;
  const noAcc = !account;

  async function onSave() {
    if (!okItems.length) return;
    const { docs, shared, sent, lastPeople } = buildQuickDocs({
      items: okItems, account, date, nameOf, familyCategoryId: (catByName('Biếu gia đình', 'expense') || {}).id || '',
    });
    const schItems = okItems.filter((x) => x.schActive);
    try {
      // Học bổng ghi trước: lưu lại lần nữa chỉ cập nhật đúng tháng đó nên thử lại không bị cộng đôi.
      let created = 0; let updated = 0;
      for (const x of schItems) {
        const r = await saveScholarshipEntry(schEntryOf(x, date));
        if (r.updated) updated += 1; else created += 1;
      }
      if (docs.length) await store.putMany('txs', docs);
      if (account) lsSet('qltc:lastAccount', account.id);
      if (lastPeople) lsSet(SHARE_PEOPLE_KEY, JSON.stringify(lastPeople));
      for (const i of okItems) if (i.kind === 'income') lsSet(homeKey(i.categoryId), i.home && i.home.on ? '1' : '0');
      close();
      const extra = [
        shared ? `${shared} khoản gắn với Vay nợ` : '',
        sent ? `${sent} khoản gửi ${HOME_NAME}` : '',
        created + updated ? `${created + updated} khoản vào mục Học bổng MIIGAiK${updated ? ` (${updated} tháng đã có được cập nhật)` : ''}` : '',
      ].filter(Boolean).join(', ');
      toast(`Đã lưu ${docs.length + created + updated} giao dịch${extra ? ` (${extra})` : ''}.`, 'ok');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  return (
    <Modal
      title={income ? 'Thêm khoản thu' : 'Nhập nhanh'}
      wide
      footer={(
        <>
          <Button variant="ghost" onClick={close}>Hủy</Button>
          <Button onClick={onSave} disabled={!okItems.length}><Save />Lưu tất cả</Button>
        </>
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Field
          label={<span className="block leading-snug">{income ? 'Gõ các khoản thu, ngăn bằng dấu phẩy, chấm phẩy hoặc xuống dòng' : 'Gõ nhiều khoản, ngăn bằng dấu phẩy, chấm phẩy hoặc xuống dòng'}</span>}
          hint={income
            ? 'Gắn đơn vị: 12 usd, 300 rub. Mỗi khoản thu có thể chọn “Gửi cho bố” ở bên dưới.'
            : 'Thêm "+" ở đầu cho khoản thu. Gắn đơn vị: 12 usd, 300 rub. Mua đồ ăn cho người khác: chọn “Cộng nợ” ở khoản đó.'}
        >
          <Textarea rows={3} value={text} onChange={(e) => onText(e.target.value)} placeholder={income ? 'lương 11tr; thưởng 2tr; làm thêm 500k' : 'cafe 25k, ăn trưa 45k; +lương 10,9tr; grab 38k'} />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
          <Button variant="soft" size="sm" className="justify-self-start" aria-expanded={calcOpen} onClick={() => setCalcOpen((o) => !o)}>
            <Calculator />{calcOpen ? 'Ẩn máy tính' : 'Máy tính'}
          </Button>
          {calcOpen ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-2xl border bg-muted/40 p-3" data-testid="qa-calc">
              <p className="text-xs text-muted-foreground">Tính số tiền rồi bấm “Chèn”: kết quả được thêm vào cuối ô ở trên. Gõ thẳng cũng được, ví dụ cafe 25k*2 hoặc ăn tối 450k/3.</p>
              <MoneyInput calc={false} value={calcText} onChange={setCalcText} currency={calcCur} placeholder="Ví dụ: 450k/3" aria-label="Phép tính" />
              <CalcPad value={calcText} onChange={setCalcText} currency={calcCur} doneLabel="Chèn" onDone={insertCalc} />
            </div>
          ) : null}
        </div>
        <FieldRow>
          <Field label="Tài khoản"><Select options={accountOptions({ none: NO_ACCOUNT_LABEL })} value={accountId} onChange={onAccount} /></Field>
          <Field label="Ngày"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </FieldRow>
        {noAcc ? <InfoNote tone="primary">{NO_ACCOUNT_NOTE} Tiền tệ mặc định là VND; gõ “12 usd”, “300 rub” để đổi.</InfoNote> : null}

        {shown.length ? (
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            {okItems.length}/{shown.length} khoản hợp lệ{bad ? ' — khoản màu đỏ sẽ không được lưu' : ''}
          </p>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          <AnimatePresence initial={false}>
            {shown.map((it, i) => (it.error
              ? <QuickErrorRow key={it.uid} item={it} />
              : <QuickItem key={it.uid} item={it} index={i} account={account} dialogDate={date} schProblem={problemOf(it)} onPatch={patch} onPatchDebt={patchDebt} onPatchHome={patchHome} onPatchSch={patchSch} onRemove={remove} onApplyAll={applyAll} />))}
          </AnimatePresence>
        </div>
        {droppedCount ? (
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setItems((all) => all.map((x) => ({ ...x, dropped: false })))}><Undo2 />Khôi phục {droppedCount} khoản đã bỏ</Button>
        ) : null}
      </div>
    </Modal>
  );
}

/** income=true: mở thẳng ở chế độ nhập khoản thu (không cần gõ dấu "+"). */
export function openQuickAdd(initialText = '', { income = false } = {}) {
  return openDialog(() => <QuickAdd initialText={initialText} income={income} />);
}
