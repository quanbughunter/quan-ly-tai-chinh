// Báo tỉ giá: máy tính báo giá sang / về, lưu báo giá, và CHỐT giao dịch.
// Chỉ khi chốt, lãi mới được cộng vào thẻ nhận lãi (mặc định thẻ MB; thẻ VND hay thẻ rúp đều được) đúng ngày của lệnh.

import { h, money, field, select, seg, moneyInput, modal, toast, errMsg, confirmBox, emptyState, chip } from '../ui.js';
import { store } from '../store.js';
import { quoteSang, quoteVe, evalDeal, suggestedProfit } from '../fx.js';
import { fmtNum, roundTo, parseExpr, CUR_INFO } from '../money.js';
import { todayStr, fmtDate, monthLabel } from '../dates.js';
import { card, pageHead } from '../components.js';
import { partyOptions, openPartyForm, accountOptions, openAccountForm } from '../forms.js';
import {
  DIR_LABEL, statusOf, dealProfit, defaultProfitAccountId, rememberProfitAccount, saveDeal, confirmDeal, revertDeal, removeDeal,
  convertProfit, foreignFor,
  pendingPost, postPending, skipPending, newDealId, takeOpenRequest,
} from '../deals.js';

const DIRS = [
  { value: 'sang', label: 'Sang · VND → RUB' },
  { value: 've', label: 'Về · RUB → VND' },
];

const FIELDS = {
  sang: {
    inputs: [
      ['vndAmount', 'Số VND khách đưa', 'VND'],
      ['vndPerUsdt', 'Giá báo: VND / USDT', ''],
      ['rubPerUsdt', 'Giá báo: RUB / USDT', ''],
      ['margin', 'Lãi mong muốn (VND mỗi lô)', 'VND'],
    ],
    actual: [
      ['sellRubPerUsdt', 'Thực tế: bán USDT được (RUB / USDT)'],
      ['buyVndPerUsdt', 'Thực tế: mua USDT hết (VND / USDT)'],
    ],
  },
  ve: {
    inputs: [
      ['rubAmount', 'Số RUB khách đưa', 'RUB'],
      ['rubPerUsdt', 'Giá báo: RUB / USDT', ''],
      ['vndPerUsdt', 'Giá báo: VND / USDT', ''],
      ['margin', 'Lãi mong muốn (VND mỗi lô)', 'VND'],
    ],
    actual: [
      ['actualRubPerUsdt', 'Thực tế: mua USDT bằng RUB (RUB / USDT)'],
      ['actualVndPerUsdt', 'Thực tế: bán USDT lấy VND (VND / USDT)'],
    ],
  },
};

const num = (v) => (Number.isFinite(v) && v > 0 ? v : undefined);
const amountOf = (dir, inputs) => (dir === 'sang' ? inputs.vndAmount : inputs.rubAmount);

/**
 * Bảng nhập + kết quả tính trực tiếp.
 *  inputsEl: các ô giá báo + kết quả báo giá.  actualEl: các ô giá thực tế + lãi thực (chỉ dùng khi chốt).
 */
