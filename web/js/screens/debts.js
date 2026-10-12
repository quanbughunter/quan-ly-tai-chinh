import { h, money, chip, emptyState } from '../ui.js';
import { store } from '../store.js';
import { debtBalances, lastDebtDates, DEBT_SIGN } from '../calc.js';
import { fmtDate, daysBetween, todayStr } from '../dates.js';
import { TX_KINDS } from '../model.js';
import { card, pageHead, currencyChips, txRow } from '../components.js';
import { openTxForm, openPartyForm } from '../forms.js';
import { roundTo } from '../money.js';

let showSettled = false;

export function render(root, { params = {} } = {}) {
  if (params.id) return renderParty(root, params.id);
  const txs = store.all('txs');
  const debts = debtBalances(txs);
  const last = lastDebtDates(txs);

  root.append(pageHead('Vay nợ', [
    h('button', { class: 'btn', onclick: () => openPartyForm() }, '＋ Người mới'),
    h('button', { class: 'btn primary', onclick: () => openTxForm({ group: 'debt', kind: 'lend' }) }, '＋ Khoản vay nợ'),
  ]));

  const parties = store.all('parties').filter((p) => (p.role || 'person') === 'person' || (p.role === 'family') || debts.has(p.id));
  const rows = parties.map((p) => ({ p, o: debts.get(p.id) || {}, d: last.get(p.id) }))
    .filter((x) => showSettled || Object.values(x.o).some((v) => Math.abs(v) > 1e-9))
    .sort((a, b) => (b.d || '').localeCompare(a.d || ''));

  // Tổng theo tiền tệ
  const owedToMe = {};
  const iOwe = {};
  for (const o of debts.values()) for (const [c, v] of Object.entries(o)) {
    if (v > 0) owedToMe[c] = roundTo((owedToMe[c] || 0) + v, 6);
    else if (v < 0) iOwe[c] = roundTo((iOwe[c] || 0) - v, 6);
  }
  root.append(card(null, h('div', { class: 'duo' },
    h('div', {}, h('span', { class: 'sub' }, 'Người khác nợ mình'), h('div', { class: 'chips' }, currencyChips(owedToMe))),
    h('div', {}, h('span', { class: 'sub' }, 'Mình nợ người khác'), h('div', { class: 'chips' }, currencyChips(iOwe, { signed: false }))))));

  if (!rows.length) root.append(emptyState('Chưa có khoản vay nợ nào đang mở.'));
  else {
    root.append(card(null, h('div', { class: 'list' }, rows.map(({ p, o, d }) => {
      const age = d ? daysBetween(d, todayStr()) : null;
      return h('a', { class: 'row', href: `#/debts/${p.id}` },
        h('span', { class: 'row-ico' }, '👤'),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, p.name), h('span', { class: 'sub' }, d ? `Gần nhất ${fmtDate(d)}${age > 30 ? ` · ${age} ngày trước` : ''}` : 'Chưa có giao dịch')),
        h('span', { class: 'row-right' }, currencyChips(o, { signed: true })));
    }))));
  }
  root.append(h('label', { class: 'check center' }, h('input', { type: 'checkbox', checked: showSettled, onchange: (e) => { showSettled = e.target.checked; root.replaceChildren(); render(root, { params }); } }), ' Hiện cả người đã tất toán'));
}

function renderParty(root, id) {
  const p = store.byId('parties', id);
  if (!p) { root.append(pageHead('Vay nợ'), emptyState('Không tìm thấy người này.', h('a', { class: 'btn', href: '#/debts' }, '‹ Quay lại'))); return; }
  const txs = store.all('txs').filter((t) => t.partyId === id && DEBT_SIGN[t.kind])
    .sort((a, b) => (a.date === b.date ? (a.ts || 0) - (b.ts || 0) : a.date < b.date ? -1 : 1));
  const run = {};
  const withRun = txs.map((t) => {
    run[t.currency] = roundTo((run[t.currency] || 0) + DEBT_SIGN[t.kind] * t.amount, 6);
    return { t, run: { ...run } };
  });

  root.append(pageHead(p.name, [
    h('a', { class: 'btn ghost', href: '#/debts' }, '‹ Quay lại'),
    h('button', { class: 'btn ghost', onclick: () => openPartyForm(p, { onDeleted: () => { location.hash = '#/debts'; } }) }, 'Sửa'),
  ]));
  root.append(card('Số dư hiện tại', h('div', {},
    h('div', { class: 'chips big' }, currencyChips(run, { signed: true })),
    h('p', { class: 'sub' }, 'Dương: người này nợ mình. Âm: mình nợ người này. Tính riêng từng tiền tệ.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => openTxForm({ group: 'debt', kind: 'lend', partyId: id }) }, '↗ Cho vay thêm'),
      h('button', { class: 'btn', onclick: () => openTxForm({ group: 'debt', kind: 'repay_in', partyId: id }) }, '↙ Nhận trả'),
      h('button', { class: 'btn', onclick: () => openTxForm({ group: 'debt', kind: 'borrow', partyId: id }) }, '↘ Đi vay'),
      h('button', { class: 'btn', onclick: () => openTxForm({ group: 'debt', kind: 'repay_out', partyId: id }) }, '↖ Trả nợ')))));
  if (!withRun.length) { root.append(emptyState('Chưa có giao dịch với người này.')); return; }
  root.append(card('Lịch sử', h('div', { class: 'list' }, [...withRun].reverse().map(({ t, run: r }) => h('div', { class: 'row-wrap' },
    txRow(t, { showDate: true, onClick: () => openTxForm({ tx: t }) }),
    h('div', { class: 'run sub mono' }, `Số dư sau: ${money(r[t.currency], t.currency, { sign: true })}`))))));
}
