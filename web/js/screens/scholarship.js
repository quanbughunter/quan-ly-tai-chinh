import { h, field, select, moneyInput, modal, toast, errMsg, confirmBox, emptyState, chip, money } from '../ui.js';
import { store } from '../store.js';
import { fmtNum, fmtMoney } from '../money.js';
import { todayStr, fmtDate, daysBetween, monthLabel } from '../dates.js';
import { card, pageHead } from '../components.js';
import { accountOptions, accById } from '../forms.js';
import {
  SCHOLARSHIP_NAME, SCHOLARSHIP_CURRENCY, isReceived, scholarshipAmount, defaultScholarshipAccountId,
  saveScholarship, removeScholarship, newScholarshipId, takeOpenScholarshipRequest,
} from '../scholarship.js';

export function render(root) {
  const list = [...store.all('scholarships')].sort((a, b) => ((b.month || '') > (a.month || '') ? 1 : -1));
  root.append(pageHead(SCHOLARSHIP_NAME, h('button', { class: 'btn primary', onclick: () => openForm(null) }, '＋ Thêm tháng')));

  const delays = list.filter((x) => x.availableDate && x.receivedDate).map((x) => daysBetween(x.availableDate, x.receivedDate));
  const waiting = list.filter((x) => !isReceived(x));
  const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
  const posted = list.filter((x) => x.txId && store.byId('txs', x.txId));
  const postedTotal = posted.reduce((s, x) => s + (Number(store.byId('txs', x.txId).amount) || 0), 0);
  root.append(card(null, h('div', {},
    h('div', { class: 'triple' },
      h('div', {}, h('span', {}, 'Tháng đã nhận'), h('strong', { class: 'mono' }, String(list.length - waiting.length))),
      h('div', {}, h('span', {}, 'Đang chờ'), h('strong', { class: `mono ${waiting.length ? 'neg' : ''}` }, String(waiting.length))),
      h('div', {}, h('span', {}, 'Chậm TB (ngày)'), h('strong', { class: 'mono' }, avg == null ? '—' : fmtNum(avg, 1)))),
    h('p', { class: 'sub' },
      `Mỗi tháng: ${money(scholarshipAmount(store.settings().params), SCHOLARSHIP_CURRENCY)}`,
      posted.length ? ` · Đã cộng vào thẻ: ${money(postedTotal, SCHOLARSHIP_CURRENCY)} (${posted.length} tháng)` : ''))));

  if (!list.length) {
    root.append(emptyState('Chưa có tháng nào. Bấm “Thêm tháng”, tick “Đã nhận” và chọn thẻ để cộng học bổng vào số dư.'));
  } else {
    root.append(card(null, h('div', { class: 'list' }, list.map((x) => {
      const delay = x.availableDate && x.receivedDate ? daysBetween(x.availableDate, x.receivedDate) : null;
      const tx = x.txId ? store.byId('txs', x.txId) : null;
      const acc = tx ? accById(tx.accountId) : null;
      return h('button', { class: 'row', type: 'button', onclick: () => openForm(x) },
        h('span', { class: 'row-ico' }, x.receivedDate ? '✅' : '⏳'),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, monthLabel(x.month || '0000-00')),
          h('span', { class: 'sub' }, `Có: ${x.availableDate ? fmtDate(x.availableDate) : '—'} · Nhận: ${x.receivedDate ? fmtDate(x.receivedDate) : 'chưa nhận'}`)),
        h('span', { class: 'row-right' },
          x.amount ? h('span', { class: 'amt mono pos' }, money(x.amount, x.currency || SCHOLARSHIP_CURRENCY)) : null,
          acc ? chip(`→ ${acc.name}`, 'good') : null,
          delay != null ? chip(delay > 0 ? `+${delay} ngày` : 'đúng hạn', delay > 3 ? 'warn' : 'good') : null));
    }))));
  }

  // Mở tháng theo yêu cầu từ màn hình Giao dịch (bấm vào khoản học bổng tự động).
  const rq = takeOpenScholarshipRequest();
  if (rq) {
    const x = store.byId('scholarships', rq);
    if (x) setTimeout(() => openForm(x), 0);
  }
}

