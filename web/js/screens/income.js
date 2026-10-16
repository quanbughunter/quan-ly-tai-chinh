// Thu nhập: mọi khoản tiền mình kiếm được (lương, học bổng, lãi đổi tiền…) ở một chỗ.
// Chỉ lấy giao dịch kind "income" của MỌI tài khoản; nhận trả nợ / đi vay không phải thu nhập nên không có ở đây.

import { h, money, select, emptyState, progress, fmtPct } from '../ui.js';
import { store } from '../store.js';
import { filterTxs, groupByDate, incomeStats } from '../calc.js';
import { todayStr, addMonths, monthLabel, monthRange, fmtDayLong } from '../dates.js';
import { card, pageHead, txRow, currencyChips } from '../components.js';
import { openTxForm, openQuickAdd, accountOptions, categoryOptions } from '../forms.js';

// Bộ lọc giữ nguyên khi chuyển màn hình rồi quay lại.
const F = { month: todayStr().slice(0, 7), all: false, accountId: '', categoryId: '' };

export function render(root) {
  const rates = store.settings().rates;

  root.append(pageHead('Thu nhập', h('button', { class: 'btn primary', onclick: () => openQuickAdd('', { income: true }) }, '＋ Thêm khoản thu')));

  const redo = () => { root.replaceChildren(); render(root); };
  const monthNav = h('div', { class: 'month-nav' },
    h('button', { class: 'icon-btn', 'aria-label': 'Tháng trước', disabled: F.all, onclick: () => { F.month = addMonths(F.month, -1); redo(); } }, '‹'),
    h('strong', {}, F.all ? 'Tất cả thời gian' : monthLabel(F.month)),
    h('button', { class: 'icon-btn', 'aria-label': 'Tháng sau', disabled: F.all, onclick: () => { F.month = addMonths(F.month, 1); redo(); } }, '›'));

  const filters = h('div', { class: 'filters' },
    select([{ value: '', label: 'Mọi tài khoản' }, ...accountOptions({ includeArchived: true })], F.accountId, (v) => { F.accountId = v; paint(); }),
    select(categoryOptions('income', 'Mọi nguồn thu'), F.categoryId, (v) => { F.categoryId = v; paint(); }),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: F.all, onchange: (e) => { F.all = e.target.checked; redo(); } }), ' Tất cả thời gian'));

  const summary = h('div', { class: 'triple small' });
  const info = h('div', { class: 'chips' });
  const bySource = h('div', {});
  const list = h('div', { class: 'tx-list' });
  root.append(monthNav, filters, summary, info, bySource, list);

  function paint() {
    const range = F.all ? {} : monthRange(F.month);
    const q = { ...range, accountId: F.accountId, categoryId: F.categoryId };
    const txs = store.all('txs');
    const stats = incomeStats(txs, q, rates);

    summary.replaceChildren(
      h('div', {}, h('span', {}, 'Tổng thu'), h('strong', { class: 'mono pos' }, money(stats.total, 'VND', { compact: true }))),
      h('div', {}, h('span', {}, 'Số khoản'), h('strong', { class: 'mono' }, String(stats.count))),
      h('div', {}, h('span', {}, 'Trung bình / khoản'), h('strong', { class: 'mono' }, money(stats.count ? stats.total / stats.count : 0, 'VND', { compact: true }))));

    const cur = Object.keys(stats.byCur);
    info.replaceChildren(
      ...(cur.length > 1 || (cur.length === 1 && cur[0] !== 'VND') ? currencyChips(stats.byCur) : []),
      ...(stats.missing.length ? [h('a', { class: 'chip warn', href: '#/settings' }, `Thiếu tỷ giá ${stats.missing.join(', ')} — chưa tính vào tổng`)] : []));
    info.hidden = !info.childNodes.length;

    if (stats.cats.length > 1 || (stats.cats.length === 1 && !F.categoryId)) {
      bySource.replaceChildren(card('Theo nguồn thu', h('div', { class: 'budgets' }, stats.cats.map((c) => {
        const cat = c.categoryId !== '_none' ? store.byId('categories', c.categoryId) : null;
        const pct = stats.total > 0 ? c.amount / stats.total : 0;
        return h('div', { class: 'budget' },
          h('div', { class: 'budget-top' },
            h('span', {}, cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Chưa phân loại'),
            h('span', { class: 'mono' }, `${money(c.amount, 'VND', { compact: true })} · ${fmtPct(pct)}`)),
          progress(pct, { warn: 2 }));
      }))));
    } else bySource.replaceChildren();

    const items = filterTxs(txs, { ...q, kind: 'income' });
    if (!items.length) {
      list.replaceChildren(emptyState(F.all ? 'Chưa có khoản thu nào.' : 'Tháng này chưa có khoản thu nào. Bấm “＋ Thêm khoản thu” để ghi lương, học bổng, tiền làm thêm…'));
      return;
    }
    list.replaceChildren(...groupByDate(items, rates).map((g) => h('section', { class: 'day' },
      h('div', { class: 'day-head' }, h('span', {}, fmtDayLong(g.date)), h('span', { class: 'mono sub' }, g.income ? `+${money(g.income, 'VND', { compact: true })}` : '')),
      h('div', { class: 'list' }, g.items.map((t) => txRow(t, { onClick: () => openTxForm({ tx: t }) }))))));
  }
  paint();
}
