import { h, svg, money, chip, donut, barPairs, progress, fmtPct, emptyState, toast, errMsg } from '../ui.js';

/** Con mắt đơn giản: đang hiện số = mắt mở; đang ẩn = mắt có gạch chéo. */
const eyeIcon = (slashed) => svg('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
  svg('path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z' }),
  svg('circle', { cx: 12, cy: 12, r: 3 }),
  slashed ? svg('path', { d: 'M4 4l16 16' }) : null);
import { store } from '../store.js';
import { overview, periodStats, monthlySeries, budgetStatus } from '../calc.js';
import { statusOf, dealProfit } from '../deals.js';
import { todayStr, monthLabel, monthRange } from '../dates.js';
import { COLORS } from '../model.js';
import { card, pageHead, currencyChips } from '../components.js';
import { openQuickAdd, openAccountForm } from '../forms.js';
import { seedDemo } from '../demo.js';

export function render(root) {
  const s = store.settings();
  const rates = s.rates;
  const accounts = store.all('accounts');
  const txs = store.all('txs');
  const month = todayStr().slice(0, 7);

  const eye = h('button', { class: 'icon-btn', type: 'button', 'aria-label': s.hideAmounts ? 'Hiện số dư' : 'Ẩn số dư', 'aria-pressed': s.hideAmounts ? 'true' : 'false', title: s.hideAmounts ? 'Hiện số dư' : 'Ẩn số dư', onclick: () => store.saveSettings({ hideAmounts: !s.hideAmounts }) }, eyeIcon(!!s.hideAmounts));
  root.append(pageHead('Tổng quan', eye));

  const qaInput = h('input', { type: 'text', placeholder: 'Nhập nhanh: cafe 25k, ăn trưa 45k, +lương 10tr…', 'aria-label': 'Nhập nhanh' });
  root.append(h('form', { class: 'quickbar', onsubmit: (e) => { e.preventDefault(); openQuickAdd(qaInput.value); qaInput.value = ''; } }, qaInput, h('button', { class: 'btn primary', type: 'submit' }, 'Thêm')));

  if (!accounts.length) {
    root.append(card('Bắt đầu', h('div', { class: 'onboard' },
      emptyState('Chưa có tài khoản nào. Hãy tạo tài khoản đầu tiên (ví dụ: Thẻ MB, Tiền mặt).'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: () => openAccountForm() }, '＋ Tạo tài khoản'),
        h('button', { class: 'btn', onclick: () => { location.hash = '#/settings'; } }, 'Nhập dữ liệu từ file'),
        store.mode === 'local' ? h('button', { class: 'btn ghost', onclick: async () => { try { await seedDemo(); toast('Đã tạo dữ liệu mẫu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); } } }, 'Tạo dữ liệu mẫu') : null))));
    return;
  }

  const ov = overview({ accounts, txs, rates });
  const b = ov.base;
  const nwCard = h('div', { class: 'networth' },
    h('div', { class: 'nw-label' }, 'Tổng tài sản ròng (quy ra ₫)'),
    h('div', { class: 'nw-value mono' }, money(b.net, 'VND', { compact: true })),
    h('div', { class: 'nw-split' },
      h('div', {}, h('span', {}, 'Tiền thật'), h('strong', { class: 'mono' }, money(b.cash, 'VND', { compact: true }))),
      h('div', {}, h('span', {}, 'Đang cho vay'), h('strong', { class: 'mono' }, money(b.receivable, 'VND', { compact: true }))),
      h('div', {}, h('span', {}, 'Đang nợ'), h('strong', { class: 'mono neg' }, money(b.payable, 'VND', { compact: true })))),
    h('div', { class: 'chips' }, currencyChips(ov.cash)),
    ov.missing.length ? h('a', { class: 'chip warn', href: '#/settings' }, `Thiếu tỷ giá ${ov.missing.join(', ')} — chỉnh trong Cài đặt`) : null);
  root.append(card(null, nwCard, { cls: 'hero' }));

  // Tháng này
  const st = periodStats(txs, monthRange(month), rates);
  const cats = st.cats.slice(0, 6);
  const other = st.cats.slice(6).reduce((x, c) => x + c.amount, 0);
  const slices = cats.map((c, i) => {
    const cat = c.categoryId !== '_none' ? store.byId('categories', c.categoryId) : null;
    return { label: cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Chưa phân loại', value: c.amount, color: COLORS[i % COLORS.length] };
  });
  if (other > 0) slices.push({ label: 'Khác', value: other, color: '#c9cee0' });
  const monthBody = h('div', {},
    h('div', { class: 'triple' },
      h('div', {}, h('span', {}, 'Thu'), h('strong', { class: 'mono pos' }, money(st.income, 'VND', { compact: true }))),
      h('div', {}, h('span', {}, 'Chi'), h('strong', { class: 'mono neg' }, money(st.expense, 'VND', { compact: true }))),
      h('div', {}, h('span', {}, 'Còn lại'), h('strong', { class: `mono ${st.net >= 0 ? 'pos' : 'neg'}` }, money(st.net, 'VND', { compact: true, sign: true })))),
    slices.length
      ? h('div', { class: 'donut-wrap' }, donut(slices), h('ul', { class: 'legend' }, slices.map((d) => h('li', {}, h('i', { style: { background: d.color } }), h('span', {}, d.label), h('b', { class: 'mono' }, money(d.value, 'VND', { compact: true }))))))
      : emptyState('Tháng này chưa có khoản chi nào.'));
  root.append(card(monthLabel(month), monthBody, { right: h('span', { class: 'links' }, h('a', { class: 'link', href: '#/income' }, 'Thu nhập ›'), ' ', h('a', { class: 'link', href: '#/tx' }, 'Giao dịch ›')) }));

  // Ngân sách
  const budgets = store.all('budgets');
  if (budgets.length) {
    const bs = budgetStatus(budgets, st.cats, rates).sort((x, y) => y.pct - x.pct).slice(0, 5);
    root.append(card('Ngân sách tháng', h('div', { class: 'budgets' }, bs.map((x) => {
      const cat = x.budget.categoryId ? store.byId('categories', x.budget.categoryId) : null;
      return h('div', { class: 'budget' },
        h('div', { class: 'budget-top' }, h('span', {}, cat ? `${cat.icon || ''} ${cat.name}` : 'Tổng chi'), h('span', { class: `mono ${x.pct > 1 ? 'neg' : ''}` }, `${money(x.spent, 'VND', { compact: true })} / ${money(x.limit, 'VND', { compact: true })} · ${fmtPct(x.pct)}`)),
        progress(x.pct));
    })), { right: h('a', { class: 'link', href: '#/settings' }, 'Chỉnh ›') }));
  }

  // 6 tháng
  const series = monthlySeries(txs, month, 6, rates);
  root.append(card('6 tháng gần nhất', h('div', {},
    barPairs(series.map((x) => ({ label: `T${Number(x.month.slice(5))}`, title: monthLabel(x.month), a: x.income, b: x.expense })), { cur: s.baseCurrency }))));

  // Công nợ
  const debtRows = [...ov.debts.entries()].map(([pid, o]) => ({ party: store.byId('parties', pid), o }))
    .filter((x) => x.party && Object.values(x.o).some((v) => Math.abs(v) > 1e-9))
    .sort((x, y) => Math.max(...Object.values(y.o).map(Math.abs)) - Math.max(...Object.values(x.o).map(Math.abs)))
    .slice(0, 5);
  if (debtRows.length) {
    root.append(card('Công nợ', h('div', { class: 'list' }, debtRows.map((x) => h('a', { class: 'row', href: `#/debts/${x.party.id}` },
      h('span', { class: 'row-ico' }, '👤'),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x.party.name)),
      h('span', { class: 'row-right' }, currencyChips(x.o, { signed: true }))))), { right: h('a', { class: 'link', href: '#/debts' }, 'Tất cả ›') }));
  }

  // Lãi đổi tiền tháng này (chỉ tính các lệnh đã chốt)
  const deals = store.all('deals').filter((d) => statusOf(d) === 'done' && (d.date || '').startsWith(month));
  const waiting = store.all('deals').filter((d) => statusOf(d) === 'quote').length;
  if (deals.length || waiting) {
    const profit = deals.reduce((sum, d) => sum + (dealProfit(d, s.params) || 0), 0);
    root.append(card('Báo tỉ giá tháng này', h('div', { class: 'triple' },
      h('div', {}, h('span', {}, 'Đã chốt'), h('strong', { class: 'mono' }, String(deals.length))),
      h('div', {}, h('span', {}, 'Lãi'), h('strong', { class: `mono ${profit >= 0 ? 'pos' : 'neg'}` }, money(profit, 'VND', { compact: true, sign: true }))),
      h('div', {}, h('span', {}, 'Chờ chốt'), h('strong', { class: 'mono' }, String(waiting)))),
    { right: h('a', { class: 'link', href: '#/fx' }, 'Mở ›') }));
  }
}
