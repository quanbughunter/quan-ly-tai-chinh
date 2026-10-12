import { h, money, select, debounce, emptyState } from '../ui.js';
import { store } from '../store.js';
import { filterTxs, groupByDate, toBase } from '../calc.js';
import { todayStr, addMonths, monthLabel, monthRange, fmtDayLong } from '../dates.js';
import { TX_KINDS } from '../model.js';
import { pageHead, txRow } from '../components.js';
import { openTxForm, accountOptions, categoryOptions } from '../forms.js';

// Bộ lọc giữ nguyên khi chuyển màn hình rồi quay lại.
const F = { month: todayStr().slice(0, 7), all: false, accountId: '', categoryId: '', kind: '', q: '' };

export function render(root, { params = {} } = {}) {
  if (params.account !== undefined) { F.accountId = params.account; F.all = true; }
  const rates = store.settings().rates;

  root.append(pageHead('Giao dịch', h('button', { class: 'btn primary', onclick: () => openTxForm() }, '＋ Thêm')));

  const list = h('div', { class: 'tx-list' });
  const summary = h('div', { class: 'triple small' });

  const monthNav = h('div', { class: 'month-nav' },
    h('button', { class: 'icon-btn', 'aria-label': 'Tháng trước', disabled: F.all, onclick: () => { F.month = addMonths(F.month, -1); redo(); } }, '‹'),
    h('strong', {}, F.all ? 'Tất cả thời gian' : monthLabel(F.month)),
    h('button', { class: 'icon-btn', 'aria-label': 'Tháng sau', disabled: F.all, onclick: () => { F.month = addMonths(F.month, 1); redo(); } }, '›'));

  const filters = h('div', { class: 'filters' },
    select([{ value: '', label: 'Mọi tài khoản' }, ...accountOptions({ includeArchived: true })], F.accountId, (v) => { F.accountId = v; paint(); }),
    select([{ value: '', label: 'Mọi danh mục' }, ...categoryOptions(null, 'Mọi danh mục').slice(1)], F.categoryId, (v) => { F.categoryId = v; paint(); }),
    select([{ value: '', label: 'Mọi loại' }, ...Object.entries(TX_KINDS).map(([value, label]) => ({ value, label }))], F.kind, (v) => { F.kind = v; paint(); }),
    h('input', { type: 'search', placeholder: 'Tìm ghi chú…', value: F.q, 'aria-label': 'Tìm ghi chú', oninput: debounce((e) => { F.q = e.target.value; paint(); }, 200) }),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: F.all, onchange: (e) => { F.all = e.target.checked; redo(); } }), ' Tất cả thời gian'));

  root.append(monthNav, filters, summary, list);

  function redo() { root.replaceChildren(); render(root, { params: {} }); }

  function paint() {
    const range = F.all ? {} : monthRange(F.month);
    const items = filterTxs(store.all('txs'), { ...range, accountId: F.accountId, categoryId: F.categoryId, kind: F.kind, q: F.q });
    let inc = 0;
    let exp = 0;
    for (const t of items) {
      const v = toBase(t.amount, t.currency, rates) ?? 0;
      if (t.kind === 'income') inc += v;
      else if (t.kind === 'expense') exp += v;
    }
    summary.replaceChildren(
      h('div', {}, h('span', {}, 'Thu'), h('strong', { class: 'mono pos' }, money(inc, 'VND', { compact: true }))),
      h('div', {}, h('span', {}, 'Chi'), h('strong', { class: 'mono neg' }, money(exp, 'VND', { compact: true }))),
      h('div', {}, h('span', {}, 'Chênh'), h('strong', { class: `mono ${inc - exp >= 0 ? 'pos' : 'neg'}` }, money(inc - exp, 'VND', { compact: true, sign: true }))));
    if (!items.length) { list.replaceChildren(emptyState('Không có giao dịch nào khớp bộ lọc.')); return; }
    const groups = groupByDate(items, rates);
    list.replaceChildren(...groups.map((g) => h('section', { class: 'day' },
      h('div', { class: 'day-head' }, h('span', {}, fmtDayLong(g.date)), h('span', { class: 'mono sub' }, [g.income ? `+${money(g.income, 'VND', { compact: true })}` : '', g.expense ? `−${money(g.expense, 'VND', { compact: true })}` : ''].filter(Boolean).join('  '))),
      h('div', { class: 'list' }, g.items.map((t) => txRow(t, { onClick: () => openTxForm({ tx: t }) }))))));
  }
  paint();
}
