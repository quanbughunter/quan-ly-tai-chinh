import { h, money, chip, emptyState } from '../ui.js';
import { store } from '../store.js';
import { accountBalances } from '../calc.js';
import { ACCOUNT_KINDS } from '../model.js';
import { CURRENCIES } from '../money.js';
import { card, pageHead } from '../components.js';
import { openAccountForm, openReconcile, openTxForm } from '../forms.js';

let showArchived = false;

export function render(root) {
  const accounts = store.all('accounts');
  const txs = store.all('txs');
  const bal = accountBalances(accounts, txs);
  const counts = new Map();
  for (const t of txs) {
    for (const id of [t.accountId, t.toAccountId]) if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }

  root.append(pageHead('Tài khoản', [
    h('button', { class: 'btn', onclick: () => openTxForm({ group: 'transfer' }) }, '⇄ Chuyển / đổi'),
    h('button', { class: 'btn primary', onclick: () => openAccountForm() }, '＋ Thêm'),
  ]));

  const visible = accounts.filter((a) => showArchived || !a.archived);
  if (!accounts.length) {
    root.append(emptyState('Chưa có tài khoản. Tạo thẻ ngân hàng, ví tiền mặt, ví USDT… Mỗi tài khoản có một tiền tệ riêng.', h('button', { class: 'btn primary', onclick: () => openAccountForm() }, '＋ Tạo tài khoản đầu tiên')));
    return;
  }

  const order = [...CURRENCIES, ...new Set(visible.map((a) => a.currency).filter((c) => !CURRENCIES.includes(c)))];
  for (const cur of order) {
    const list = visible.filter((a) => a.currency === cur).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
    if (!list.length) continue;
    const total = list.filter((a) => a.networth !== false).reduce((s, a) => s + (bal.get(a.id) || 0), 0);
    root.append(card(cur, h('div', { class: 'list' }, list.map((a) => accountRow(a, bal.get(a.id) || 0, counts.get(a.id) || 0))), {
      right: h('strong', { class: 'mono' }, money(total, cur)),
    }));
  }

  if (accounts.some((a) => a.archived)) {
    root.append(h('label', { class: 'check center' }, h('input', { type: 'checkbox', checked: showArchived, onchange: (e) => { showArchived = e.target.checked; root.replaceChildren(); render(root); } }), ' Hiện tài khoản đã ẩn'));
  }
}

function accountRow(a, balance, n) {
  return h('div', { class: `row account${a.archived ? ' archived' : ''}` },
    h('a', { class: 'row-main link-plain', href: `#/tx?account=${a.id}` },
      h('span', { class: 'row-title' }, a.name, a.networth === false ? chip('không tính tài sản', 'muted') : null),
      h('span', { class: 'sub' }, `${ACCOUNT_KINDS[a.kind] || a.kind} · ${n} giao dịch`)),
    h('span', { class: `row-right amt mono ${balance < 0 ? 'neg' : ''}` }, money(balance, a.currency)),
    h('span', { class: 'row-actions' },
      h('button', { class: 'btn small ghost', title: 'Nhập số dư thực tế', onclick: () => openReconcile(a) }, '≈ Khớp số dư'),
      h('button', { class: 'btn small ghost', onclick: () => openAccountForm(a) }, 'Sửa')));
}