function openForm(x) {
  const isNew = !x;
  const params = store.settings().params;
  const linkedTx = x && x.txId ? store.byId('txs', x.txId) : null;
  const st = {
    month: x ? x.month : todayStr().slice(0, 7),
    availableDate: x ? x.availableDate || '' : '',
    received: x ? isReceived(x) : false,
    receivedDate: x ? x.receivedDate || '' : '',
    note: x ? x.note || '' : '',
    // '' = không cộng vào thẻ nào. Tháng mới hoặc tháng đang chờ (sắp tick “đã nhận”): chọn sẵn thẻ dùng lần trước.
    // Tháng đã nhận từ trước mà chưa có khoản cộng (ví dụ nhập từ sheet cũ, số dư thẻ đã tính sẵn): mặc định không cộng.
    accountId: linkedTx ? linkedTx.accountId : (x && isReceived(x) ? '' : defaultScholarshipAccountId()),
  };
  const amt = moneyInput({ value: x && x.amount != null ? x.amount : scholarshipAmount(params), currency: SCHOLARSHIP_CURRENCY });

  const cardOpts = accountOptions({
    includeArchived: true,
    only: (a) => a.currency === SCHOLARSHIP_CURRENCY && a.kind !== 'savings' && (!a.archived || a.id === st.accountId),
  });
  const accSel = select([{ value: '', label: '— Không cộng vào thẻ nào —' }, ...cardOpts], st.accountId, (v) => { st.accountId = v; refresh(); });
  const hint = h('p', { class: 'field-hint' });

  const recvDate = h('input', { type: 'date', value: st.receivedDate, onchange: (e) => { st.receivedDate = e.target.value; } });
  const recvBox = h('div', { class: 'form confirm-box' },
    h('div', { class: 'grid2' },
      field('Ngày thực nhận', recvDate),
      field('Số tiền nhận (₽)', amt.el)),
    field('Cộng vào thẻ', accSel),
    hint);

  const chk = h('input', { type: 'checkbox', checked: st.received, onchange: (e) => {
    st.received = e.target.checked;
    if (st.received && !st.receivedDate) { st.receivedDate = todayStr(); recvDate.value = st.receivedDate; }
    refresh();
  } });

  function refresh() {
    recvBox.hidden = !st.received;
    const v = amt.get();
    if (!st.received) hint.textContent = '';
    else if (!st.accountId) hint.textContent = linkedTx
      ? 'Bỏ chọn thẻ sẽ xóa khoản đã cộng trước đây khỏi số dư thẻ.'
      : 'Không ghi khoản thu nào — dùng khi số dư thẻ đã tính sẵn học bổng này.';
    else hint.textContent = `Số dư thẻ sẽ tăng ${Number.isFinite(v) && v > 0 ? fmtMoney(v, SCHOLARSHIP_CURRENCY) : 'đúng số tiền nhận'}. App tự ghi khoản thu này — đừng thêm lại ở mục Giao dịch.`;
  }
  amt.input.addEventListener('input', refresh);

  const body = h('div', { class: 'form' },
    field('Tháng', h('input', { type: 'month', value: st.month, onchange: (e) => { st.month = e.target.value; } })),
    field('Ngày học bổng “có”', h('input', { type: 'date', value: st.availableDate, onchange: (e) => { st.availableDate = e.target.value; } }),
      'Ngày trên hệ thống báo học bổng đã có — để theo dõi thường chậm bao lâu.'),
    h('label', { class: 'check' }, chk, ' Đã nhận học bổng tháng này'),
    recvBox,
    field('Ghi chú', h('input', { type: 'text', value: st.note, oninput: (e) => { st.note = e.target.value; } })));
  refresh();

  const foot = h('div', { class: 'sheet-foot inline' });
  if (!isNew) foot.append(h('button', { class: 'btn danger-ghost', onclick: async () => {
    const msg = linkedTx
      ? `Xóa tháng này? Khoản ${fmtMoney(linkedTx.amount, linkedTx.currency)} đã cộng vào thẻ cũng sẽ bị xóa khỏi số dư.`
      : 'Xóa tháng này?';
    if (!(await confirmBox(msg, { okLabel: 'Xóa', danger: true }))) return;
    try { await removeScholarship(x.id); m.close(); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Xóa'));
  foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: save }, 'Lưu'));
  body.append(foot);

  async function save() {
    if (!st.month) return toast('Chọn tháng.', 'error');
    if (st.received && !st.receivedDate) return toast('Chọn ngày thực nhận.', 'error');
    const v = amt.get();
    const doc = { ...(x || {}), id: x ? x.id : newScholarshipId(), month: st.month, currency: SCHOLARSHIP_CURRENCY, note: st.note.trim() };
    for (const [k, val] of Object.entries({ availableDate: st.availableDate, receivedDate: st.received ? st.receivedDate : '', note: doc.note })) {
      if (val) doc[k] = val; else delete doc[k];
    }
    if (Number.isFinite(v) && v > 0) doc.amount = v; else delete doc.amount;
    const post = st.received && !!st.accountId;
    try {
      await saveScholarship(doc, { post, accountId: st.accountId });
      if (post && st.accountId !== params.scholarshipAccountId) {
        try { await store.saveSettings({ params: { scholarshipAccountId: st.accountId } }); } catch { /* chỉ để nhớ lựa chọn, bỏ qua */ }
      }
      m.close();
      const acc = post ? accById(st.accountId) : null;
      toast(post ? `Đã lưu. +${fmtMoney(v, SCHOLARSHIP_CURRENCY)} vào ${acc ? acc.name : 'thẻ'}.` : 'Đã lưu.', 'ok');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  const m = modal({ title: isNew ? `Thêm tháng — ${SCHOLARSHIP_NAME}` : `Sửa tháng — ${SCHOLARSHIP_NAME}`, body });
}
