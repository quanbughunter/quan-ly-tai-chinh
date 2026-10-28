// Hộp thoại xem / sửa / chốt một lệnh đổi tiền.
//   d0: lệnh có sẵn hoặc bản nháp từ máy tính ({ dir, inputs, actual }).  confirm: mở thẳng ở bước chốt.
//   onSaved: gọi sau khi lưu / chốt / xóa thành công.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { store } from '@logic/store.js';
import { evalDeal, suggestedProfit } from '@logic/fx.js';
import { fmtNum, roundTo, parseExpr, CUR_INFO } from '@logic/money.js';
import { todayStr, fmtDate } from '@logic/dates.js';
import {
  DIR_LABEL, statusOf, defaultProfitAccountId, rememberProfitAccount, saveDeal, confirmDeal, revertDeal, removeDeal,
  convertProfit, foreignFor, newDealId,
} from '@logic/deals.js';
import { openDialog, useDialog, confirmBox } from '@/lib/dialogs.jsx';
import { useStore } from '@/lib/store-hooks.js';
import { toast } from '@/lib/toast.js';
import { errMsg, money } from '@/lib/format.js';
import { accountOptions, partyOptions } from '@/lib/options.js';
import { openAccountForm, openPartyForm } from '@/forms/index.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field, Label } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';
import { cn } from '@/lib/cn.js';
import { DealBody, amountOf, initValues, parseValues, useDealValues } from './deal-fields.jsx';

const symOf = (c) => (CUR_INFO[c] ? CUR_INFO[c].symbol : c);
const decOf = (c) => (c === 'VND' ? 0 : (CUR_INFO[c] ? CUR_INFO[c].dec : 2));
const curOf = (accountId) => { const a = store.byId('accounts', accountId); return a ? a.currency : 'VND'; };

/** Chuỗi hiển thị trong ô lãi cho một số lãi VND theo đơn vị đang chọn ('' nếu chưa tính được). */
function textFor(vnd, unit, rate) {
  if (vnd == null || !Number.isFinite(vnd)) return '';
  if (unit === 'VND') return String(Math.round(vnd));
  return rate > 0 ? String(roundTo(vnd / rate, decOf(unit))) : '';
}

