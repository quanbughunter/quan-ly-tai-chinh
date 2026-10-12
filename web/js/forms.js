// Các biểu mẫu dùng chung: giao dịch, nhập nhanh, tài khoản, đối tượng (người vay / khách).

import { h, modal, field, select, seg, moneyInput, currencyOptions, toast, errMsg, confirmBox, money } from './ui.js';
import { store } from './store.js';
import { TX_KINDS, ACCOUNT_KINDS, PARTY_ROLES } from './model.js';
import { todayStr } from './dates.js';
import { accountBalances, DEBT_SIGN } from './calc.js';
import { parseQuick } from './quickadd.js';
import { fmtMoney, fmtNum } from './money.js';
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
    currency: t ? t.currency : 'VND',
    partyId: t ? t.partyId || '' : init.partyId || '',
    categoryId: t ? t.categoryId || '' : '',
    note: t ? t.note || '' : '',
  };
  const root = h('div', { class: 'form' });
  const m = modal({ title: t ? 'Sửa giao dịch' : 'Thêm giao dịch', body: root, actions: [] });
  let amountCtl;
  let toAmountCtl;

  const kindOf = () => (st.group === 'debt' ? st.debtKind : st.group);
  const acc = () => accById(st.accountId);

  function draw() {
    const kids = [];
    kids.push(seg(GROUPS, st.group, (v) => { st.group = v; if (v !== 'debt' && !st.accountId) st.accountId = defAcc; draw(); }));
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
    const cur = a ? a.currency : st.currency;
    amountCtl = moneyInput({ value: st.amount, currency: cur, onChange: (v) => { st.amount = Number.isNaN(v) ? '' : v; } });
    const amtLabel = st.group === 'adjust' ? 'Số tiền điều chỉnh (+ hoặc −)' : 'Số tiền';
    if (!a && st.group === 'debt') {
      kids.push(field('Tiền tệ', select(currencyOptions, st.currency, (v) => { st.currency = v; amountCtl.setCurrency(v); })));
    }
    kids.push(field(`${amtLabel}${a ? ` (${cur})` : ''}`, amountCtl.el, 'Gõ được: 25k, 1,5tr, 3tr+500k'));

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
    if (kind === 'adjust') { if (!amount) return toast('Nhập số tiền điều chỉnh khác 0.', 'error'); } else if (!(amount > 0)) return toast('Nhập số tiền lớn hơn 0.', 'error');
    if (!st.date) return toast('Chọn ngày.', 'error');
    if (kind !== 'lend' && kind !== 'repay_in' && kind !== 'borrow' && kind !== 'repay_out' && !a) return toast('Chọn tài khoản.', 'error');
    if (st.group === 'debt' && !st.partyId) return toast('Chọn người liên quan đến khoản vay nợ.', 'error');
    const doc = {
      id: t ? t.id : undefined, ts: t ? t.ts : undefined,
      date: st.date, kind, amount, currency: a ? a.currency : st.currency,
      accountId: a ? a.id : '', note: st.note.trim(),
    };
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

  const body = h('div', { class: 'form' },
    field('Gõ nhiều khoản, ngăn bằng dấu phẩy, chấm phẩy hoặc xuống dòng', ta, 'Thêm "+" ở đầu cho khoản thu. Gắn đơn vị: 12 usd, 300 rub.'),
    h('div', { class: 'grid2' },
      field('Tài khoản', select(accountOptions(), st.accountId, (v) => { st.accountId = v; parse(); })),
      field('Ngày', h('input', { type: 'date', value: st.date, onchange: (e) => { st.date = e.target.value; } }))),
    info, list);

  const saveBtn = h('button', { class: 'btn primary', onclick: onSave }, 'Lưu tất cả');
  const m = modal({ title: 'Nhập nhanh', body, actions: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), saveBtn], wide: true });

  function parse() {
    const acc = accById(st.accountId);
    const parsed = parseQuick(ta.value, { defaultCurrency: acc ? acc.currency : 'VND' });
    st.items = parsed.map((p) => {
      if (p.error) return p;
      const cat = p.categoryName ? catByName(p.categoryName, p.kind) : null;
      return { ...p, categoryId: cat ? cat.id : '', mismatch: acc && p.currency !== acc.currency };
    });
    drawList();
  }

  function drawList() {
    const ok = st.items.filter((i) => !i.error && !i.mismatch);
    info.textContent = st.items.length ? `${ok.length}/${st.items.length} khoản hợp lệ` : '';
    saveBtn.disabled = !ok.length;
    list.replaceChildren(...st.items.map((it, idx) => {
      if (it.error) return h('div', { class: 'qa-row bad' }, h('span', {}, `“${it.raw}”`), h('span', { class: 'chip bad' }, it.error));
      const typeOf = it.kind;
      return h('div', { class: `qa-row${it.mismatch ? ' bad' : ''}` },
        h('span', { class: `chip ${it.kind === 'income' ? 'good' : ''}` }, it.kind === 'income' ? 'Thu' : 'Chi'),
        h('input', { type: 'text', value: it.note, 'aria-label': 'Ghi chú', oninput: (e) => { it.note = e.target.value; } }),
        h('strong', { class: 'mono' }, fmtMoney(it.amount, it.currency)),
        select(categoryOptions(typeOf, '—'), it.categoryId, (v) => { it.categoryId = v; }, { 'aria-label': 'Danh mục' }),
        it.mismatch ? h('span', { class: 'chip bad' }, `≠ ${(accById(st.accountId) || {}).currency}`) : null,
        h('button', { class: 'icon-btn', 'aria-label': 'Bỏ khoản này', onclick: () => { st.items.splice(idx, 1); drawList(); } }, '✕'));
    }));
  }

  async function onSave() {
    const ok = st.items.filter((i) => !i.error && !i.mismatch);
    if (!ok.length) return;
    const acc = accById(st.accountId);
    try {
      await store.putMany('txs', ok.map((i, n) => ({
        date: st.date, kind: i.kind, amount: i.amount, currency: acc.currency, accountId: acc.id,
        categoryId: i.categoryId || '', note: i.note, ts: Date.now() + n,
      })));
      lsSet('qltc:lastAccount', acc.id);
      m.close();
      toast(`Đã lưu ${ok.length} giao dịch.`, 'ok');
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
