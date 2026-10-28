// Thẻ một khoản trong Nhập nhanh: ghi chú, danh mục, chia nợ (khoản chi) hoặc gửi bố (khoản thu).
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X, TriangleAlert, Users } from 'lucide-react';
import { fmtMoney, parseExpr, CUR_INFO } from '@logic/money.js';
import { planOf, homePlanOf, HOME_NAME } from '@logic/quicksave.js';
import { describeShare, describeSendHome } from '@logic/share.js';
import { debtBalances } from '@logic/calc.js';
import { store } from '@logic/store.js';
import { categoryOptions, partyById } from '@/lib/options.js';
import { lsSet } from '@/lib/storage.js';
import { cn } from '@/lib/cn.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';
import { openPartyForm } from '@/forms/party-form.jsx';
import { SHARE_ME_KEY, sharePartyList, lastSharePeople } from './quick-helpers.js';

const SHARE_MODE_OPTS = [
  { value: 'none', label: 'Không chia' },
  { value: 'add', label: 'Cộng nợ' },
  { value: 'sub', label: 'Trừ nợ' },
];
const symbolOf = (cur) => (CUR_INFO[cur] || {}).symbol || cur;
const nameOf = (id) => (partyById(id) || {}).name || '?';

/** Dòng lỗi: không đọc được số tiền. */
export function QuickErrorRow({ item }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm">
      <TriangleAlert className="size-4 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1 truncate">“{item.raw}”</span>
      <Badge variant="danger">{item.error}</Badge>
    </div>
  );
}

function Panel({ show, children }) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Khoản thu: không chia nợ; chỉ hỏi có gửi cho bố hay không. */
function SendHome({ item: it, patchHome }) {
  const hm = it.home;
  const plan = homePlanOf(it);
  const bad = hm.on && !plan.ok;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">Sau khi nhận</span>
        <Segmented fill={false} size="sm" aria-label="Sau khi nhận" options={[{ value: 'keep', label: 'Giữ lại' }, { value: 'send', label: `Gửi cho ${HOME_NAME}` }]} value={hm.on ? 'send' : 'keep'} onChange={(v) => patchHome({ on: v === 'send' })} />
      </div>
      <Panel show={hm.on}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-xl bg-muted/60 p-3">
          <label className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col text-sm"><b>Số tiền gửi {HOME_NAME}</b><span className="text-xs text-muted-foreground">để trống = gửi cả khoản</span></span>
            <Input
              className={cn('tnum w-28 text-right sm:w-36', hm.bad && 'border-destructive')}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Để trống = gửi cả khoản"
              aria-label={`Số tiền gửi ${HOME_NAME}`}
              value={hm.text}
              onChange={(e) => {
                const text = e.target.value;
                const t = text.trim();
                const r = t ? parseExpr(t) : null;
                const badIn = !!t && !(r && r.total > 0);
                patchHome({ text, bad: badIn, manual: t && !badIn ? r.total : null });
              }}
            />
            <span className="tnum w-6 text-sm text-muted-foreground">{symbolOf(it.currency)}</span>
          </label>
          <p className={cn('text-xs leading-relaxed', bad ? 'font-medium text-destructive' : 'text-muted-foreground')}>{describeSendHome({ plan, currency: it.currency, toName: HOME_NAME })}</p>
        </div>
      </Panel>
    </>
  );
}