function DealDialog({ d0, confirm, onSaved }) {
  useStore();
  const { close } = useDialog();
  const params = store.settings().params;

  // Giá trị cố định của lần mở này.
  const [init] = useState(() => {
    const id = d0.id || newDealId();
    const isNew = !(d0.id && store.byId('deals', d0.id));
    const wasDone = statusOf(d0) === 'done';
    const linkedTx = d0.profitTxId ? store.byId('txs', d0.profitTxId) : null;
    const accountId = linkedTx ? linkedTx.accountId : defaultProfitAccountId();
    let unit = d0.profitUnit && d0.profitUnit !== 'VND' ? d0.profitUnit : 'VND';
    if (unit !== 'VND' && unit !== foreignFor(curOf(accountId))) unit = 'VND';
    const sug = suggestedProfit({ dir: d0.dir, ...parseValues(d0.dir, initValues(d0.dir, d0.inputs || {}, d0.actual || {})) }, params);
    const manual = wasDone ? sug.value == null || Math.round(sug.value) !== Math.round(Number(d0.profit) || 0) : false;
    let fxText = '';
    if (wasDone && unit !== 'VND') {
      const r = Number(d0.profitRate);
      const val = linkedTx && linkedTx.currency === unit
        ? (linkedTx.kind === 'expense' ? -1 : 1) * linkedTx.amount
        : (r > 0 ? roundTo((Number(d0.profit) || 0) / r, decOf(unit)) : '');
      fxText = val === '' ? '' : String(val);
    }
    return {
      id, isNew, wasDone, linkedTx, accountId, unit, manual, fxText,
      profitText: wasDone && d0.profit != null ? String(Math.round(d0.profit)) : '',
      hasAccounts: accountOptions({ includeArchived: true }).length > 0,
    };
  });
  const { id, isNew, wasDone, linkedTx } = init;
  const dir0 = d0.dir;

  const { vals, setVal, parsed, result } = useDealValues(dir0, d0.inputs || {}, d0.actual || {}, params);

  const [date, setDate] = useState(d0.date || todayStr());
  const [partyId, setPartyId] = useState(d0.partyId || '');
  const [note, setNote] = useState(d0.note || '');
  const [mode, setMode] = useState(wasDone || confirm ? 'confirm' : 'quote');
  const [post, setPost] = useState(wasDone ? !!linkedTx : init.hasAccounts);
  const [accountId, setAccountId] = useState(init.accountId);
  const [unit, setUnit] = useState(init.unit); // đơn vị bạn nhập số lãi
  const [manual, setManual] = useState(init.manual);
  const [profitText, setProfitText] = useState(init.profitText);
  const [fxText, setFxText] = useState(init.fxText);
  const [rateText, setRateText] = useState(Number(d0.profitRate) > 0 ? String(d0.profitRate) : '');
  const [rateTouched, setRateTouched] = useState(Number(d0.profitRate) > 0);

  const accOpts = accountOptions({ includeArchived: true });
  const cardCur = curOf(accountId);
  const F = foreignFor(cardCur);
  const suggestion = suggestedProfit({ dir: dir0, ...parsed }, params);

  // Tỉ giá gợi ý: rúp → giá báo của chính lệnh này; không có thì tỉ giá trong Cài đặt.
  const defaultRate = (() => {
    if (F === 'RUB') {
      const q = evalDeal({ dir: dir0, ...parsed }, params).quote;
      if (q && q.quote > 0) return String(roundTo(q.quote, 2));
    }
    const sr = Number((store.settings().rates || {})[F]);
    return sr > 0 ? String(sr) : '';
  })();
  const rate = rateTouched ? rateText : defaultRate;
  const rateNum = (() => { const r = parseExpr(rate); return r && r.total > 0 ? r.total : NaN; })();
  const needRate = unit !== 'VND' || (post && cardCur !== 'VND');

  // Ô lãi đang hiện: số tự tính (theo giá thực / giá báo) hoặc số bạn tự gõ.
  const activeText = manual ? (unit === 'VND' ? profitText : fxText) : textFor(suggestion.value, unit, rateNum);
  const typed = readAmount(activeText);
  /** Lãi VND của số đang nhập (NaN nếu chưa đọc được hoặc thiếu tỉ giá). */
  const currentVnd = () => {
    if (!Number.isFinite(typed)) return NaN;
    return unit === 'VND' ? typed : typed * rateNum;
  };

  const onTypeProfit = (t) => { setManual(true); if (unit === 'VND') setProfitText(t); else setFxText(t); };
  const onRate = (t) => { setRateText(t); setRateTouched(true); };
  const onUnit = (u) => {
    const oldVnd = currentVnd();
    setUnit(u);
    if (manual) { const t = textFor(oldVnd, u, rateNum); if (u === 'VND') setProfitText(t); else setFxText(t); }
  };
  const onCard = (newId) => {
    const oldVnd = currentVnd();
    const newF = foreignFor(curOf(newId));
    let nUnit = unit;
    if (newF !== F) { setRateTouched(false); if (unit !== 'VND') nUnit = 'VND'; }
    setAccountId(newId);
    setUnit(nUnit);
    if (nUnit !== unit && manual) setProfitText(textFor(oldVnd, nUnit, rateNum));
  };
  const onCardRef = useRef(onCard);
  onCardRef.current = onCard;

  // Gợi ý + tóm tắt quy đổi
  const hint = manual ? 'Bạn đã tự nhập số lãi.'
    : suggestion.source === 'real' ? 'Tự tính từ giá thực. Sửa số này nếu lãi thật khác.'
      : suggestion.source === 'quote' ? 'Đang lấy lãi theo giá báo — nhập giá thực bên trên để tính chính xác.'
        : `Nhập lãi thực nhận (${unit === 'VND' ? 'VND' : unit}).`;
  const conv = convertProfit({ amount: Number.isFinite(typed) ? typed : '', unit, cardCurrency: post ? cardCur : 'VND', rate: rateNum });
  let summary = '';
  let summaryBad = false;
  if (needRate) {
    if (!conv.ok) { summary = Number.isFinite(typed) ? conv.error : ''; summaryBad = Number.isFinite(typed); } else {
      const acc = store.byId('accounts', accountId);
      const parts = [`Lãi tính ra ${money(conv.vnd, 'VND', { sign: true })}`];
      if (post && cardCur !== 'VND') parts.push(`cộng ${money(conv.card, cardCur, { sign: true })} vào thẻ “${acc ? acc.name : ''}”`);
      summary = `${parts.join(' · ')} (tỉ giá áng chừng ${fmtNum(conv.rate, 4)} ₫/${conv.foreign}).`;
    }
  }

  // Cuộn tới khối chốt khi bấm "Chốt giao dịch" (không cuộn lúc mới mở).
  const confirmRef = useRef(null);
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) { firstMode.current = false; return; }
    if (mode === 'confirm' && confirmRef.current) confirmRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [mode]);

  /* ───── Lưu / chốt / xóa ───── */
  function buildDoc() {
    const v = parsed;
    const r = evalDeal({ dir: dir0, ...v }, params);
    if (!r.quote || !amountOf(dir0, v.inputs)) { toast('Chưa đủ dữ liệu: cần giá báo và số tiền khách đưa.', 'error'); return null; }
    if (!date) { toast('Chọn ngày giao dịch.', 'error'); return null; }
    return {
      ...d0, id, dir: dir0, date, partyId, note: note.trim(),
      inputs: v.inputs, actual: v.actual,
      // ảnh chụp kết quả để lịch sử không đổi khi sau này chỉnh tham số
      result: { quote: r.quote.quote, rubPay: r.quote.rubPay ?? null, vndPay: r.quote.vndPay ?? null },
    };
  }

  async function run(fn, okMsg) {
    try { await fn(); close(); toast(okMsg, 'ok'); if (onSaved) onSaved(); } catch (e) { toast(errMsg(e), 'error'); }
  }

  const onSaveQuote = () => {
    const doc = buildDoc();
    if (!doc) return;
    const { profit, profitTxId, postSkipped, profitUnit, profitRate, ...rest } = doc; // eslint-disable-line no-unused-vars
    run(() => saveDeal({ ...rest, status: 'quote' }), 'Đã lưu báo giá.');
  };
  const onConfirm = () => {
    const doc = buildDoc();
    if (!doc) return;
    if (!Number.isFinite(typed)) { toast('Nhập số lãi (hoặc nhập giá thực để tự tính).', 'error'); return; }
    if (post && !accountId) { toast('Chọn thẻ để cộng lãi.', 'error'); return; }
    const cc = post ? cardCur : 'VND';
    const c = convertProfit({ amount: typed, unit, cardCurrency: cc, rate: rateNum });
    if (!c.ok) { toast(c.error, 'error'); return; }
    const inCard = cc !== 'VND' ? ` (${money(c.card, cc, { sign: true })})` : '';
    const msg = post && c.card !== 0 ? `Đã chốt. Lãi ${money(c.vnd, 'VND', { sign: true })}${inCard} đã vào thẻ ngày ${fmtDate(date)}.` : 'Đã chốt giao dịch.';
    run(async () => {
      await confirmDeal(
        { ...doc, profit: c.vnd, profitUnit: unit, profitRate: c.rate },
        { post, accountId, cardAmount: post && cc !== 'VND' ? c.card : null });
      if (post) rememberProfitAccount(accountId);
    }, msg);
  };
  const onDelete = async () => {
    const extra = d0.profitTxId ? ' Khoản lãi đã cộng vào thẻ cũng sẽ bị xóa.' : '';
    if (!(await confirmBox(`Xóa lệnh này?${extra}`, { okLabel: 'Xóa', danger: true }))) return;
    run(() => removeDeal(id), 'Đã xóa.');
  };
  const onRevert = async () => {
    const extra = d0.profitTxId ? ' Khoản lãi đã cộng vào thẻ sẽ bị gỡ.' : '';
    if (!(await confirmBox(`Hủy chốt, đưa lệnh về trạng thái báo giá?${extra}`, { okLabel: 'Hủy chốt', danger: true }))) return;
    run(() => revertDeal(id), 'Đã hủy chốt.');
  };

  const title = wasDone ? 'Lệnh đã chốt' : isNew ? (confirm ? 'Chốt giao dịch' : 'Lưu báo giá') : 'Báo giá';
  const unitOpts = [{ value: 'VND', label: '₫ VND' }, { value: F, label: `${symOf(F)} ${F}` }];

  const footer = (
    <>
      {!isNew || wasDone ? (
        <div className="mr-auto flex gap-2">
          {!isNew ? <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>Xóa</Button> : null}
          {wasDone ? <Button variant="ghost" onClick={onRevert}>Hủy chốt</Button> : null}
        </div>
      ) : null}
      <Button variant="ghost" className="hidden sm:inline-flex" onClick={close}>Đóng</Button>
      {wasDone ? <Button onClick={onConfirm}>Lưu thay đổi</Button>
        : mode === 'confirm' ? (
          <>
            <Button variant="outline" onClick={onSaveQuote}>Chỉ lưu báo giá</Button>
            <Button onClick={onConfirm}>✓ Xác nhận chốt</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onSaveQuote}>{isNew ? 'Lưu báo giá' : 'Lưu'}</Button>
            <Button onClick={() => setMode('confirm')}>✓ Chốt giao dịch</Button>
          </>
        )}
    </>
  );

  return (
    <Modal title={title} wide footer={footer}>
      <div className="grid grid-cols-1 gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{DIR_LABEL[dir0] + (dir0 === 'sang' ? ' · VND → RUB' : ' · RUB → VND')}</Badge>
          {isNew ? null : (statusOf(d0) === 'done' ? <Badge variant="success">Đã chốt</Badge> : <Badge variant="muted">Báo giá</Badge>)}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Ngày giao dịch"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Khách">
            <div className="flex items-center gap-2">
              <Select options={partyOptions(null, '— Không chọn —')} value={partyId} onChange={setPartyId} />
              <Button variant="outline" size="icon" aria-label="Thêm khách mới" onClick={() => openPartyForm(null, { role: 'customer', onSaved: (p) => setPartyId(p.id) })}><Plus className="size-4" /></Button>
            </div>
          </Field>
        </div>

        <DealBody dir={dir0} vals={vals} setVal={setVal} parsed={parsed} result={result} params={params} />

        <AnimatePresence initial={false}>
          {mode === 'confirm' ? (
            <motion.div key="confirm" ref={confirmRef} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <div data-testid="confirm-box" className="grid grid-cols-1 gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="grid grid-cols-1 gap-1.5">
                  <Label>Lãi ghi nhận (âm nếu lỗ)</Label>
                  <Segmented options={unitOpts} value={unit} onChange={onUnit} className="max-w-xs" />
                  <MoneyInput value={activeText} onChange={onTypeProfit} currency={unit} aria-label="Lãi ghi nhận" />
                  <p className="text-xs text-muted-foreground">{hint}</p>
                  {manual && suggestion.value != null ? (
                    <div><Button size="sm" variant="outline" onClick={() => setManual(false)}>Dùng số tự tính</Button></div>
                  ) : null}
                </div>

                {needRate ? (
                  <Field label={`Tỉ giá áng chừng (₫ cho 1 ${F})`} hint="Chỉ để quy đổi lãi — nhập số áng chừng. Mặc định lấy từ giá báo của lệnh (rúp) hoặc từ Cài đặt; sửa lại nếu muốn.">
                    <MoneyInput value={rate} onChange={onRate} currency="" placeholder="ví dụ 330" />
                  </Field>
                ) : null}
                {needRate && summary ? <p className={cn('text-xs', summaryBad ? 'font-medium text-destructive' : 'text-muted-foreground')}>{summary}</p> : null}

                <CheckRow checked={post} onChange={setPost}>Cộng lãi vào thẻ (ghi một khoản thu đúng ngày của lệnh)</CheckRow>

                <Field label="Thẻ nhận lãi" hint="Thẻ VND hoặc thẻ rúp… đều được; thẻ ngoại tệ thì lãi được quy đổi theo tỉ giá áng chừng ở trên. App nhớ thẻ bạn chọn để gợi ý lần sau.">
                  <div className="flex items-center gap-2">
                    <Select options={accOpts} value={accountId} onChange={onCard} disabled={!post} placeholder="Chọn thẻ…" />
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => openAccountForm(null, { onSaved: (a) => { setPost(true); onCardRef.current(a.id); } })}><Plus className="size-4" />Thẻ mới</Button>
                  </div>
                </Field>
                {!accOpts.length ? <p className="text-xs font-medium text-destructive">Chưa có tài khoản nào — bấm “＋ Thẻ mới” để tạo thẻ nhận lãi.</p> : null}
                {wasDone && !linkedTx ? <p className="text-xs text-muted-foreground">{d0.postSkipped ? 'Lệnh này đang được đánh dấu “không cộng thẻ”.' : 'Lệnh này chưa được cộng vào thẻ.'}</p> : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Field label="Ghi chú"><Input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** Mở hộp thoại lệnh. Trả { close }. */
export function openDealForm(d0, { confirm = false, onSaved } = {}) {
  return openDialog(() => <DealDialog d0={d0} confirm={confirm} onSaved={onSaved} />);
}
