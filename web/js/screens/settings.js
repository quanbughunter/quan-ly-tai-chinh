import { h, field, select, seg, moneyInput, currencyOptions, modal, toast, errMsg, confirmBox, download, pickFile, money, chip, emptyState } from '../ui.js';
import { store } from '../store.js';
import { CURRENCIES, fmtNum } from '../money.js';
import { todayStr } from '../dates.js';
import { COLLECTIONS } from '../model.js';
import { card, pageHead } from '../components.js';
import { seedDemo } from '../demo.js';
import { getTheme, setTheme } from '../theme.js';
import { categoryOptions, accountOptions } from '../forms.js';

const ICONS = ['🍜', '☕', '🚌', '🏠', '📚', '🎁', '💊', '🛍️', '🎈', '🧾', '✨', '💼', '🎓', '🏦', '💱', '🌱', '🧴', '📱', '🎬', '🐶', '✈️', '⚽'];

const save = async (fn) => {
  try { await fn(); toast('Đã lưu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
};

/** Một dòng nhập số, tự lưu khi rời ô. */
function numRow(label, value, onSave, { cur = '', hint } = {}) {
  const ctl = moneyInput({ value, currency: cur });
  ctl.input.addEventListener('change', () => {
    const v = ctl.get();
    if (!Number.isFinite(v) || v < 0) { toast('Số không hợp lệ.', 'error'); return; }
    save(() => onSave(v));
  });
  return field(label, ctl.el, hint);
}

export function render(root) {
  const s = store.settings();
  root.append(pageHead('Cài đặt'));

  /* ── Tài khoản đăng nhập / chế độ ── */
  if (store.mode === 'cloud') {
    root.append(card('Đồng bộ đám mây', h('div', { class: 'form' },
      h('div', { class: 'kv' }, h('div', {}, h('span', {}, 'Đăng nhập'), h('b', {}, store.user ? store.user.email : '—')),
        h('div', {}, h('span', {}, 'Trạng thái'), h('b', {}, store.offline ? 'Ngoại tuyến (chỉ xem)' : 'Đã đồng bộ'))),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: async () => { try { await store.refresh(); toast('Đã tải lại dữ liệu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); } } }, '⟳ Tải lại'),
        h('button', { class: 'btn danger-ghost', onclick: async () => { if (await confirmBox('Đăng xuất khỏi thiết bị này?', { okLabel: 'Đăng xuất' })) { await store.signOut(); location.hash = '#/login'; } } }, 'Đăng xuất')))));
  } else {
    root.append(card('Chế độ thử (chưa nối đám mây)', h('div', { class: 'form' },
      h('p', { class: 'sub' }, 'Dữ liệu đang chỉ nằm trong trình duyệt này, không đồng bộ giữa máy tính và điện thoại. Điền Supabase vào config.js (xem hướng dẫn trong docs) để có đăng nhập và đồng bộ.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: async () => {
          if (store.all('accounts').length && !(await confirmBox('Thêm dữ liệu mẫu vào dữ liệu hiện có?', { okLabel: 'Thêm' }))) return;
          try { await seedDemo(); toast('Đã tạo dữ liệu mẫu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
        } }, 'Tạo dữ liệu mẫu')))));
  }

  /* ── Hiển thị ── */
  root.append(card('Hiển thị', h('div', { class: 'form' },
    field('Giao diện', seg([{ value: 'auto', label: 'Theo máy' }, { value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }], getTheme(), (v) => setTheme(v))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s.hideAmounts, onchange: (e) => save(() => store.saveSettings({ hideAmounts: e.target.checked })) }), ' Ẩn số tiền (hiện •••••), tiện khi mở app nơi đông người'))));

  /* ── Tỷ giá ── */
  root.append(card('Tỷ giá quy đổi', h('div', { class: 'form' },
    h('p', { class: 'sub' }, 'Chỉ dùng để quy ra ₫ ở màn Tổng quan và ngân sách. Không ảnh hưởng số dư từng tài khoản.'),
    h('div', { class: 'grid2' }, CURRENCIES.filter((c) => c !== s.baseCurrency).map((c) =>
      numRow(`1 ${c} = ? ₫`, s.rates[c] ?? '', (v) => store.saveSettings({ rates: { [c]: v } }), { cur: 'VND' }))))));

  /* ── Tham số đổi tiền ── */
  const P = s.params;
  const setP = (k) => (v) => store.saveSettings({ params: { [k]: v } });
  root.append(card('Tham số đổi tiền', h('div', { class: 'form' },
    h('div', { class: 'grid2' },
      numRow('Cỡ lô chiều “Sang” (₫)', P.lotSang, setP('lotSang'), { cur: 'VND' }),
      numRow('Cỡ lô chiều “Về” (₽)', P.lotVe, setP('lotVe'), { cur: 'RUB' }),
      numRow('Lãi mặc định chiều Sang (₫/lô)', P.defaultMarginSang, setP('defaultMarginSang'), { cur: 'VND' }),
      numRow('Lãi mặc định chiều Về (₫/lô)', P.defaultMarginVe, setP('defaultMarginVe'), { cur: 'VND' }),
      numRow('Số ₫ tham chiếu để quy ra ₽', P.refVnd, setP('refVnd'), { cur: 'VND', hint: 'Dòng “… ₫ tương đương … ₽” trong máy tính báo giá.' })),
    field('Thẻ nhận lãi mặc định khi chốt giao dịch', select(accountOptions({ none: '— Nhớ thẻ lần chốt trước —' }), P.dealAccountId, (v) => save(() => store.saveSettings({ params: { dealAccountId: v } }))),
      'Khi bạn bấm “Chốt giao dịch” ở mục Báo tỉ giá, lãi thực được cộng vào thẻ gợi ý sẵn, đúng ngày của lệnh; thẻ VND hay thẻ rúp đều được (thẻ rúp thì lãi quy đổi theo tỉ giá áng chừng bạn nhập khi chốt). Mỗi lần chốt bạn vẫn chọn lại được thẻ khác. Để “Nhớ thẻ lần chốt trước” thì app gợi ý đúng thẻ bạn vừa chọn lần trước. Báo giá mà chưa chốt thì không cộng gì.'))));

  /* ── Học bổng MIIGAiK ── */
  root.append(card('Học bổng MIIGAiK', h('div', { class: 'form' },
    numRow('Số tiền mỗi tháng (₽)', P.scholarshipAmount, setP('scholarshipAmount'), { cur: 'RUB', hint: 'Điền sẵn khi thêm tháng mới ở mục Học bổng MIIGAiK.' }),
    field('Thẻ nhận học bổng chọn sẵn', select(accountOptions({ none: '— Tự chọn: Gazprom, rồi PSPB —', only: (a) => a.currency === 'RUB' && a.kind !== 'savings' }), P.scholarshipAccountId, (v) => save(() => store.saveSettings({ params: { scholarshipAccountId: v } }))),
      'Khi bạn tick “Đã nhận” ở một tháng học bổng, số tiền được cộng vào thẻ chọn ở đó. App nhớ thẻ bạn chọn lần gần nhất.'))));

  /* ── Danh mục ── */
  root.append(categoriesCard());

  /* ── Ngân sách ── */
  root.append(budgetsCard());

  /* ── Dữ liệu ── */
  root.append(card('Dữ liệu', h('div', { class: 'form' },
    h('p', { class: 'sub' }, 'Sao lưu định kỳ: tải file JSON về máy. File chứa toàn bộ số liệu cá nhân — đừng đưa lên GitHub.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => {
        download(`quan-ly-tai-chinh-${todayStr()}.json`, JSON.stringify(store.exportAll(), null, 2));
        toast('Đã tải file sao lưu.', 'ok');
      } }, '⬇ Xuất sao lưu'),
      h('button', { class: 'btn', onclick: openImport }, '⬆ Nhập từ file'),
      h('button', { class: 'btn danger-ghost', onclick: openWipe }, 'Xóa toàn bộ dữ liệu')),
    h('p', { class: 'sub' }, `Hiện có ${COLLECTIONS.filter((c) => c !== 'settings').reduce((n, c) => n + store.all(c).length, 0)} bản ghi.`))));

  root.append(h('p', { class: 'sub center' }, 'Quản lý tài chính · bản 1.0 · tiền được tính từ sổ giao dịch, không nhập tay số dư.'));
}

