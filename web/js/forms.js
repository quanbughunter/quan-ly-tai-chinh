// Các biểu mẫu dùng chung: giao dịch, nhập nhanh, tài khoản, đối tượng (người vay / khách).

import { h, modal, field, select, seg, moneyInput, currencyOptions, toast, errMsg, confirmBox, money } from './ui.js';
import { store } from './store.js';
import { TX_KINDS, ACCOUNT_KINDS, PARTY_ROLES } from './model.js';
import { todayStr } from './dates.js';
import { accountBalances, debtBalances, DEBT_SIGN } from './calc.js';
import { parseQuick } from './quickadd.js';
import { fmtMoney, fmtNum, parseExpr, impliedRate, CUR_INFO } from './money.js';
import { planShare, buildShareTxs, describeShare } from './share.js';
import { requestOpenDeal } from './deals.js';
import { requestOpenScholarship, SCHOLARSHIP_NAME } from './scholarship.js';

const DEBT_KINDS = ['lend', 'repay_in', 'borrow', 'repay_out'];

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };

export function accountOptions({ none = null, includeArchived = false, only } = {}) {
  const list = store.all('accounts')
    .filter((a) => (includeArchived || !a.archived) && (!only || only(a)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
  const opts = list.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }));
  return none ? [{ value: '', label: none }, ...opts] : opts;
}

export function categoryOptions(type, none = '— Không phân loại —') {
  const list = store.all('categories').filter((c) => !type || c.type === type)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
  return [{ value: '', label: none }, ...list.map((c) => ({ value: c.id, label: `${c.icon || ''} ${c.name}`.trim() }))];
}

export function partyOptions(roles, none = '— Chọn người —') {
  const list = store.all('parties').filter((p) => !roles || roles.includes(p.role || 'person'))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return [{ value: '', label: none }, ...list.map((p) => ({ value: p.id, label: p.name }))];
}

export const catById = (id) => store.byId('categories', id);
export const accById = (id) => store.byId('accounts', id);
export const partyById = (id) => store.byId('parties', id);

/* ───────────────────────── Giao dịch ───────────────────────── */
const GROUPS = [
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'transfer', label: 'Chuyển / đổi' },
  { value: 'debt', label: 'Vay nợ' },
  { value: 'adjust', label: 'Điều chỉnh' },
];
const groupOf = (kind) => (DEBT_KINDS.includes(kind) ? 'debt' : kind || 'expense');