/** Khoản chi: chia cho người trong Vay nợ. */
function ShareDebt({ item: it, patchDebt, onApplyAll }) {
  const d = it.debt;
  const plan = planOf(it);
  const active = d.mode !== 'none';
  const people = active ? sharePartyList() : [];
  const debts = active ? debtBalances(store.all('txs')) : null;
  const manualCount = Object.keys(d.manual).length;

  const setMode = (v) => patchDebt({
    mode: v, manual: {}, bad: {}, text: {},
    partyIds: v !== 'none' && !d.partyIds.length ? lastSharePeople() : d.partyIds,
  });
  const toggle = (id, on) => {
    const manual = { ...d.manual }; const bad = { ...d.bad }; const text = { ...d.text };
    if (!on) { delete manual[id]; delete bad[id]; delete text[id]; }
    patchDebt({ partyIds: on ? [...d.partyIds, id] : d.partyIds.filter((x) => x !== id), manual, bad, text });
  };
  const onAmount = (id, value) => {
    const text = { ...d.text, [id]: value }; const manual = { ...d.manual }; const bad = { ...d.bad };
    delete manual[id]; delete bad[id];
    const t = value.trim();
    if (t) {
      const r = parseExpr(t);
      if (r && r.total > 0) manual[id] = r.total; else bad[id] = true;
    }
    patchDebt({ text, manual, bad });
  };
  const onBlur = (id) => {
    if (d.bad[id] || (id in d.text && !d.text[id].trim())) {
      const text = { ...d.text }; const bad = { ...d.bad }; const manual = { ...d.manual };
      delete text[id]; delete bad[id]; delete manual[id];
      patchDebt({ text, bad, manual });
    }
  };

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><Users className="size-3.5" />Chia cho người trong Vay nợ</span>
        <Segmented size="sm" aria-label="Cách chia nợ" options={SHARE_MODE_OPTS} value={d.mode} onChange={setMode} />
      </div>
      <Panel show={active}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-xl bg-muted/60 p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {d.mode === 'add' ? 'Mình trả hết số tiền này; những người được chọn nợ mình phần của họ.' : 'Những người được chọn đưa tiền cho mình; nợ của họ giảm đúng số đó.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const on = d.partyIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(p.id, !on)}
                  className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent')}
                >
                  {p.name}
                </button>
              );
            })}
            <button type="button" onClick={() => openPartyForm({ onSaved: (p) => patchDebt({ partyIds: [...d.partyIds, p.id] }) })} className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-[13px] font-semibold text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/30">
              <Plus className="size-3.5" />Thêm người
            </button>
          </div>
          {people.length ? null : <p className="text-xs text-muted-foreground">Chưa có ai trong danh sách Vay nợ — bấm “Thêm người”.</p>}
          {d.mode === 'add' ? (
            <CheckRow checked={d.includeMe} onChange={(v) => { lsSet(SHARE_ME_KEY, v ? '1' : '0'); patchDebt({ includeMe: v }); }} className="text-sm">
              Tính cả phần của mình (ghi thành chi tiêu của mình)
            </CheckRow>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {d.partyIds.filter((id) => partyById(id)).map((id) => {
              const cur = (debts.get(id) || {})[it.currency] || 0;
              const now = cur > 0 ? `đang nợ mình ${fmtMoney(cur, it.currency)}` : cur < 0 ? `mình đang nợ ${fmtMoney(-cur, it.currency)}` : 'hiện chưa nợ';
              const isManual = id in d.manual;
              const shown = id in d.text ? d.text[id] : (plan.ok && plan.shares[id] != null ? String(plan.shares[id]) : '');
              return (
                <label key={id} className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col text-sm"><b className="truncate">{nameOf(id)}</b><span className="text-xs text-muted-foreground">{now}</span></span>
                  <Input
                    className={cn('tnum w-28 text-right sm:w-36', !isManual && !d.bad[id] && 'text-muted-foreground', d.bad[id] && 'border-destructive')}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`Phần của ${nameOf(id)}`}
                    value={shown}
                    onChange={(e) => onAmount(id, e.target.value)}
                    onBlur={() => onBlur(id)}
                  />
                  <span className="tnum w-6 text-sm text-muted-foreground">{symbolOf(it.currency)}</span>
                </label>
              );
            })}
          </div>
          <p className={cn('text-xs leading-relaxed', plan.ok ? 'text-muted-foreground' : 'font-medium text-destructive')}>
            {describeShare({ mode: d.mode, amount: it.amount, currency: it.currency, plan, nameOf })}
          </p>
          <div className="flex flex-wrap gap-2">
            {manualCount ? <Button size="sm" variant="ghost" onClick={() => patchDebt({ manual: {}, bad: {}, text: {} })}>Chia đều lại</Button> : null}
            <Button size="sm" variant="ghost" onClick={onApplyAll}>Dùng cho tất cả khoản</Button>
          </div>
        </div>
      </Panel>
    </>
  );
}

/**
 * item: một khoản đã đọc; account: tài khoản đang chọn (null = không gắn).
 * onPatch(uid, partial) · onPatchDebt(uid, partial) · onPatchHome(uid, partial) · onRemove(uid) · onApplyAll(uid)
 */
export function QuickItem({ item: it, account, onPatch, onPatchDebt, onPatchHome, onRemove, onApplyAll, index = 0 }) {
  const isIncome = it.kind === 'income';
  const d = it.debt;
  const dplan = isIncome ? { ok: true } : planOf(it);
  const hplan = isIncome ? homePlanOf(it) : { ok: true };
  const bad = it.mismatch || (!isIncome && d.mode !== 'none' && !dplan.ok) || (isIncome && it.home.on && !hplan.ok);
  const hideCat = !isIncome && (d.mode === 'sub' || (d.mode === 'add' && !d.includeMe));
  let badge = { text: 'Chi', variant: 'neutral' };
  if (isIncome) badge = { text: 'Thu', variant: 'success' };
  else if (d.mode === 'add') badge = { text: 'Nợ +', variant: 'warning' };
  else if (d.mode === 'sub') badge = { text: 'Nợ −', variant: 'success' };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, delay: Math.min(index, 6) * 0.025 }}
      className={cn('grid grid-cols-[minmax(0,1fr)] gap-2.5 rounded-2xl border bg-card p-3', bad && 'border-destructive/50 bg-destructive/5')}
      data-testid="qa-item"
    >
      <div className="flex items-center gap-2">
        <Badge variant={badge.variant}>{badge.text}</Badge>
        <strong className="tnum min-w-0 flex-1 truncate text-[15px]">{fmtMoney(it.amount, it.currency)}</strong>
        {it.mismatch ? <Badge variant="danger">≠ {account && account.currency}</Badge> : null}
        <Button variant="ghost" size="icon-sm" aria-label="Bỏ khoản này" onClick={() => onRemove(it.uid)}><X className="size-4" /></Button>
      </div>
      <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-2', !hideCat && 'sm:grid-cols-2')}>
        <Input value={it.note} aria-label="Ghi chú" placeholder="Ghi chú" onChange={(e) => onPatch(it.uid, { note: e.target.value })} />
        {hideCat ? null : <Select aria-label="Danh mục" options={categoryOptions(it.kind, '—')} value={it.categoryId} onChange={(v) => onPatch(it.uid, { categoryId: v })} />}
      </div>
      {it.mismatch ? (
        <p className="text-xs font-medium text-destructive">Khác tiền tệ của tài khoản đã chọn ({account && account.currency}) nên khoản này sẽ không được lưu. Đổi tài khoản, hoặc chọn “Không gắn tài khoản”.</p>
      ) : isIncome ? (
        <SendHome item={it} patchHome={(p) => onPatchHome(it.uid, p)} />
      ) : (
        <ShareDebt item={it} patchDebt={(p) => onPatchDebt(it.uid, p)} onApplyAll={() => onApplyAll(it.uid)} />
      )}
    </motion.div>
  );
}