function dealEditor({ dir, inputs = {}, actual = {}, params, onChange }) {
  const ctls = {};
  const outQ = h('div', { class: 'calc-out' });
  const outR = h('div', { class: 'calc-out' });
  let building = true;

  const draw = (box, list, empty) => {
    if (!list.length) { box.replaceChildren(h('div', { class: 'sub' }, empty || '')); return; }
    box.replaceChildren(...list.map(([k, v, c]) => h('div', { class: `calc-row ${c || ''}` }, h('span', {}, k), h('b', { class: 'mono' }, v))));
  };

  function get() {
    const o = { inputs: {}, actual: {} };
    for (const [k] of FIELDS[dir].inputs) o.inputs[k] = num(ctls[k].get());
    for (const [k] of FIELDS[dir].actual) o.actual[k] = num(ctls[k].get());
    const mg = ctls.margin.get();
    o.inputs.margin = Number.isFinite(mg) ? mg : 0;
    return o;
  }

  function paint() {
    const r = evalDeal({ dir, ...get() }, params);
    const q = r.quote;
    const rows = [];
    if (!q) { /* chưa đủ dữ liệu: hiện lời nhắc */ } else if (dir === 'sang') {
      rows.push(['Giá báo', `${fmtNum(q.quote, 2)} ₫ / RUB`, 'big']);
      if (q.rubPay != null) rows.push(['RUB phải trả', `${fmtNum(q.rubPay, 2)} ₽`, 'big']);
      rows.push([`${fmtNum(params.refVnd)} ₫ tương đương`, `${fmtNum(q.rubForRef, 2)} ₽`]);
      if (q.theoreticalProfit != null) rows.push(['Lãi dự kiến', `${fmtNum(q.theoreticalProfit, 0)} ₫`]);
    } else {
      rows.push(['Giá báo', `${fmtNum(q.quote, 2)} ₫ / RUB`, 'big']);
      if (q.vndPay != null) rows.push(['VND trả khách', `${fmtNum(q.vndPay, 0)} ₫`, 'big']);
      if (q.theoreticalProfit != null) rows.push(['Lãi dự kiến', `${fmtNum(q.theoreticalProfit, 0)} ₫`]);
    }
    draw(outQ, rows, 'Nhập đủ giá và lãi để có giá báo.');
    const real = [];
    if (r.real) {
      real.push(['USDT giao dịch', `${fmtNum(r.real.usdt, 4)} USDT`]);
      if (dir === 'sang') real.push(['VND bỏ ra', `${fmtNum(r.real.vndCost, 0)} ₫`]);
      else real.push(['VND thu về', `${fmtNum(r.real.vndCollected, 0)} ₫`]);
      real.push(['Lãi thực', `${fmtNum(r.real.profit, 0)} ₫`, r.real.profit >= 0 ? 'good' : 'bad']);
    }
    draw(outR, real, 'Điền hai ô giá thực tế để thấy lãi thực (có thể bỏ trống).');
    return r;
  }

  const recalc = () => {
    if (building) return;
    paint();
    if (onChange) onChange();
  };
  const mk = ([key, label, unit], source) => {
    const ctl = moneyInput({ value: source[key] ?? '', currency: unit || '', onChange: recalc });
    ctls[key] = ctl;
    return field(label, ctl.el);
  };

  const inputsEl = h('div', { class: 'form' }, FIELDS[dir].inputs.map((f) => mk(f, inputs)), outQ);
  const actualEl = h('div', { class: 'form' },
    h('div', { class: 'divider' }, 'Giá thực tế khi giao dịch xong'),
    FIELDS[dir].actual.map((f) => mk(f, actual)), outR);
  building = false;
  paint();
  return { inputsEl, actualEl, get };
}

function defaultsFor(dir, params) {
  const last = store.all('deals').filter((d) => d.dir === dir).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
  const margin = dir === 'sang' ? params.defaultMarginSang : params.defaultMarginVe;
  const i = last && last.inputs ? { rubPerUsdt: last.inputs.rubPerUsdt, vndPerUsdt: last.inputs.vndPerUsdt } : {};
  return { ...i, margin };
}

let dir = 'sang';
let filter = 'all';

