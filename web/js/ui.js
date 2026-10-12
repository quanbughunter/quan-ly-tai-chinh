// Công cụ giao diện: tạo DOM an toàn (không dùng innerHTML với dữ liệu người dùng), hộp thoại, biểu đồ SVG.

import { fmtMoney, fmtNum, parseExpr, CURRENCIES } from './money.js';
import { store } from './store.js';

/* ───────── DOM ───────── */
function appendKids(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (['checked', 'disabled', 'selected', 'readOnly'].includes(k)) el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  appendKids(el, children);
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  appendKids(el, children);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/* ───────── Hiển thị tiền (có chế độ ẩn số dư) ───────── */
export function money(n, cur = 'VND', opts = {}) {
  if (store.settings().hideAmounts) return '•••••';
  return fmtMoney(n, cur, opts);
}

/* ───────── Thông báo ───────── */
let toastBox;
export function toast(msg, kind = 'info') {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastBox.append(t);
  setTimeout(() => t.classList.add('out'), kind === 'error' ? 5000 : 2600);
  setTimeout(() => t.remove(), kind === 'error' ? 5400 : 3000);
}

export function errMsg(e) {
  return (e && (e.message || e.error_description || e.msg)) || String(e);
}

/* ───────── Hộp thoại ───────── */
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) close(); } });
  const sheet = h('div', { class: `sheet${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const head = h('div', { class: 'sheet-head' }, h('h3', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Đóng', onclick: () => close() }, '✕'));
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  sheet.append(head, bodyEl);
  if (actions.length) sheet.append(h('div', { class: 'sheet-foot' }, actions));
  overlay.append(sheet);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  document.body.classList.add('modal-open');
  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (!document.querySelector('.overlay')) document.body.classList.remove('modal-open');
    if (onClose) onClose();
  }
  const first = sheet.querySelector('input:not([type=hidden]), select, textarea');
  if (first && window.matchMedia('(pointer:fine)').matches) first.focus();
  return { close, el: overlay, body: bodyEl };
}

export function confirmBox(message, { okLabel = 'Đồng ý', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } m.close(); };
    const m = modal({
      title: 'Xác nhận',
      body: h('p', { class: 'confirm-text' }, message),
      actions: [
        h('button', { class: 'btn ghost', onclick: () => finish(false) }, 'Hủy'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => finish(true) }, okLabel),
      ],
      onClose: () => { if (!done) { done = true; resolve(false); } },
    });
  });
}

/* ───────── Biểu mẫu ───────── */
export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function select(options, value, onChange, attrs = {}) {
  const el = h('select', { ...attrs, onchange: onChange ? (e) => onChange(e.target.value) : null });
  for (const o of options) el.append(h('option', { value: o.value, selected: String(o.value) === String(value ?? '') }, o.label));
  return el;
}

export function seg(options, value, onChange) {
  // Không dựng lại nút khi bấm: nếu seg nằm trong <label class="field"> thì nút bị gỡ khỏi DOM
  // sẽ khiến trình duyệt chuyển cú bấm sang nút đầu tiên.
  const wrap = h('div', { class: 'seg', role: 'tablist' });
  const btns = options.map((o) => h('button', {
    type: 'button',
    class: 'seg-btn',
    role: 'tab',
    onclick: (e) => { e.preventDefault(); mark(o.value); onChange(o.value); },
  }, o.label));
  function mark(v) {
    btns.forEach((b, i) => {
      const on = String(options[i].value) === String(v);
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  wrap.append(...btns);
  mark(value);
  return wrap;
}

/** Ô nhập số tiền: gõ được "25k", "1,5tr", "3tr+500k-120000". Hiện giá trị đã hiểu bên dưới. */
export function moneyInput({ value = '', currency = 'VND', placeholder = '0', onChange } = {}) {
  const preview = h('span', { class: 'field-hint mono' });
  const input = h('input', { type: 'text', inputmode: 'text', autocomplete: 'off', placeholder, value: value === '' || value == null ? '' : String(value) });
  const cur = { c: currency };
  const refresh = () => {
    const t = input.value.trim();
    if (!t) { preview.textContent = ''; return; }
    const r = parseExpr(t);
    preview.textContent = r ? `= ${cur.c ? fmtMoney(r.total, cur.c) : fmtNum(r.total, 4)}` : 'Không đọc được số tiền';
    preview.classList.toggle('bad', !r);
    if (onChange) onChange(r ? r.total : NaN);
  };
  input.addEventListener('input', refresh);
  refresh();
  const el = h('div', { class: 'money-input' }, input, preview);
  return {
    el,
    input,
    get: () => { const r = parseExpr(input.value); return r ? r.total : NaN; },
    set: (v) => { input.value = v == null ? '' : String(v); refresh(); },
    setCurrency: (c) => { cur.c = c; refresh(); },
  };
}

export const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

export function numInput(value, attrs = {}) {
  return h('input', { type: 'number', step: 'any', inputmode: 'decimal', value: value == null ? '' : value, ...attrs });
}

export function emptyState(text, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-ico' }, '🫧'), h('p', {}, text), action || null);
}

/* ───────── Biểu đồ SVG ───────── */
export function donut(data, { size = 168, thickness = 26 } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'donut', role: 'img' });
  root.append(svg('circle', { cx: c, cy: c, r, fill: 'none', stroke: 'var(--line)', 'stroke-width': thickness }));
  if (total > 0) {
    let offset = 0;
    for (const d of data) {
      const len = (d.value / total) * circ;
      root.append(svg('circle', {
        cx: c, cy: c, r, fill: 'none', stroke: d.color, 'stroke-width': thickness,
        'stroke-dasharray': `${Math.max(len - 1.5, 0)} ${circ - Math.max(len - 1.5, 0)}`,
        'stroke-dashoffset': -offset,
        transform: `rotate(-90 ${c} ${c})`,
      }));
      offset += len;
    }
  }
  return root;
}

/** Cột ghép thu/chi theo tháng. series: [{label, a (thu), b (chi)}] */
export function barPairs(series, { height = 150 } = {}) {
  const W = 320;
  const pad = { l: 4, r: 4, t: 8, b: 22 };
  const max = Math.max(1, ...series.flatMap((s) => [s.a, s.b]));
  const slot = (W - pad.l - pad.r) / series.length;
  const bw = Math.min(16, slot / 2.6);
  const root = svg('svg', { viewBox: `0 0 ${W} ${height}`, class: 'bars', role: 'img', preserveAspectRatio: 'none' });
  series.forEach((s, i) => {
    const x0 = pad.l + i * slot + slot / 2;
    const ph = height - pad.t - pad.b;
    const ha = (s.a / max) * ph;
    const hb = (s.b / max) * ph;
    root.append(svg('rect', { x: x0 - bw - 1, y: pad.t + ph - ha, width: bw, height: Math.max(ha, 0), rx: 4, fill: 'var(--mint)' }));
    root.append(svg('rect', { x: x0 + 1, y: pad.t + ph - hb, width: bw, height: Math.max(hb, 0), rx: 4, fill: 'var(--rose)' }));
    root.append(svg('text', { x: x0, y: height - 6, 'text-anchor': 'middle', class: 'axis' }, s.label));
  });
  return root;
}

export function progress(pct, { warn = 0.8 } = {}) {
  const p = Math.max(0, Math.min(1, pct));
  const cls = pct > 1 ? 'over' : pct >= warn ? 'warn' : 'ok';
  return h('div', { class: `progress ${cls}` }, h('i', { style: { width: `${p * 100}%` } }));
}

export function chip(text, cls = '') {
  return h('span', { class: `chip ${cls}` }, text);
}

export function fmtPct(p) {
  return `${fmtNum(p * 100, 0)}%`;
}

export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      resolve(f ? { name: f.name, text: await f.text() } : null);
    });
    document.body.append(inp);
    inp.click();
  });
}