/* ───────── Danh mục ───────── */
function categoriesCard() {
  const cats = store.all('categories');
  const group = (type, title) => {
    const list = cats.filter((c) => c.type === type).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
    return h('div', {}, h('div', { class: 'day-head' }, h('span', {}, title)),
      h('div', { class: 'list' }, list.length ? list.map((c) => h('button', { class: 'row', type: 'button', onclick: () => openCategory(c) },
        h('span', { class: 'row-ico' }, c.icon || '•'), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, c.name)), h('span', { class: 'sub row-right' }, 'Sửa'))) : [h('p', { class: 'sub pad' }, 'Chưa có.')]));
  };
  return card('Danh mục', h('div', {}, group('expense', 'Khoản chi'), group('income', 'Khoản thu')),
    { right: h('button', { class: 'btn small primary', onclick: () => openCategory(null) }, '＋ Thêm') });
}

function openCategory(c) {
  const st = { name: c ? c.name : '', type: c ? c.type : 'expense', icon: c ? c.icon || '' : '' };
  const iconIn = h('input', { type: 'text', value: st.icon, maxlength: '4', 'aria-label': 'Biểu tượng', oninput: (e) => { st.icon = e.target.value; } });
  const picker = h('div', { class: 'icon-grid' }, ICONS.map((i) => h('button', { type: 'button', class: 'icon-btn', onclick: () => { st.icon = i; iconIn.value = i; } }, i)));
  const usedBy = c ? store.all('txs').filter((t) => t.categoryId === c.id).length : 0;
  const body = h('div', { class: 'form' },
    field('Tên danh mục', h('input', { type: 'text', value: st.name, oninput: (e) => { st.name = e.target.value; } })),
    field('Loại', seg([{ value: 'expense', label: 'Chi' }, { value: 'income', label: 'Thu' }], st.type, (v) => { st.type = v; })),
    field('Biểu tượng', iconIn), picker);
  const foot = h('div', { class: 'sheet-foot inline' });
  if (c) foot.append(h('button', { class: 'btn danger-ghost', onclick: async () => {
    const msg = usedBy ? `Xóa “${c.name}”? ${usedBy} giao dịch đang dùng sẽ trở thành “chưa phân loại”.` : `Xóa “${c.name}”?`;
    if (!(await confirmBox(msg, { okLabel: 'Xóa', danger: true }))) return;
    try {
      if (usedBy) await store.putMany('txs', store.all('txs').filter((t) => t.categoryId === c.id).map((t) => ({ ...t, categoryId: '' })));
      const bs = store.all('budgets').filter((b) => b.categoryId === c.id);
      if (bs.length) await store.delMany('budgets', bs.map((b) => b.id));
      await store.del('categories', c.id);
      m.close();
      toast('Đã xóa danh mục.', 'ok');
    } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Xóa'));
  foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: async () => {
    const name = st.name.trim();
    if (!name) return toast('Nhập tên danh mục.', 'error');
    if (store.all('categories').some((x) => x.id !== (c && c.id) && x.type === st.type && x.name.toLowerCase() === name.toLowerCase())) return toast('Đã có danh mục trùng tên.', 'error');
    try { await store.put('categories', { ...(c || {}), name, type: st.type, icon: st.icon.trim() }); m.close(); toast('Đã lưu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Lưu'));
  body.append(foot);
  const m = modal({ title: c ? 'Sửa danh mục' : 'Thêm danh mục', body });
}

/* ───────── Ngân sách ───────── */
function budgetsCard() {
  const budgets = store.all('budgets');
  const rows = budgets.map((b) => ({ b, cat: b.categoryId ? store.byId('categories', b.categoryId) : null }))
    .sort((x, y) => (x.cat ? x.cat.name : '').localeCompare(y.cat ? y.cat.name : '', 'vi'));
  return card('Ngân sách mỗi tháng', h('div', {},
    h('p', { class: 'sub pad' }, 'Đặt hạn mức chi theo danh mục (hoặc tổng chi). Màn Tổng quan sẽ cảnh báo khi gần chạm hạn mức.'),
    rows.length ? h('div', { class: 'list' }, rows.map(({ b, cat }) => h('button', { class: 'row', type: 'button', onclick: () => openBudget(b) },
      h('span', { class: 'row-ico' }, cat ? cat.icon || '•' : 'Σ'),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, cat ? cat.name : 'Tổng chi mọi danh mục')),
      h('span', { class: 'row-right amt mono' }, money(b.amount, b.currency || 'VND'))))) : emptyState('Chưa đặt ngân sách nào.')),
  { right: h('button', { class: 'btn small primary', onclick: () => openBudget(null) }, '＋ Thêm') });
}

function openBudget(b) {
  const st = { categoryId: b ? b.categoryId || '' : '', currency: b ? b.currency || 'VND' : 'VND' };
  const amt = moneyInput({ value: b ? b.amount : '', currency: st.currency });
  const body = h('div', { class: 'form' },
    field('Danh mục', select(categoryOptions('expense', 'Tổng chi mọi danh mục'), st.categoryId, (v) => { st.categoryId = v; })),
    h('div', { class: 'grid2' },
      field('Hạn mức mỗi tháng', amt.el),
      field('Tiền tệ', select(currencyOptions, st.currency, (v) => { st.currency = v; amt.setCurrency(v); }))));
  const foot = h('div', { class: 'sheet-foot inline' });
  if (b) foot.append(h('button', { class: 'btn danger-ghost', onclick: async () => {
    try { await store.del('budgets', b.id); m.close(); toast('Đã xóa.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Xóa'));
  foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), h('button', { class: 'btn primary', onclick: async () => {
    const v = amt.get();
    if (!(v > 0)) return toast('Nhập hạn mức lớn hơn 0.', 'error');
    if (store.all('budgets').some((x) => x.id !== (b && b.id) && (x.categoryId || '') === st.categoryId)) return toast('Danh mục này đã có ngân sách — bấm vào dòng đó để sửa.', 'error');
    try { await store.put('budgets', { ...(b || {}), categoryId: st.categoryId, amount: v, currency: st.currency }); m.close(); toast('Đã lưu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  } }, 'Lưu'));
  body.append(foot);
  const m = modal({ title: b ? 'Sửa ngân sách' : 'Thêm ngân sách', body });
}

/* ───────── Nhập / xóa dữ liệu ───────── */
async function openImport() {
  const f = await pickFile('.json,application/json');
  if (!f) return;
  let obj;
  try { obj = JSON.parse(f.text); } catch { toast('File không phải JSON hợp lệ.', 'error'); return; }
  const src = obj && obj.data ? obj.data : obj;
  const counts = COLLECTIONS.map((c) => [c, Array.isArray(src && src[c]) ? src[c].length : 0]).filter(([, n]) => n);
  if (!counts.length) { toast('Không tìm thấy dữ liệu nào trong file.', 'error'); return; }
  const st = { replace: false };
  const run = h('button', { class: 'btn primary' }, 'Nhập');
  const m = modal({
    title: 'Nhập dữ liệu',
    body: h('div', { class: 'form' },
      h('p', { class: 'sub' }, `File: ${f.name}`),
      h('div', { class: 'chips' }, counts.map(([c, n]) => chip(`${LABELS[c] || c}: ${fmtNum(n)}`))),
      field('Cách nhập', seg([{ value: 'merge', label: 'Gộp thêm' }, { value: 'replace', label: 'Thay toàn bộ' }], 'merge', (v) => { st.replace = v === 'replace'; })),
      h('p', { class: 'field-hint' }, 'Gộp: bản ghi cùng mã sẽ được ghi đè, còn lại giữ nguyên. Thay toàn bộ: xóa dữ liệu hiện có rồi nhập (nên xuất sao lưu trước).')),
    actions: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), run],
  });
  run.addEventListener('click', async () => {
    if (st.replace && !(await confirmBox('Xóa toàn bộ dữ liệu hiện có rồi nhập từ file?', { okLabel: 'Thay toàn bộ', danger: true }))) return;
    run.disabled = true;
    run.textContent = 'Đang nhập…';
    try {
      const n = await store.importAll(obj, { replace: st.replace });
      m.close();
      toast(`Đã nhập ${fmtNum(n)} bản ghi.`, 'ok');
    } catch (e) {
      run.disabled = false;
      run.textContent = 'Nhập';
      toast(errMsg(e), 'error');
    }
  });
}

const LABELS = {
  accounts: 'Tài khoản', parties: 'Người/đối tượng', categories: 'Danh mục', txs: 'Giao dịch', deals: 'Lệnh đổi tiền',
  dorm: 'KTX', scholarships: 'Học bổng MIIGAiK', budgets: 'Ngân sách', settings: 'Cài đặt',
};

function openWipe() {
  const inp = h('input', { type: 'text', placeholder: 'Gõ XÓA để xác nhận', autocomplete: 'off' });
  const go = h('button', { class: 'btn danger', disabled: true }, 'Xóa vĩnh viễn');
  inp.addEventListener('input', () => { go.disabled = inp.value.trim().toUpperCase() !== 'XÓA'; });
  const m = modal({
    title: 'Xóa toàn bộ dữ liệu',
    body: h('div', { class: 'form' },
      h('p', {}, store.mode === 'cloud' ? 'Toàn bộ sổ của tài khoản này trên đám mây sẽ bị xóa và không khôi phục được.' : 'Toàn bộ dữ liệu trong trình duyệt này sẽ bị xóa.'),
      h('p', { class: 'sub' }, 'Hãy xuất sao lưu trước nếu chưa có.'), inp),
    actions: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Hủy'), go],
  });
  go.addEventListener('click', async () => {
    go.disabled = true;
    try {
      await store.importAll({ data: {} }, { replace: true });
      m.close();
      toast('Đã xóa toàn bộ dữ liệu.', 'ok');
    } catch (e) { go.disabled = false; toast(errMsg(e), 'error'); }
  });
}