export function render(root) {
  const params = store.settings().params;
  root.append(pageHead('Báo tỉ giá'));

  // Lệnh đã chốt nhưng chưa cộng lãi vào thẻ (ví dụ nhập từ sheet cũ): hỏi một lần.
  const pend = pendingPost();
  if (pend.length) root.append(pendingBanner(pend, params));

  // Máy tính
  const calcHost = h('div', {});
  let editor;
  const drawCalc = () => {
    editor = dealEditor({ dir, inputs: defaultsFor(dir, params), params });
    calcHost.replaceChildren(editor.inputsEl);
  };
  const start = (confirm) => {
    const v = editor.get();
    const q = dir === 'sang' ? quoteSang({ ...v.inputs, lot: params.lotSang }) : quoteVe({ ...v.inputs, lot: params.lotVe });
    if (!q || !amountOf(dir, v.inputs)) return toast('Nhập đủ giá báo và số tiền khách đưa trước.', 'error');
    openDealForm({ dir, inputs: v.inputs, actual: {} }, { confirm });
  };
  root.append(card('Máy tính báo giá', h('div', {},
    seg(DIRS, dir, (v) => { dir = v; drawCalc(); }),
    calcHost,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', type: 'button', onclick: () => start(false) }, 'Lưu báo giá'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => start(true) }, '✓ Chốt giao dịch')),
    h('p', { class: 'field-hint' }, 'Khách chỉ hỏi giá thì bấm “Lưu báo giá” — chưa tính lãi. Chỉ khi chốt, lãi mới được cộng vào thẻ.')),
  { right: h('span', { class: 'sub' }, `Lô: ${fmtNum(params.lotSang)} ₫ · ${fmtNum(params.lotVe)} ₽`) }));
  drawCalc();

  // Danh sách
  const deals = [...store.all('deals')];
  if (!deals.length) {
    root.append(emptyState('Chưa có lệnh nào. Tính giá cho khách ở trên, rồi lưu báo giá hoặc chốt giao dịch.'));
  } else {
    const nQuote = deals.filter((d) => statusOf(d) === 'quote').length;
    const nDone = deals.length - nQuote;
    const listHost = h('div', {});
    const summary = h('div', { class: 'sub center' });
    const drawList = () => {
      const shown = deals.filter((d) => filter === 'all' || statusOf(d) === filter)
        .sort((a, b) => (a.date === b.date ? (b.ts || 0) - (a.ts || 0) : a.date < b.date ? 1 : -1));
      const doneAll = deals.filter((d) => statusOf(d) === 'done');
      const total = doneAll.reduce((s, d) => s + (dealProfit(d, params) || 0), 0);
      const thisMonth = todayStr().slice(0, 7);
      const m = doneAll.filter((d) => (d.date || '').startsWith(thisMonth)).reduce((s, d) => s + (dealProfit(d, params) || 0), 0);
      summary.replaceChildren('Lãi đã chốt: tháng này ', h('b', { class: `mono ${m >= 0 ? 'pos' : 'neg'}` }, money(m, 'VND', { sign: true })),
        ' · tất cả ', h('b', { class: `mono ${total >= 0 ? 'pos' : 'neg'}` }, money(total, 'VND', { sign: true })));
      if (!shown.length) { listHost.replaceChildren(emptyState(filter === 'quote' ? 'Không có báo giá nào đang chờ chốt.' : 'Chưa có lệnh nào đã chốt.')); return; }
      const byMonth = new Map();
      for (const d of shown) {
        const k = (d.date || '').slice(0, 7);
        if (!byMonth.has(k)) byMonth.set(k, []);
        byMonth.get(k).push(d);
      }
      listHost.replaceChildren(...[...byMonth.entries()].map(([k, list]) => {
        const profit = list.reduce((s, d) => s + (dealProfit(d, params) || 0), 0);
        const hasDone = list.some((d) => statusOf(d) === 'done');
        return card(monthLabel(k), h('div', { class: 'list' }, list.map((d) => dealRow(d, params))), {
          right: hasDone ? h('strong', { class: `mono ${profit >= 0 ? 'pos' : 'neg'}` }, `Lãi ${money(profit, 'VND', { sign: true })}`) : null,
        });
      }));
    };
    root.append(h('div', { class: 'filters' }, seg([
      { value: 'all', label: `Tất cả (${deals.length})` },
      { value: 'quote', label: `Chờ chốt (${nQuote})` },
      { value: 'done', label: `Đã chốt (${nDone})` },
    ], filter, (v) => { filter = v; drawList(); })));
    root.append(summary, listHost);
    drawList();
  }

  // Mở lệnh theo yêu cầu từ màn hình Giao dịch (bấm vào giao dịch lãi tự động).
  const rq = takeOpenRequest();
  if (rq) {
    const d = store.byId('deals', rq);
    if (d) setTimeout(() => openDealForm(d), 0);
  }
}

