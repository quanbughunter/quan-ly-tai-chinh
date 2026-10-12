import { h, field, select, moneyInput, currencyOptions, modal, toast, errMsg, confirmBox, emptyState, chip, money } from '../ui.js';
import { store } from '../store.js';
import { fmtNum } from '../money.js';
import { todayStr, fmtDate, daysBetween, monthLabel } from '../dates.js';
import { card, pageHead } from '../components.js';

export function render(root) {
  const list = [...store.all('scholarships')].sort((a, b) => ((b.month || '') > (a.month || '') ? 1 : -1));
  root.append(pageHead('Học bổng', h('button', { class: 'btn primary', onclick: () => openForm(null) }, '＋ Thêm tháng')));

  const delays = list.filter((x) => x.availableDate && x.receivedDate).map((x) => daysBetween(x.availableDate, x.receivedDate));
  const waiting = list.filter((x) => !x.receivedDate);
  const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
  root.append(card(null, h('div', { class: 'triple' },
    h('div', {}, h('span', {}, 'Tháng đã nhận'), h('strong', { class: 'mono' }, String(list.length - waiting.length))),
    h('div', {}, h('span', {}, 'Đang chờ'), h('strong', { class: `mono ${waiting.length ? 'neg' : ''}` }, String(waiting.length))),
    h('div', {}, h('span', {}, 'Chậm TB (ngày)'), h('strong', { class: 'mono' }, avg == null ? '—' : fmtNum(avg, 1))))));

  if (!list.length) { root.append(emptyState('Chưa có dữ liệu. Ghi ngày học bổng “có” và ngày thực nhận để biết thường chậm bao lâu.')); return; }
  root.append(card(null, h('div', { class: 'list' }, list.map((x) => {
    const delay = x.availableDate && x.receivedDate ? daysBetween(x.availableDate, x.receivedDate) : null;
    return h('button', { class: 'row', type: 'button', onclick: () => openForm(x) },
      h('span', { class: 'row-ico' }, x.receivedDate ? '✅' : '⏳'),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, monthLabel(x.month || '0000-00')),
        h('span', { class: 'sub' }, `Có: ${x.availableDate ? fmtDate(x.availableDate) : '—'} · Nhận: ${x.receivedDate ? fmtDate(x.receivedDate) : 'chưa nhận'}`)),
      h('span', { class: 'row-right' },
        x.amount ? h('span', { class: 'amt mono pos' }, money(x.amount, x.currency || 'RUB')) : null,
        delay != null ? chip(delay > 0 ? `+${delay} ngày` : 'đúng hạn', delay > 3 ? 'warn' : 'good') : null));
  }))));
}

function openForm(x) {
  const isNew = !x;
  const st = { month: x ? x.month : todayStr().slice(0, 7), availableDate: x ? x.availableDate || '' : '', receivedDate: x ? x.receivedDate || '' : '', currency: x ? x.currency || 'RUB' : 'RUB', note: x ? x.note || '' : '' };
  const amt = moneyInput({ value: x ? x.amount ?? '' : '', currency: st.currency });
  const body = h('div', { class: 'form' },
    field('Tháng', h('input', { type: 'month', value: st.month, onchange: (e) => { st.month = e.target.value; } })),
    h('div', { class: 'grid2' },
      field('Ngày học bổng “có”', h('input', { type: 'date', value: st.availableDate, onchange: (e) => { st.availableDate = e.target.value; } })),
      field('Ngày thực nhận', h('input', { type: 'date', value: st.receivedDate, onchange: (e) => { st.receivedDate = e.target.value; } }))),
    h('div', { class: 'grid2' },
      field('Số tiền (nếu muốn ghi)', amt.el),
      field('Tiền tệ', select(currencyOptions, st.currency, (v) => { st.currency = v; amt.setCurrency(v); }))),
    field('Ghi chú', h('input', { type: 'text', value: st.note, oninput: (e) => { st.note = e.target.value; } })));
  const foot = h('div', { class: 'sheet-foot inline' });
  if (!isNew) foot.append(h('button', { class: 'btn danger-ghost', onclick: async () => {
    if (!(await confirmBox('Xóa tháng này?', { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('scholarships', x.id); m.close(); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Xóa'));
  foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: async () => {
    if (!st.month) return toast('Chọn tháng.', 'error');
    const v = amt.get();
    try { await store.put('scholarships', { ...(x || {}), ...st, amount: Number.isFinite(v) && v > 0 ? v : undefined, note: st.note.trim() }); m.close(); toast('Đã lưu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Lưu'));
  body.append(foot);
  const m = modal({ title: isNew ? 'Thêm tháng học bổng' : 'Sửa tháng học bổng', body });
}