/** init: { tx?, group?, kind?, partyId?, accountId?, date? } */
export function openTxForm(init = {}) {
  const t = init.tx || null;
  if (t && t.dealId) return openDealTxNotice(t);
  if (t && t.scholarshipId) return openScholarshipTxNotice(t);
  if (!store.all('accounts').length) {
    toast('Hãy tạo ít nhất một tài khoản trước.', 'error');
    location.hash = '#/accounts';
    return null;
  }
  const defAcc = init.accountId || (t && t.accountId) || lsGet('qltc:lastAccount') || (accountOptions()[0] || {}).value || '';
  const st = {
    group: t ? groupOf(t.kind) : init.group || (init.kind ? groupOf(init.kind) : 'expense'),
    debtKind: t && DEBT_KINDS.includes(t.kind) ? t.kind : (DEBT_KINDS.includes(init.kind) ? init.kind : 'lend'),
    date: t ? t.date : init.date || todayStr(),
    accountId: t ? t.accountId || '' : defAcc,
    toAccountId: t ? t.toAccountId || '' : '',
    amount: t ? t.amount : '',
    toAmount: t && t.toAmount != null ? t.toAmount : '',
    // Với Vay nợ: tiền tệ của khoản nợ (có thể khác tiền tệ tài khoản); các nhóm khác luôn theo tài khoản.
    currency: t ? t.currency : (accById(defAcc) || {}).currency || 'VND',
    accountAmount: t && t.accountAmount != null ? t.accountAmount : '',
    partyId: t ? t.partyId || '' : init.partyId || '',
    categoryId: t ? t.categoryId || '' : '',
    note: t ? t.note || '' : '',
  };
  const root = h('div', { class: 'form' });
  const m = modal({ title: t ? 'Sửa giao dịch' : 'Thêm giao dịch', body: root, actions: [] });
  let amountCtl;
  let toAmountCtl;
  let accAmtCtl;
  let refreshRate = () => {};

  const kindOf = () => (st.group === 'debt' ? st.debtKind : st.group);
  const acc = () => accById(st.accountId);

  function draw() {
    const kids = [];
    kids.push(seg(GROUPS, st.group, (v) => {
      st.group = v;
      if (v !== 'debt' && !st.accountId) st.accountId = defAcc;
      if (v === 'debt' && acc()) st.currency = acc().currency; // mặc định: khoản nợ cùng tiền tệ với tài khoản
      draw();
    }));
    if (st.group === 'debt') {
      kids.push(field('Loại', select(DEBT_KINDS.map((k) => ({ value: k, label: TX_KINDS[k] })), st.debtKind, (v) => { st.debtKind = v; draw(); })));
      const pSel = select(partyOptions(), st.partyId, (v) => { st.partyId = v; });
      kids.push(field('Người', h('div', { class: 'row-inline' }, pSel, h('button', { type: 'button', class: 'btn small', onclick: () => openPartyForm({ onSaved: (p) => { st.partyId = p.id; draw(); } }) }, '＋ Người mới'))));
    }
    kids.push(field('Ngày', h('input', { type: 'date', value: st.date, onchange: (e) => { st.date = e.target.value; } })));

    const needAcc = st.group !== 'debt';
    const accSel = select(accountOptions({ none: needAcc ? null : '— Không gắn tài khoản —' }), st.accountId, (v) => {
      st.accountId = v;
      const a = acc();
      if (a) { st.currency = a.currency; amountCtl && amountCtl.setCurrency(a.currency); }
      draw();
    });
    kids.push(field(st.group === 'transfer' ? 'Từ tài khoản' : 'Tài khoản', accSel));

    if (st.group === 'transfer') {
      kids.push(field('Sang tài khoản', select(accountOptions({ none: '— Chọn —' }), st.toAccountId, (v) => { st.toAccountId = v; draw(); })));
    }

    const a = acc();
    const isDebt = st.group === 'debt';
    const cur = isDebt ? st.currency : (a ? a.currency : st.currency);
    const cross = isDebt && !!a && a.currency !== cur; // khoản nợ khác tiền tệ với tài khoản
    accAmtCtl = null;
    refreshRate = () => {};
    amountCtl = moneyInput({ value: st.amount, currency: cur, onChange: (v) => { st.amount = Number.isNaN(v) ? '' : v; refreshRate(); } });
    const amtLabel = st.group === 'adjust' ? 'Số tiền điều chỉnh (+ hoặc −)' : cross ? 'Số tiền ghi nợ' : 'Số tiền';
    if (isDebt) {
      // Chọn được tiền tệ riêng cho khoản nợ: ví dụ trừ đô la ở Vietcombank nhưng người vay nhận và nợ bằng đồng.
      kids.push(field('Tiền tệ khoản nợ', select(currencyOptions, st.currency, (v) => { st.currency = v; draw(); }),
        a && a.currency !== cur ? `Khác tiền tệ của tài khoản (${a.currency}) — nhập thêm số tiền thực ra / vào tài khoản bên dưới.` : null));
    }
    kids.push(field(`${amtLabel}${cur && (a || isDebt) ? ` (${cur})` : ''}`, amountCtl.el, 'Gõ được: 25k, 1,5tr, 3tr+500k'));

    if (cross) {
      const outflow = st.debtKind === 'lend' || st.debtKind === 'repay_out';
      const rate = h('span', { class: 'field-hint mono' });
      const rateText = () => { const r = impliedRate(amountCtl.get(), cur, st.accountAmount, a.currency); return r ? `Tỷ giá ngầm: ${r}` : ''; };
      refreshRate = () => { rate.textContent = rateText(); };
      accAmtCtl = moneyInput({ value: st.accountAmount, currency: a.currency, onChange: (v) => { st.accountAmount = Number.isNaN(v) ? '' : v; refreshRate(); } });
      kids.push(field(`${outflow ? 'Trừ khỏi' : 'Cộng vào'} ${a.name} (${a.currency})`, accAmtCtl.el, 'Số tiền thực tế đi ra / đi vào tài khoản này.'));
      kids.push(rate);
      refreshRate();
    }

    if (st.group === 'transfer') {
      const to = accById(st.toAccountId);
      if (to && a && to.currency !== a.currency) {
        const rate = h('span', { class: 'field-hint mono' });
        const rateText = () => {
          const x = Number(amountCtl.get());
          const y = Number(st.toAmount);
          if (x > 0 && y > 0) return y / x < 1 ? `Tỷ giá ngầm: 1 ${to.currency} = ${fmtNum(x / y, 2)} ${a.currency}` : `Tỷ giá ngầm: 1 ${a.currency} = ${fmtNum(y / x, 2)} ${to.currency}`;
          return '';
        };
        toAmountCtl = moneyInput({ value: st.toAmount, currency: to.currency, onChange: (v) => { st.toAmount = Number.isNaN(v) ? '' : v; rate.textContent = rateText(); } });
        kids.push(field(`Số nhận được (${to.currency})`, toAmountCtl.el));
        kids.push(rate);
        rate.textContent = rateText();
      }
    }

    if (st.group === 'expense' || st.group === 'income') {
      kids.push(field('Danh mục', select(categoryOptions(st.group), st.categoryId, (v) => { st.categoryId = v; })));
    }
    kids.push(field('Ghi chú', h('input', { type: 'text', value: st.note, placeholder: 'Ví dụ: ăn trưa, tiền nhà…', oninput: (e) => { st.note = e.target.value; } })));

    const foot = h('div', { class: 'sheet-foot inline' });
    if (t) foot.append(h('button', { type: 'button', class: 'btn danger-ghost', onclick: onDelete }, 'Xóa'));
    foot.append(h('span', { class: 'spacer' }), h('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { type: 'button', class: 'btn primary', onclick: onSave }, 'Lưu'));
    kids.push(foot);
    root.replaceChildren(...kids);
  }

  async function onSave() {
    const kind = kindOf();
    const a = acc();
    const amount = Number(amountCtl.get());
    const debtCur = st.group === 'debt' ? st.currency : null;
    if (kind === 'adjust') { if (!amount) return toast('Nhập số tiền điều chỉnh khác 0.', 'error'); } else if (!(amount > 0)) return toast('Nhập số tiền lớn hơn 0.', 'error');
    if (!st.date) return toast('Chọn ngày.', 'error');
    if (kind !== 'lend' && kind !== 'repay_in' && kind !== 'borrow' && kind !== 'repay_out' && !a) return toast('Chọn tài khoản.', 'error');
    if (st.group === 'debt' && !st.partyId) return toast('Chọn người liên quan đến khoản vay nợ.', 'error');
    const doc = {
      id: t ? t.id : undefined, ts: t ? t.ts : undefined,
      date: st.date, kind, amount, currency: debtCur || (a ? a.currency : st.currency),
      accountId: a ? a.id : '', note: st.note.trim(),
    };
    if (debtCur && a && a.currency !== debtCur) {
      const outflow = kind === 'lend' || kind === 'repay_out';
      const aa = accAmtCtl ? Number(accAmtCtl.get()) : NaN;
      if (!(aa > 0)) return toast(`Nhập số tiền ${outflow ? 'trừ khỏi' : 'cộng vào'} tài khoản (${a.currency}).`, 'error');
      doc.accountAmount = aa;
    }
    if (st.group === 'expense' || st.group === 'income') doc.categoryId = st.categoryId || '';
    if (st.group === 'debt') doc.partyId = st.partyId;
    if (st.group === 'transfer') {
      const to = accById(st.toAccountId);
      if (!to) return toast('Chọn tài khoản nhận.', 'error');
      if (to.id === a.id) return toast('Tài khoản nhận phải khác tài khoản gửi.', 'error');
      doc.toAccountId = to.id;
      if (to.currency !== a.currency) {
        const ta = Number(st.toAmount);
        if (!(ta > 0)) return toast(`Nhập số tiền nhận được (${to.currency}).`, 'error');
        doc.toAmount = ta;
      }
    }
    try {
      await store.put('txs', doc);
      if (a) lsSet('qltc:lastAccount', a.id);
      m.close();
      toast(t ? 'Đã cập nhật giao dịch.' : 'Đã lưu giao dịch.', 'ok');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  async function onDelete() {
    if (!(await confirmBox('Xóa giao dịch này? Số dư sẽ được tính lại.', { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('txs', t.id); m.close(); toast('Đã xóa.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  }

  draw();
  return m;
}

/** Giao dịch lãi do lệnh đổi tiền tự tạo: không sửa tay ở đây để số dư luôn khớp với lệnh. */
function openDealTxNotice(t) {
  const deal = store.byId('deals', t.dealId);
  const a = accById(t.accountId);
  const body = h('div', { class: 'form' },
    h('p', { class: 'confirm-text' }, `Khoản này (${fmtMoney(t.amount, t.currency)}${a ? ` · ${a.name}` : ''}) được tạo tự động khi chốt giao dịch ở mục Báo tỉ giá. Muốn sửa số lãi, đổi ngày hoặc hủy, hãy mở lệnh đó — khoản này sẽ tự cập nhật theo.`));
  const m = modal({
    title: 'Lãi từ giao dịch đổi tiền',
    body,
    actions: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Đóng'),
      deal ? h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); requestOpenDeal(deal.id); location.hash = '#/fx'; } }, 'Mở lệnh đổi tiền') : null,
    ].filter(Boolean),
  });
  return m;
}

/** Khoản học bổng do mục Học bổng MIIGAiK tự tạo: sửa ở đó để số dư thẻ luôn khớp. */
function openScholarshipTxNotice(t) {
  const item = store.byId('scholarships', t.scholarshipId);
  const a = accById(t.accountId);
  const body = h('div', { class: 'form' },
    h('p', { class: 'confirm-text' }, `Khoản này (${fmtMoney(t.amount, t.currency)}${a ? ` · ${a.name}` : ''}) được tạo tự động khi bạn đánh dấu đã nhận học bổng ở mục ${SCHOLARSHIP_NAME}. Muốn sửa số tiền, đổi ngày, đổi thẻ hoặc hủy, hãy mở tháng đó — khoản này sẽ tự cập nhật theo.`));
  const m = modal({
    title: SCHOLARSHIP_NAME,
    body,
    actions: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Đóng'),
      item ? h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); requestOpenScholarship(item.id); location.hash = '#/scholarship'; } }, 'Mở tháng học bổng') : null,
    ].filter(Boolean),
  });
  return m;
}