function pendingBanner(list, params) {
  const total = list.reduce((s, d) => s + (dealProfit(d, params) || 0), 0);
  let accountId = defaultProfitAccountId({ vndOnly: true });
  const accOpts = accountOptions({ only: (a) => a.currency === 'VND' });
  const sel = select(accOpts, accountId, (v) => { accountId = v; });
  return h('div', { class: 'banner info pending-post' },
    h('span', {}, `${list.length} lệnh đã chốt (lãi ${money(total, 'VND', { sign: true })}) chưa được cộng vào thẻ.`),
    accOpts.length ? sel : null,
    h('button', { class: 'btn small primary', type: 'button', disabled: !accOpts.length, onclick: async () => {
      if (!(await confirmBox(`Cộng lãi của ${list.length} lệnh vào thẻ đã chọn, đúng ngày của từng lệnh?`, { okLabel: 'Cộng vào thẻ' }))) return;
      try { const n = await postPending(accountId); toast(`Đã cộng lãi của ${n} lệnh vào thẻ.`, 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
    } }, 'Cộng vào thẻ'),
    h('button', { class: 'btn small', type: 'button', onclick: async () => {
      if (!(await confirmBox('Không cộng các lệnh này? Dùng khi số dư thẻ của bạn đã có sẵn khoản lãi đó.', { okLabel: 'Không cộng' }))) return;
      try { await skipPending(); toast('Đã bỏ qua.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
    } }, 'Đã có trong số dư — bỏ qua'));
}

function dealRow(d, params) {
  const st = statusOf(d);
  const r = evalDeal(d, params);
  const party = d.partyId && store.byId('parties', d.partyId);
  const amount = d.dir === 'sang' ? money(d.inputs.vndAmount, 'VND') : money(d.inputs.rubAmount, 'RUB');
  const pay = r.quote ? (d.dir === 'sang' ? money(r.quote.rubPay, 'RUB') : money(r.quote.vndPay, 'VND')) : '—';
  const right = [];
  if (st === 'done') {
    const p = dealProfit(d, params);
    right.push(h('span', { class: `amt mono ${p >= 0 ? 'pos' : 'neg'}` }, money(p, 'VND', { sign: true })));
    right.push(d.profitTxId ? chip('đã cộng vào thẻ', 'good') : d.postSkipped ? chip('không cộng thẻ', 'muted') : chip('chưa cộng thẻ', 'warn'));
  } else {
    right.push(chip('báo giá', 'muted'));
  }
  const row = h('button', { class: 'row', type: 'button', onclick: () => openDealForm(d) },
    h('span', { class: 'row-ico' }, d.dir === 'sang' ? '🇻🇳' : '🇷🇺'),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title' }, `${DIR_LABEL[d.dir]} · ${amount} → ${pay}`),
      h('span', { class: 'sub' }, [fmtDate(d.date), party ? party.name : null, d.note].filter(Boolean).join(' · '))),
    h('span', { class: 'row-right' }, right));
  return h('div', { class: 'row-wrap deal' }, row, st === 'quote'
    ? h('div', { class: 'deal-actions' }, h('button', { class: 'btn small primary', type: 'button', onclick: () => openDealForm(d, { confirm: true }) }, '✓ Chốt giao dịch'))
    : null);
}

/**
 * Cửa sổ xem / sửa / chốt lệnh.
 *  d: lệnh có sẵn hoặc bản nháp từ máy tính ({dir, inputs}).  confirm: mở thẳng ở bước chốt.
 */
export function openDealForm(d0, { confirm = false } = {}) {
  const params = store.settings().params;
  const id = d0.id || newDealId();
  const isNew = !(d0.id && store.byId('deals', d0.id));
  const wasDone = statusOf(d0) === 'done';
  const dir0 = d0.dir;
  const linkedTx = d0.profitTxId ? store.byId('txs', d0.profitTxId) : null;
  // Thẻ nhận lãi: thẻ nào cũng được (VND hoặc ngoại tệ như thẻ rúp). Thẻ ngoại tệ → lãi quy đổi theo tỉ giá áng chừng.
  const accOpts = () => accountOptions({ includeArchived: true });
  const curOf = (id) => { const a = store.byId('accounts', id); return a ? a.currency : 'VND'; };
  const symOf = (c) => (CUR_INFO[c] ? CUR_INFO[c].symbol : c);
  const decOf = (c) => (c === 'VND' ? 0 : (CUR_INFO[c] ? CUR_INFO[c].dec : 2));

  const st = {
    date: d0.date || todayStr(), partyId: d0.partyId || '', note: d0.note || '',
    mode: wasDone || confirm ? 'confirm' : 'quote',
    manual: false,
    post: wasDone ? !!linkedTx : accOpts().length > 0,
    accountId: linkedTx ? linkedTx.accountId : defaultProfitAccountId(),
    unit: d0.profitUnit && d0.profitUnit !== 'VND' ? d0.profitUnit : 'VND', // đơn vị bạn nhập số lãi
    rate: Number(d0.profitRate) > 0 ? String(d0.profitRate) : '',          // ₫ cho 1 đơn vị ngoại tệ
    rateTouched: Number(d0.profitRate) > 0,
  };
  const F = () => foreignFor(curOf(st.accountId));
  if (st.unit !== 'VND' && st.unit !== F()) st.unit = 'VND';
  let suggestion = { value: null, source: null };

  const editor = dealEditor({ dir: dir0, inputs: d0.inputs || {}, actual: d0.actual || {}, params, onChange: () => syncProfit() });

  const hint = h('span', { class: 'field-hint' });
  const summary = h('p', { class: 'field-hint' });
  const resetBtn = h('button', { class: 'btn small', type: 'button', onclick: () => { st.manual = false; syncProfit(); } }, 'Dùng số tự tính');

  // Lắng nghe thẳng sự kiện gõ phím (kể cả khi ô bị xóa trống — lúc đó moneyInput không báo onChange).
  const onTyped = () => { st.manual = true; refreshHint(); refreshSummary(); };
  const profitCtl = moneyInput({ value: wasDone && d0.profit != null ? Math.round(d0.profit) : '', currency: 'VND' });
  const fxCtl = moneyInput({ value: '', currency: st.unit === 'VND' ? F() : st.unit });
  const rateCtl = moneyInput({ value: st.rate, currency: null, placeholder: 'ví dụ 330' });
  profitCtl.input.addEventListener('input', onTyped);
  fxCtl.input.addEventListener('input', onTyped);
  rateCtl.input.addEventListener('input', () => {
    st.rate = rateCtl.input.value;
    st.rateTouched = true;
    if (st.unit !== 'VND' && !st.manual) setActiveValue(suggestion.value);
    refreshSummary();
  });

  const rateNum = () => { const r = parseExpr(rateCtl.input.value); return r && r.total > 0 ? r.total : NaN; };
  const activeCtl = () => (st.unit === 'VND' ? profitCtl : fxCtl);
  /** Lãi VND của số đang nhập (NaN nếu chưa đọc được hoặc thiếu tỉ giá). */
  const currentVnd = () => {
    const v = activeCtl().get();
    if (!Number.isFinite(v)) return NaN;
    return st.unit === 'VND' ? v : v * rateNum();
  };
  const needRate = () => st.unit !== 'VND' || (st.post && curOf(st.accountId) !== 'VND');

  // Tỉ giá gợi ý: rúp → giá báo của chính lệnh này; không có thì tỉ giá trong Cài đặt.
  function defaultRate(f) {
    if (f === 'RUB') {
      const q = evalDeal({ dir: dir0, ...editor.get() }, params).quote;
      if (q && q.quote > 0) return roundTo(q.quote, 2);
    }
    const sr = Number((store.settings().rates || {})[f]);
    return sr > 0 ? sr : '';
  }
  function applyRateDefault() {
    if (st.rateTouched) return;
    const d = defaultRate(F());
    st.rate = d === '' ? '' : String(d);
    rateCtl.set(st.rate);
  }
  /** Đặt ô đang hiện theo số lãi VND (đổi sang đơn vị đang chọn). */
  function setActiveValue(vnd) {
    if (st.unit === 'VND') profitCtl.set(vnd == null || !Number.isFinite(vnd) ? '' : Math.round(vnd));
    else {
      const r = rateNum();
      fxCtl.set(vnd == null || !Number.isFinite(vnd) || !(r > 0) ? '' : roundTo(vnd / r, decOf(st.unit)));
    }
  }

  function refreshHint() {
    const s = suggestion;
    const u = st.unit === 'VND' ? 'VND' : st.unit;
    hint.textContent = st.manual
      ? 'Bạn đã tự nhập số lãi.'
      : s.source === 'real' ? 'Tự tính từ giá thực tế. Sửa số này nếu lãi thật khác.'
        : s.source === 'quote' ? 'Đang lấy lãi theo giá báo — điền giá thực tế bên trên để tính chính xác.'
          : `Nhập lãi thực nhận (${u}).`;
    resetBtn.hidden = !(st.manual && s.value != null);
  }
  function refreshSummary() {
    const rateOn = needRate();
    summary.hidden = !rateOn;
    if (!rateOn) return;
    const typed = activeCtl().get();
    const cardCur = st.post ? curOf(st.accountId) : 'VND';
    const c = convertProfit({ amount: Number.isFinite(typed) ? typed : '', unit: st.unit, cardCurrency: cardCur, rate: rateNum() });
    summary.classList.toggle('bad', !c.ok && Number.isFinite(typed));
    if (!c.ok) { summary.textContent = Number.isFinite(typed) ? c.error : ''; return; }
    const acc = store.byId('accounts', st.accountId);
    const parts = [`Lãi tính ra ${money(c.vnd, 'VND', { sign: true })}`];
    if (st.post && cardCur !== 'VND') parts.push(`cộng ${money(c.card, cardCur, { sign: true })} vào thẻ “${acc ? acc.name : ''}”`);
    summary.textContent = `${parts.join(' · ')} (tỉ giá áng chừng ${fmtNum(c.rate, 4)} ₫/${c.foreign}).`;
  }
  function syncProfit() {
    suggestion = suggestedProfit({ dir: dir0, ...editor.get() }, params);
    applyRateDefault();
    if (!st.manual) setActiveValue(suggestion.value);
    refreshHint();
    refreshSummary();
  }

  const unitHost = h('div', { class: 'unit-host' });
  const rateLabel = h('span', { class: 'field-label' });
  const rateField = h('label', { class: 'field' }, rateLabel, rateCtl.el,
    h('span', { class: 'field-hint' }, 'Chỉ để quy đổi lãi — nhập số áng chừng. Mặc định lấy từ giá báo của lệnh (rúp) hoặc từ Cài đặt; sửa lại nếu muốn.'));
  /** Hiện đúng ô nhập theo đơn vị đang chọn; ô tỉ giá chỉ hiện khi có quy đổi. */
  function showInputs() {
    const f = F();
    profitCtl.el.hidden = st.unit !== 'VND';
    fxCtl.el.hidden = st.unit === 'VND';
    fxCtl.setCurrency(st.unit === 'VND' ? f : st.unit);
    rateField.hidden = !needRate();
    rateLabel.textContent = `Tỉ giá áng chừng (₫ cho 1 ${f})`;
  }
  function drawUnit() {
    const f = F();
    unitHost.replaceChildren(seg([{ value: 'VND', label: '₫ VND' }, { value: f, label: `${symOf(f)} ${f}` }], st.unit, setUnit));
  }
  function setUnit(u) {
    const oldVnd = currentVnd();
    st.unit = u;
    showInputs();
    if (st.manual) setActiveValue(oldVnd); else setActiveValue(suggestion.value);
    refreshHint();
    refreshSummary();
  }
  function onCardChange(id) {
    const oldF = F();
    const oldVnd = currentVnd();
    const oldUnit = st.unit;
    st.accountId = id;
    if (F() !== oldF) { st.rateTouched = false; if (st.unit !== 'VND') st.unit = 'VND'; }
    applyRateDefault();
    drawUnit();
    showInputs();
    if (st.unit !== oldUnit) { if (st.manual) setActiveValue(oldVnd); else setActiveValue(suggestion.value); }
    refreshHint();
    refreshSummary();
  }

  const pSel = select(partyOptions(null, '— Không chọn —'), st.partyId, (v) => { st.partyId = v; });
  const accSel = select(accOpts(), st.accountId, onCardChange);
  accSel.disabled = !st.post;
  const postChk = h('input', { type: 'checkbox', checked: st.post, onchange: (e) => { st.post = e.target.checked; accSel.disabled = !st.post; showInputs(); refreshSummary(); } });
  const noAcc = h('p', { class: 'field-hint bad' }, 'Chưa có tài khoản nào — bấm “＋ Thẻ mới” để tạo thẻ nhận lãi.');
  noAcc.hidden = accOpts().length > 0;
  // Thẻ nhận lãi là tùy chọn của từng lệnh: chọn thẻ có sẵn, hoặc tạo thẻ mới (VND hoặc rúp…) ngay tại đây.
  const newCardBtn = h('button', {
    class: 'btn small', type: 'button',
    onclick: () => openAccountForm(null, {
      onSaved: (a) => {
        accSel.replaceChildren(...accOpts().map((o) => h('option', { value: o.value, selected: o.value === a.id }, o.label)));
        st.post = true;
        postChk.checked = true;
        accSel.disabled = false;
        noAcc.hidden = true;
        onCardChange(a.id);
      },
    }),
  }, '＋ Thẻ mới');

  // Mở lại lệnh đã chốt: hiện lại đúng số đã nhập (theo đơn vị đã chọn lúc đó).
  suggestion = suggestedProfit({ dir: dir0, ...editor.get() }, params);
  if (wasDone) {
    st.manual = suggestion.value == null || Math.round(suggestion.value) !== Math.round(Number(d0.profit) || 0);
    if (st.unit !== 'VND') {
      const r = Number(d0.profitRate);
      const signed = linkedTx && linkedTx.currency === st.unit ? (linkedTx.kind === 'expense' ? -1 : 1) * linkedTx.amount : (r > 0 ? roundTo((Number(d0.profit) || 0) / r, decOf(st.unit)) : '');
      fxCtl.set(signed);
    }
    applyRateDefault();
  } else syncProfit();
  drawUnit();
  showInputs();
  refreshHint();
  refreshSummary();

  const confirmHost = h('div', { class: 'form confirm-box' },
    editor.actualEl,
    h('div', { class: 'field' },
      h('span', { class: 'field-label' }, 'Lãi ghi nhận (âm nếu lỗ)'),
      unitHost, profitCtl.el, fxCtl.el, hint, resetBtn),
    rateField,
    summary,
    h('label', { class: 'check' }, postChk, ' Cộng lãi vào thẻ (ghi một khoản thu đúng ngày của lệnh)'),
    field('Thẻ nhận lãi', h('div', { class: 'row-inline' }, accSel, newCardBtn), 'Thẻ VND hoặc thẻ rúp… đều được; thẻ ngoại tệ thì lãi được quy đổi theo tỉ giá áng chừng ở trên. App nhớ thẻ bạn chọn để gợi ý lần sau.'),
    noAcc,
    !wasDone || linkedTx ? null : h('p', { class: 'field-hint' }, d0.postSkipped ? 'Lệnh này đang được đánh dấu “không cộng thẻ”.' : 'Lệnh này chưa được cộng vào thẻ.'));

  const statusChip = () => (statusOf(d0) === 'done' ? chip('Đã chốt', 'good') : chip('Báo giá', 'muted'));
  const body = h('div', { class: 'form' },
    h('div', { class: 'chips' }, chip(DIR_LABEL[dir0] + (dir0 === 'sang' ? ' · VND → RUB' : ' · RUB → VND')), isNew ? null : statusChip()),
    h('div', { class: 'grid2' },
      field('Ngày giao dịch', h('input', { type: 'date', value: st.date, onchange: (e) => { st.date = e.target.value; } })),
      field('Khách', h('div', { class: 'row-inline' }, pSel, h('button', { class: 'btn small', type: 'button', onclick: () => openPartyForm({ role: 'customer', onSaved: (p) => { st.partyId = p.id; pSel.replaceChildren(...partyOptions(null, '— Không chọn —').map((o) => h('option', { value: o.value, selected: o.value === p.id }, o.label))); } }) }, '＋')))),
    editor.inputsEl,
    confirmHost,
    field('Ghi chú', h('input', { type: 'text', value: st.note, oninput: (e) => { st.note = e.target.value; } })));

  const foot = h('div', { class: 'sheet-foot inline deal-foot' });

  function buildDoc() {
    const v = editor.get();
    const r = evalDeal({ dir: dir0, ...v }, params);
    if (!r.quote || !amountOf(dir0, v.inputs)) { toast('Chưa đủ dữ liệu: cần giá báo và số tiền khách đưa.', 'error'); return null; }
    if (!st.date) { toast('Chọn ngày giao dịch.', 'error'); return null; }
    return {
      ...d0, id, dir: dir0, date: st.date, partyId: st.partyId, note: st.note.trim(),
      inputs: v.inputs, actual: v.actual,
      // ảnh chụp kết quả để lịch sử không đổi khi sau này chỉnh tham số
      result: { quote: r.quote.quote, rubPay: r.quote.rubPay ?? null, vndPay: r.quote.vndPay ?? null },
    };
  }

  async function run(fn, okMsg) {
    try { await fn(); m.close(); toast(okMsg, 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  }

  const onSaveQuote = () => {
    const doc = buildDoc();
    if (!doc) return;
    const { profit, profitTxId, postSkipped, profitUnit, profitRate, ...rest } = doc; // eslint-disable-line no-unused-vars
    run(() => saveDeal({ ...rest, status: 'quote' }), 'Đã lưu báo giá.');
  };
  const onConfirm = () => {
    const doc = buildDoc();
    if (!doc) return;
    const typed = activeCtl().get();
    if (!Number.isFinite(typed)) return toast('Nhập số lãi (hoặc điền giá thực tế để tự tính).', 'error');
    if (st.post && !st.accountId) return toast('Chọn thẻ để cộng lãi.', 'error');
    const cardCur = st.post ? curOf(st.accountId) : 'VND';
    const conv = convertProfit({ amount: typed, unit: st.unit, cardCurrency: cardCur, rate: rateNum() });
    if (!conv.ok) return toast(conv.error, 'error');
    const inCard = cardCur !== 'VND' ? ` (${money(conv.card, cardCur, { sign: true })})` : '';
    const msg = st.post && conv.card !== 0 ? `Đã chốt. Lãi ${money(conv.vnd, 'VND', { sign: true })}${inCard} đã vào thẻ ngày ${fmtDate(st.date)}.` : 'Đã chốt giao dịch.';
    run(async () => {
      await confirmDeal(
        { ...doc, profit: conv.vnd, profitUnit: st.unit, profitRate: conv.rate },
        { post: st.post, accountId: st.accountId, cardAmount: st.post && cardCur !== 'VND' ? conv.card : null });
      if (st.post) rememberProfitAccount(st.accountId);
    }, msg);
  };
  const onDelete = async () => {
    const extra = d0.profitTxId ? ' Khoản lãi đã cộng vào thẻ cũng sẽ bị xóa.' : '';
    if (!(await confirmBox(`Xóa lệnh này?${extra}`, { okLabel: 'Xóa', danger: true }))) return;
    run(() => removeDeal(id), 'Đã xóa.');
  };
  const onRevert = async () => {
    const extra = d0.profitTxId ? ' Khoản lãi đã cộng vào thẻ sẽ bị gỡ.' : '';
    if (!(await confirmBox(`Hủy chốt, đưa lệnh về trạng thái báo giá?${extra}`, { okLabel: 'Hủy chốt', danger: true }))) return;
    run(() => revertDeal(id), 'Đã hủy chốt.');
  };

  function drawFoot() {
    const btn = (label, cls, fn) => h('button', { class: `btn ${cls}`.trim(), type: 'button', onclick: fn }, label);
    const kids = [];
    if (!isNew) kids.push(btn('Xóa', 'danger-ghost', onDelete));
    if (wasDone) kids.push(btn('Hủy chốt', 'ghost', onRevert));
    kids.push(h('span', { class: 'spacer' }), btn('Đóng', 'ghost', () => m.close()));
    if (wasDone) kids.push(btn('Lưu thay đổi', 'primary', onConfirm));
    else if (st.mode === 'confirm') kids.push(btn('Chỉ lưu báo giá', '', onSaveQuote), btn('✓ Xác nhận chốt', 'primary', onConfirm));
    else kids.push(btn(isNew ? 'Lưu báo giá' : 'Lưu', '', onSaveQuote), btn('✓ Chốt giao dịch', 'primary', () => { setMode('confirm'); }));
    foot.replaceChildren(...kids);
  }
  function setMode(mode) {
    st.mode = mode;
    confirmHost.hidden = mode !== 'confirm';
    if (mode === 'confirm') syncProfit();
    drawFoot();
    if (mode === 'confirm') confirmHost.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  body.append(foot);
  const title = wasDone ? 'Lệnh đã chốt' : isNew ? (confirm ? 'Chốt giao dịch' : 'Lưu báo giá') : 'Báo giá';
  const m = modal({ title, body, wide: true });
  confirmHost.hidden = st.mode !== 'confirm';
  drawFoot();
  return m;
}
