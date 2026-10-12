import { h, field, select, moneyInput, currencyOptions, modal, toast, errMsg, confirmBox, emptyState, chip, money } from '../ui.js';
import { store } from '../store.js';
import { roundTo } from '../money.js';
import { todayStr, fmtDate } from '../dates.js';
import { card, pageHead, currencyChips } from '../components.js';

export function render(root) {
  const list = [...store.all('dorm')].sort((a, b) => (a.paidDate === b.paidDate ? (b.ts || 0) - (a.ts || 0) : (a.paidDate || '') < (b.paidDate || '') ? 1 : -1));
  root.append(pageHead('Tiền KTX', h('button', { class: 'btn primary', onclick: () => openForm(null) }, '＋ Thêm khoản')));

  const totals = {};
  for (const d of list) totals[d.currency || 'RUB'] = roundTo((totals[d.currency || 'RUB'] || 0) + (Number(d.amount) || 0), 6);
  const pending = list.filter((d) => !d.receiptSent);
  root.append(card(null, h('div', { class: 'duo' },
    h('div', {}, h('span', { class: 'sub' }, 'Đã đóng (tổng)'), h('div', { class: 'chips' }, currencyChips(totals))),
    h('div', {}, h('span', { class: 'sub' }, 'Chưa gửi chứng từ'), h('div', { class: 'chips' }, chip(`${pending.length} khoản`, pending.length ? 'warn' : 'good'))))));

  if (!list.length) { root.append(emptyState('Chưa có khoản KTX nào.')); return; }
  root.append(card(null, h('div', { class: 'list' }, list.map((d) => h('div', { class: 'row' },
    h('button', { class: 'row-main link-plain btn-reset', type: 'button', onclick: () => openForm(d) },
      h('span', { class: 'row-title' }, `${d.period || 'Khoản KTX'} · ${money(d.amount, d.currency || 'RUB')}`),
      h('span', { class: 'sub' }, [fmtDate(d.paidDate), d.payer, d.note].filter(Boolean).join(' · '))),
    h('label', { class: 'check right', title: 'Đã gửi chứng từ (check)' },
      h('input', { type: 'checkbox', checked: !!d.receiptSent, onchange: async (e) => { try { await store.put('dorm', { ...d, receiptSent: e.target.checked }); } catch (er) { toast(errMsg(er), 'error'); } } }),
      ' Đã gửi check'))))));
}

function openForm(d) {
  const isNew = !d;
  const st = { paidDate: d ? d.paidDate : todayStr(), currency: d ? d.currency || 'RUB' : 'RUB', payer: d ? d.payer || '' : '', period: d ? d.period || '' : '', receiptSent: d ? !!d.receiptSent : false, note: d ? d.note || '' : '' };
  const amt = moneyInput({ value: d ? d.amount : '', currency: st.currency });
  const body = h('div', { class: 'form' },
    field('Ngày đóng', h('input', { type: 'date', value: st.paidDate, onchange: (e) => { st.paidDate = e.target.value; } })),
    h('div', { class: 'grid2' },
      field('Số tiền', amt.el),
      field('Tiền tệ', select(currencyOptions, st.currency, (v) => { st.currency = v; amt.setCurrency(v); }))),
    field('Kỳ / mục đích', h('input', { type: 'text', value: st.period, placeholder: 'Ví dụ: tháng 11/2025 hoặc 12/2025–3/2026', oninput: (e) => { st.period = e.target.value; } })),
    field('Tài khoản thanh toán / người đóng', h('input', { type: 'text', value: st.payer, oninput: (e) => { st.payer = e.target.value; } })),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.receiptSent, onchange: (e) => { st.receiptSent = e.target.checked; } }), ' Đã gửi chứng từ (check)'),
    field('Ghi chú', h('input', { type: 'text', value: st.note, oninput: (e) => { st.note = e.target.value; } })));
  const foot = h('div', { class: 'sheet-foot inline' });
  if (!isNew) foot.append(h('button', { class: 'btn danger-ghost', onclick: async () => {
    if (!(await confirmBox('Xóa khoản này?', { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('dorm', d.id); m.close(); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Xóa'));
  foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: async () => {
    const v = amt.get();
    if (!(v > 0)) return toast('Nhập số tiền lớn hơn 0.', 'error');
    try { await store.put('dorm', { ...(d || {}), ...st, amount: v, note: st.note.trim(), payer: st.payer.trim(), period: st.period.trim() }); m.close(); toast('Đã lưu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Lưu'));
  body.append(foot);
  const m = modal({ title: isNew ? 'Thêm khoản KTX' : 'Sửa khoản KTX', body });
}