/* ───────────────────────── Nhập nhanh ───────────────────────── */
// Mỗi khoản có thể gắn với người trong danh sách Vay nợ (mình là thủ quỹ mua đồ ăn cho nhiều người):
//  • Cộng nợ — mình trả hộ: tài khoản bị trừ đủ, người được chọn nợ mình thêm phần của họ.
//  • Trừ nợ  — họ đưa tiền cho mình: tài khoản được cộng, nợ của họ giảm.
// Cách chia và dựng giao dịch nằm ở share.js (hàm thuần, có kiểm thử).
const SHARE_PEOPLE_KEY = 'qltc:sharePeople';
const SHARE_ME_KEY = 'qltc:shareIncludeMe';
const SHARE_MODE_OPTS = [
  { value: 'none', label: 'Không chia' },
  { value: 'add', label: 'Cộng nợ' },
  { value: 'sub', label: 'Trừ nợ' },
];

/** Những người có thể chọn: đúng như màn hình Vay nợ (người quen / người nhà, hoặc đang có nợ). */
function sharePartyList() {
  const debts = debtBalances(store.all('txs'));
  return store.all('parties')
    .filter((p) => (p.role || 'person') === 'person' || p.role === 'family' || debts.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
function lastSharePeople() {
  try {
    const v = JSON.parse(lsGet(SHARE_PEOPLE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((id) => partyById(id)) : [];
  } catch { return []; }
}
const newDebt = () => ({ mode: 'none', partyIds: [], includeMe: lsGet(SHARE_ME_KEY) !== '0', manual: {}, bad: {} });

function planOf(it) {
  const d = it.debt;
  if (d.mode === 'none') return { ok: true, shares: {}, myShare: 0 };
  if (Object.keys(d.bad).length) return { ok: false, error: 'Có ô số tiền chưa đọc được.', shares: {}, myShare: 0 };
  return planShare({ mode: d.mode, amount: it.amount, currency: it.currency, partyIds: d.partyIds, includeMe: d.includeMe, manual: d.manual });
}
const itemOk = (it) => !it.error && !it.mismatch && planOf(it).ok;

export function openQuickAdd(initialText = '') {
  if (!store.all('accounts').length) {
    toast('Hãy tạo ít nhất một tài khoản trước.', 'error');
    location.hash = '#/accounts';
    return null;
  }
  const st = { text: initialText, accountId: lsGet('qltc:lastAccount') || (accountOptions()[0] || {}).value || '', date: todayStr(), items: [] };
  const ta = h('textarea', { rows: 3, placeholder: 'cafe 25k, ăn trưa 45k; +lương 10,9tr; grab 38k', value: initialText });
  const list = h('div', { class: 'qa-list' });
  const info = h('p', { class: 'field-hint' });
  const catByName = (name, type) => store.all('categories').find((c) => c.type === type && c.name === name);
  const nameOf = (id) => (partyById(id) || {}).name || '?';

  const body = h('div', { class: 'form' },
    field('Gõ nhiều khoản, ngăn bằng dấu phẩy, chấm phẩy hoặc xuống dòng', ta,
      'Thêm "+" ở đầu cho khoản thu. Gắn đơn vị: 12 usd, 300 rub. Mua đồ ăn cho người khác: chọn “Cộng nợ” ở khoản đó.'),
    h('div', { class: 'grid2' },
      field('Tài khoản', select(accountOptions(), st.accountId, (v) => { st.accountId = v; parse(); })),
      field('Ngày', h('input', { type: 'date', value: st.date, onchange: (e) => { st.date = e.target.value; } }))),
    info, list);

  const saveBtn = h('button', { class: 'btn primary', onclick: onSave }, 'Lưu tất cả');
  const m = modal({ title: 'Nhập nhanh', body, actions: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), saveBtn], wide: true });

  function parse() {
    const acc = accById(st.accountId);
    const parsed = parseQuick(ta.value, { defaultCurrency: acc ? acc.currency : 'VND' });
    // Gõ thêm chữ thì các khoản cũ giữ nguyên lựa chọn (danh mục, ghi chú, người chia nợ).
    const prev = new Map();
    for (const it of st.items) if (!it.error) prev.set(it.raw, [...(prev.get(it.raw) || []), it]);
    st.items = parsed.map((p) => {
      if (p.error) return p;
      const old = (prev.get(p.raw) || []).shift();
      const cat = p.categoryName ? catByName(p.categoryName, p.kind) : null;
      const debt = old ? old.debt : newDebt();
      if (old && old.currency !== p.currency) { debt.manual = {}; debt.bad = {}; } // đổi tiền tệ → bỏ số nhập tay
      return {
        ...p,
        note: old ? old.note : p.note,
        categoryId: old ? old.categoryId : (cat ? cat.id : ''),
        debt,
        mismatch: acc && p.currency !== acc.currency,
      };
    });
    drawList();
  }

  function refreshInfo() {
    const ok = st.items.filter(itemOk);
    const bad = st.items.length - ok.length;
    info.textContent = st.items.length ? `${ok.length}/${st.items.length} khoản hợp lệ${bad ? ' — khoản màu đỏ sẽ không được lưu' : ''}` : '';
    saveBtn.disabled = !ok.length;
  }

  function drawList() {
    list.replaceChildren(...st.items.map((it) => (it.error
      ? h('div', { class: 'qa-row bad' }, h('span', {}, `“${it.raw}”`), h('span', { class: 'chip bad' }, it.error))
      : buildItem(it))));
    refreshInfo();
  }

  function buildItem(it) {
    const d = it.debt;
    const item = h('div', { class: 'qa-item' });
    const kindChip = h('span', { class: 'chip' });
    const catSel = select(categoryOptions(it.kind, '—'), it.categoryId, (v) => { it.categoryId = v; }, { 'aria-label': 'Danh mục' });
    const row = h('div', { class: 'qa-row' },
      kindChip,
      h('input', { type: 'text', value: it.note, 'aria-label': 'Ghi chú', oninput: (e) => { it.note = e.target.value; } }),
      h('strong', { class: 'mono' }, fmtMoney(it.amount, it.currency)),
      catSel,
      it.mismatch ? h('span', { class: 'chip bad' }, `≠ ${(accById(st.accountId) || {}).currency}`) : null,
      h('button', { class: 'icon-btn', 'aria-label': 'Bỏ khoản này', onclick: () => { st.items.splice(st.items.indexOf(it), 1); drawList(); } }, '✕'));
    const panel = h('div', { class: 'qa-share' });
    const bar = h('div', { class: 'qa-share-bar' },
      h('span', { class: 'sub' }, 'Chia cho người trong Vay nợ'),
      seg(SHARE_MODE_OPTS, d.mode, (v) => setMode(v)));
    item.append(row);
    if (!it.mismatch) item.append(bar, panel);

    const inputs = new Map();
    let amountBox = null;
    let summary = null;
    let resetBtn = null;

    function setMode(v) {
      d.mode = v;
      d.manual = {};
      d.bad = {};
      if (v !== 'none' && !d.partyIds.length) d.partyIds = lastSharePeople();
      buildPanel();
    }

    function togglePerson(id, on) {
      d.partyIds = on ? [...d.partyIds, id] : d.partyIds.filter((x) => x !== id);
      if (!on) { delete d.manual[id]; delete d.bad[id]; }
      drawAmounts();
      sync();
    }

    function onAmountInput(id, el) {
      const t = el.value.trim();
      delete d.bad[id];
      if (!t) delete d.manual[id];
      else {
        const r = parseExpr(t);
        if (r && r.total > 0) d.manual[id] = r.total; else { delete d.manual[id]; d.bad[id] = true; }
      }
      el.classList.toggle('bad', !!d.bad[id]);
      sync();
    }

    function drawAmounts() {
      inputs.clear();
      const debts = debtBalances(store.all('txs'));
      amountBox.replaceChildren(...d.partyIds.filter((id) => partyById(id)).map((id) => {
        const cur = (debts.get(id) || {})[it.currency] || 0;
        const now = cur > 0 ? `đang nợ mình ${fmtMoney(cur, it.currency)}` : cur < 0 ? `mình đang nợ ${fmtMoney(-cur, it.currency)}` : 'hiện chưa nợ';
        const inp = h('input', {
          type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `Phần của ${nameOf(id)}`,
          oninput: (e) => onAmountInput(id, e.target),
          onchange: (e) => { if (d.bad[id]) { delete d.bad[id]; e.target.classList.remove('bad'); } sync(true); },
        });
        inputs.set(id, inp);
        return h('label', { class: 'qa-amt' },
          h('span', { class: 'qa-who' }, h('b', {}, nameOf(id)), h('span', { class: 'sub' }, now)),
          inp, h('span', { class: 'qa-cur mono' }, (CUR_INFO[it.currency] || {}).symbol || it.currency));
      }));
    }

    function buildPanel() {
      panel.replaceChildren();
      panel.hidden = d.mode === 'none';
      inputs.clear();
      if (d.mode !== 'none') {
        const people = sharePartyList();
        const pick = (p) => {
          const on = d.partyIds.includes(p.id);
          const cb = h('input', { type: 'checkbox', checked: on, onchange: (e) => { lab.classList.toggle('on', e.target.checked); togglePerson(p.id, e.target.checked); } });
          const lab = h('label', { class: `pick${on ? ' on' : ''}` }, cb, p.name);
          return lab;
        };
        amountBox = h('div', { class: 'qa-amounts' });
        summary = h('p', { class: 'field-hint qa-sum' });
        resetBtn = h('button', { type: 'button', class: 'btn small ghost', onclick: () => { d.manual = {}; d.bad = {}; sync(true); } }, 'Chia đều lại');
        panel.append(...[
          h('p', { class: 'field-hint' }, d.mode === 'add'
            ? 'Mình trả hết số tiền này; những người được chọn nợ mình phần của họ.'
            : 'Những người được chọn đưa tiền cho mình; nợ của họ giảm đúng số đó.'),
          h('div', { class: 'qa-people' },
            ...people.map(pick),
            h('button', { type: 'button', class: 'chip muted qa-addp', onclick: () => openPartyForm({ onSaved: (p) => { d.partyIds = [...d.partyIds, p.id]; buildPanel(); } }) }, '＋ Thêm người')),
          people.length ? null : h('p', { class: 'field-hint' }, 'Chưa có ai trong danh sách Vay nợ — bấm “＋ Thêm người”.'),
          d.mode === 'add'
            ? h('label', { class: 'check' },
              h('input', { type: 'checkbox', checked: d.includeMe, onchange: (e) => { d.includeMe = e.target.checked; lsSet(SHARE_ME_KEY, d.includeMe ? '1' : '0'); sync(true); } }),
              ' Tính cả phần của mình (ghi thành chi tiêu của mình)')
            : null,
          amountBox, summary,
          h('div', { class: 'qa-share-actions' },
            resetBtn,
            h('button', { type: 'button', class: 'btn small ghost', onclick: () => applyToAll() }, 'Dùng cho tất cả khoản')),
        ].filter(Boolean));
        drawAmounts();
      }
      sync(true);
    }

    /** Cập nhật phần động (chip, tóm tắt, ô số tiền) mà không dựng lại ô đang gõ. */
    function sync(refill = false) {
      const plan = planOf(it);
      const active = d.mode !== 'none';
      kindChip.textContent = d.mode === 'add' ? 'Nợ +' : d.mode === 'sub' ? 'Nợ −' : it.kind === 'income' ? 'Thu' : 'Chi';
      kindChip.className = `chip ${d.mode === 'add' ? 'warn' : d.mode === 'sub' || it.kind === 'income' ? 'good' : ''}`;
      catSel.hidden = d.mode === 'sub' || (d.mode === 'add' && !d.includeMe);
      item.classList.toggle('bad', !!it.mismatch || (active && !plan.ok));
      if (active) {
        for (const [id, inp] of inputs) {
          const isManual = id in d.manual;
          inp.classList.toggle('auto', !isManual);
          if (document.activeElement === inp && !refill) continue; // đang gõ → không đụng vào
          if (isManual) inp.value = String(d.manual[id]);
          else inp.value = plan.ok ? String(plan.shares[id]) : '';
        }
        summary.textContent = describeShare({ mode: d.mode, amount: it.amount, currency: it.currency, plan, nameOf });
        summary.classList.toggle('bad', !plan.ok);
        resetBtn.hidden = !Object.keys(d.manual).length;
      }
      refreshInfo();
    }

    function applyToAll() {
      const others = st.items.filter((x) => x !== it && !x.error && !x.mismatch);
      if (!others.length) { toast('Chỉ có một khoản.', 'info'); return; }
      for (const x of others) {
        x.debt.mode = d.mode;
        x.debt.partyIds = [...d.partyIds];
        x.debt.includeMe = d.includeMe;
        x.debt.manual = {};
        x.debt.bad = {};
      }
      drawList();
      toast(`Đã áp dụng cho ${others.length} khoản khác.`, 'ok');
    }

    buildPanel();
    return item;
  }

  async function onSave() {
    const ok = st.items.filter(itemOk);
    if (!ok.length) return;
    const acc = accById(st.accountId);
    const docs = [];
    let n = 0;
    let shared = 0;
    let lastPeople = null;
    for (const i of ok) {
      const ts = () => Date.now() + (n += 1);
      if (i.debt.mode === 'none') {
        docs.push({ date: st.date, kind: i.kind, amount: i.amount, currency: acc.currency, accountId: acc.id, categoryId: i.categoryId || '', note: i.note, ts: ts() });
      } else {
        const plan = planOf(i);
        for (const t of buildShareTxs({ mode: i.debt.mode, plan, date: st.date, currency: acc.currency, accountId: acc.id, note: i.note, categoryId: i.categoryId, nameOf })) docs.push({ ...t, ts: ts() });
        shared += 1;
        lastPeople = i.debt.partyIds;
      }
    }
    try {
      await store.putMany('txs', docs);
      lsSet('qltc:lastAccount', acc.id);
      if (lastPeople) lsSet(SHARE_PEOPLE_KEY, JSON.stringify(lastPeople));
      m.close();
      toast(shared ? `Đã lưu ${docs.length} giao dịch (${shared} khoản gắn với Vay nợ).` : `Đã lưu ${docs.length} giao dịch.`, 'ok');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  ta.addEventListener('input', () => parse());
  parse();
  ta.focus();
  return m;
}

/* ───────────────────────── Tài khoản ───────────────────────── */
export function openAccountForm(a = null, { onSaved } = {}) {
  const used = a ? store.all('txs').some((t) => t.accountId === a.id || t.toAccountId === a.id) : false;
  const st = {
    name: a ? a.name : '', kind: a ? a.kind : 'bank', currency: a ? a.currency : 'VND',
    networth: a ? a.networth !== false : true, archived: a ? !!a.archived : false,
  };
  const opening = moneyInput({ value: a ? a.opening || '' : '', currency: st.currency });
  const root = h('div', { class: 'form' },
    field('Tên tài khoản', h('input', { type: 'text', value: st.name, placeholder: 'Ví dụ: Thẻ MB, Gazprom…', oninput: (e) => { st.name = e.target.value; } })),
    h('div', { class: 'grid2' },
      field('Loại', select(Object.entries(ACCOUNT_KINDS).map(([value, label]) => ({ value, label })), st.kind, (v) => { st.kind = v; })),
      field('Tiền tệ', select(currencyOptions, st.currency, (v) => { st.currency = v; opening.setCurrency(v); }, { disabled: used }))),
    used ? h('p', { class: 'field-hint' }, 'Đã có giao dịch nên không đổi được tiền tệ.') : null,
    field('Số dư đầu kỳ', opening.el, 'Số dư ghi nhận trước giao dịch đầu tiên. Số dư hiện tại luôn được tính từ đây + giao dịch.'),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.networth, onchange: (e) => { st.networth = e.target.checked; } }), ' Tính vào tổng tài sản'),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.archived, onchange: (e) => { st.archived = e.target.checked; } }), ' Ẩn (lưu trữ) tài khoản này'));
  const actions = [];
  if (a && !used) actions.push(h('button', { class: 'btn danger-ghost', onclick: async () => {
    if (!(await confirmBox(`Xóa tài khoản “${a.name}”?`, { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('accounts', a.id); m.close(); toast('Đã xóa tài khoản.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Xóa'));
  actions.push(h('span', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: async () => {
    if (!st.name.trim()) return toast('Nhập tên tài khoản.', 'error');
    const op = opening.get();
    try {
      const d = await store.put('accounts', {
        ...(a || {}), name: st.name.trim(), kind: st.kind, currency: st.currency,
        opening: Number.isNaN(op) ? 0 : op, networth: st.networth, archived: st.archived,
      });
      m.close();
      toast('Đã lưu tài khoản.', 'ok');
      if (onSaved) onSaved(d);
    } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Lưu'));
  root.append(h('div', { class: 'sheet-foot inline' }, actions));
  const m = modal({ title: a ? 'Sửa tài khoản' : 'Thêm tài khoản', body: root });
  return m;
}

/** Nhập số dư thực tế → tạo giao dịch "Điều chỉnh" cho đúng phần chênh. */
export function openReconcile(a) {
  const bal = accountBalances(store.all('accounts'), store.all('txs')).get(a.id) || 0;
  const real = moneyInput({ value: bal, currency: a.currency });
  const diffEl = h('p', { class: 'field-hint mono' });
  const upd = () => {
    const v = real.get();
    diffEl.textContent = Number.isNaN(v) ? '' : `Chênh lệch: ${fmtMoney(v - bal, a.currency, { sign: true })}`;
  };
  real.input.addEventListener('input', upd);
  upd();
  const m = modal({
    title: `Điều chỉnh số dư — ${a.name}`,
    body: h('div', { class: 'form' },
      h('p', {}, 'Số dư theo sổ: ', h('strong', { class: 'mono' }, money(bal, a.currency))),
      field(`Số dư thực tế (${a.currency})`, real.el, 'Nhập số bạn thấy trong ngân hàng / ví. App tạo một giao dịch “Điều chỉnh” cho phần chênh.'),
      diffEl),
    actions: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: async () => {
      const v = real.get();
      if (Number.isNaN(v)) return toast('Nhập số dư thực tế.', 'error');
      const diff = v - bal;
      if (diff === 0) { m.close(); return toast('Số dư đã khớp.', 'ok'); }
      try {
        await store.put('txs', { date: todayStr(), kind: 'adjust', amount: diff, currency: a.currency, accountId: a.id, note: 'Điều chỉnh số dư' });
        m.close();
        toast('Đã điều chỉnh.', 'ok');
      } catch (e) { toast(errMsg(e), 'error'); }
    } }, 'Điều chỉnh')],
  });
}

/* ───────────────────────── Đối tượng (người vay / khách / người nhà) ───────────────────────── */
export function openPartyForm(p = null, opts = {}) {
  if (p && p.nodeType === undefined && p.onSaved) { opts = p; p = null; } // gọi openPartyForm({ onSaved })
  const st = { name: p ? p.name : '', role: p ? p.role || 'person' : opts.role || 'person', note: p ? p.note || '' : '' };
  const used = p ? (store.all('txs').some((t) => t.partyId === p.id) || store.all('deals').some((d) => d.partyId === p.id)) : false;
  const root = h('div', { class: 'form' },
    field('Tên', h('input', { type: 'text', value: st.name, oninput: (e) => { st.name = e.target.value; } })),
    field('Vai trò', select(Object.entries(PARTY_ROLES).map(([value, label]) => ({ value, label })), st.role, (v) => { st.role = v; })),
    field('Ghi chú', h('input', { type: 'text', value: st.note, oninput: (e) => { st.note = e.target.value; } })));
  const actions = [];
  if (p && !used) actions.push(h('button', { class: 'btn danger-ghost', onclick: async () => {
    if (!(await confirmBox(`Xóa “${p.name}”?`, { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('parties', p.id); m.close(); toast('Đã xóa.', 'ok'); if (opts.onDeleted) opts.onDeleted(); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Xóa'));
  actions.push(h('span', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: async () => {
    if (!st.name.trim()) return toast('Nhập tên.', 'error');
    try {
      const d = await store.put('parties', { ...(p || {}), name: st.name.trim(), role: st.role, note: st.note.trim() });
      m.close();
      toast('Đã lưu.', 'ok');
      if (opts.onSaved) opts.onSaved(d);
    } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Lưu'));
  root.append(h('div', { class: 'sheet-foot inline' }, actions));
  const m = modal({ title: p ? 'Sửa thông tin' : 'Thêm người / đối tượng', body: root });
  return m;
}

export { DEBT_KINDS, DEBT_SIGN };
