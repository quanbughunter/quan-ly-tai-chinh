// Thành phần giao diện dùng lại ở nhiều màn hình.

import { h, money, chip } from './ui.js';
import { store } from './store.js';
import { TX_KINDS } from './model.js';
import { fmtDate } from './dates.js';

const KIND_GLYPH = { income: '＋', expense: '－', transfer: '⇄', lend: '↗', repay_in: '↙', borrow: '↘', repay_out: '↖', adjust: '≈' };
const POSITIVE = new Set(['income', 'repay_in', 'borrow']);
const NEGATIVE = new Set(['expense', 'lend', 'repay_out']);

export function signedAmount(t) {
  if (POSITIVE.has(t.kind)) return { value: t.amount, cls: 'pos' };
  if (NEGATIVE.has(t.kind)) return { value: -t.amount, cls: 'neg' };
  if (t.kind === 'adjust') return { value: t.amount, cls: t.amount >= 0 ? 'pos' : 'neg' };
  return { value: t.amount, cls: '' }; // transfer
}

export function txTitle(t) {
  if (t.note) return t.note;
  const c = t.categoryId && store.byId('categories', t.categoryId);
  if (c) return c.name;
  const p = t.partyId && store.byId('parties', t.partyId);
  if (p) return `${TX_KINDS[t.kind]} · ${p.name}`;
  return TX_KINDS[t.kind] || t.kind;
}

export function txRow(t, { onClick, showDate = false } = {}) {
  const c = t.categoryId && store.byId('categories', t.categoryId);
  const a = t.accountId && store.byId('accounts', t.accountId);
  const to = t.toAccountId && store.byId('accounts', t.toAccountId);
  const p = t.partyId && store.byId('parties', t.partyId);
  const sub = [
    showDate ? fmtDate(t.date) : null,
    t.kind === 'transfer' ? `${a ? a.name : '?'} → ${to ? to.name : '?'}` : a ? a.name : null,
    c && t.note ? c.name : null,
    p && (t.note || c) ? p.name : null,
  ].filter(Boolean).join(' · ');
  const amt = signedAmount(t);
  const right = [h('div', { class: `amt mono ${amt.cls}` }, money(amt.value, t.currency, { sign: amt.cls === 'pos' }))];
  if (t.kind === 'transfer' && t.toAmount != null && to && to.currency !== t.currency) {
    right.push(h('div', { class: 'sub mono' }, `→ ${money(t.toAmount, to.currency)}`));
  }
  return h('button', { class: 'row', type: 'button', onclick: onClick },
    h('span', { class: `row-ico k-${t.kind}` }, c && c.icon ? c.icon : KIND_GLYPH[t.kind] || '•'),
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, txTitle(t)), h('span', { class: 'sub' }, sub)),
    h('span', { class: 'row-right' }, right));
}

export function card(title, content, { right, cls = '' } = {}) {
  return h('section', { class: `card ${cls}` },
    title || right ? h('div', { class: 'card-head' }, title ? h('h2', {}, title) : null, right || null) : null,
    content);
}

export function pageHead(title, actions) {
  return h('header', { class: 'page-head' }, h('h1', {}, title), actions ? h('div', { class: 'page-actions' }, actions) : null);
}

export function currencyChips(obj, { signed = false } = {}) {
  const entries = Object.entries(obj || {}).filter(([, v]) => Math.abs(v) > 1e-9);
  if (!entries.length) return [chip('0', 'muted')];
  return entries.map(([cur, v]) => chip(money(v, cur, { sign: signed }), v < 0 ? 'bad' : ''));
}
