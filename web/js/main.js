// Điểm vào của ứng dụng: khởi động kho dữ liệu, định tuyến theo hash, khung điều hướng.

import { h, svg, modal, toast, errMsg, debounce, $ } from './ui.js';
import { store } from './store.js';
import { applyTheme } from './theme.js';
import { openTxForm, openQuickAdd } from './forms.js';
import { renderLogin } from './screens/login.js';
import * as dashboard from './screens/dashboard.js';
import * as transactions from './screens/transactions.js';
import * as income from './screens/income.js';
import * as accounts from './screens/accounts.js';
import * as debts from './screens/debts.js';
import * as exchange from './screens/exchange.js';
import * as dorm from './screens/dorm.js';
import * as scholarship from './screens/scholarship.js';
import * as settings from './screens/settings.js';

const ROUTES = {
  home: { title: 'Tổng quan', icon: 'home', mod: dashboard },
  tx: { title: 'Giao dịch', icon: 'list', mod: transactions },
  income: { title: 'Thu nhập', icon: 'brief', mod: income },
  accounts: { title: 'Tài khoản', icon: 'card', mod: accounts },
  debts: { title: 'Vay nợ', icon: 'users', mod: debts },
  fx: { title: 'Báo tỉ giá', icon: 'swap', mod: exchange },
  dorm: { title: 'Tiền KTX', icon: 'building', mod: dorm },
  scholarship: { title: 'Học bổng MIIGAiK', icon: 'cap', mod: scholarship },
  settings: { title: 'Cài đặt', icon: 'sliders', mod: settings },
};
const SIDE_ORDER = ['home', 'tx', 'income', 'accounts', 'debts', 'fx', 'dorm', 'scholarship', 'settings'];
const TAB_ORDER = ['home', 'tx', 'accounts', 'debts'];

const ICON_PATHS = {
  home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  card: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  swap: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  bars: 'M12 20V10M18 20V4M6 20v-4',
  brief: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01',
  cap: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
};
const icon = (name) => svg('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': name === 'more' ? 3 : 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg('path', { d: ICON_PATHS[name] }));

/* ───────── Định tuyến ───────── */
function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [name = '', id = ''] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(query));
  if (id) params.id = decodeURIComponent(id);
  return { name: name || 'home', params };
}

const needsLogin = () => store.mode === 'cloud' && !store.user;

let shell = null; // { view, side, tabs, banner }

function buildShell(app) {
  const side = h('aside', { class: 'side' },
    h('a', { class: 'brand', href: '#/' }, h('img', { class: 'brand-mark', src: 'icons/icon.svg', alt: '', width: 38, height: 38 }), h('span', {}, 'Quản lý tài chính')),
    h('nav', { 'aria-label': 'Điều hướng' }, SIDE_ORDER.map((k) => h('a', { class: 'side-link', href: `#/${k === 'home' ? '' : k}`, 'data-route': k }, icon(ROUTES[k].icon), h('span', {}, ROUTES[k].title)))),
    h('button', { class: 'btn primary block', onclick: openAddMenu }, '＋ Thêm giao dịch'),
    h('p', { class: 'side-hint' }, 'Phím tắt: N = thêm, Q = nhập nhanh'));

  const tabs = h('nav', { class: 'tabbar', 'aria-label': 'Điều hướng chính' },
    TAB_ORDER.map((k) => h('a', { class: 'tab', href: `#/${k === 'home' ? '' : k}`, 'data-route': k }, icon(ROUTES[k].icon), h('span', {}, ROUTES[k].title))),
    h('button', { class: 'tab', type: 'button', 'data-route': 'more', onclick: openMoreMenu }, icon('more'), h('span', {}, 'Khác')));

  const banner = h('div', { class: 'banners' });
  const view = h('main', { class: 'view', id: 'view' });
  const fab = h('button', { class: 'fab', type: 'button', 'aria-label': 'Thêm giao dịch', onclick: openAddMenu }, icon('plus'));
  app.replaceChildren(side, h('div', { class: 'content' }, banner, view), tabs, fab);
  return { view, side, tabs, banner };
}

function paintBanners() {
  if (!shell) return;
  const items = [];
  if (!navigator.onLine) items.push(h('div', { class: 'banner warn' }, 'Không có mạng — ghi dữ liệu có thể thất bại.'));
  if (store.offline) items.push(h('div', { class: 'banner warn' }, h('span', {}, 'Đang xem bản lưu gần nhất (ngoại tuyến). Chưa ghi được cho đến khi có mạng.'), h('button', { class: 'btn small', onclick: () => store.refresh().catch((e) => toast(errMsg(e), 'error')) }, 'Thử lại')));
  if (store.mode === 'local') items.push(h('div', { class: 'banner info' }, h('span', {}, 'Chế độ thử: dữ liệu chỉ lưu trong trình duyệt này. ', h('a', { href: '#/settings' }, 'Cài đặt'))));
  shell.banner.replaceChildren(...items);
}

function paintNav(name) {
  if (!shell) return;
  for (const a of shell.side.querySelectorAll('[data-route]')) a.toggleAttribute('aria-current', a.dataset.route === name);
  for (const a of shell.tabs.querySelectorAll('[data-route]')) {
    const on = a.dataset.route === name || (a.dataset.route === 'more' && !TAB_ORDER.includes(name));
    a.toggleAttribute('aria-current', on);
  }
}

let current = null;
function route({ keepScroll = false } = {}) {
  const app = $('#app');
  if (needsLogin()) {
    shell = null;
    current = null;
    app.className = 'app login';
    app.replaceChildren();
    renderLogin(app, () => { location.hash = '#/'; start(); });
    return;
  }
  app.className = 'app';
  if (!shell || !app.contains(shell.view)) shell = buildShell(app);
  const { name, params } = parseHash();
  const def = ROUTES[name] || ROUTES.home;
  const key = ROUTES[name] ? name : 'home';
  const y = window.scrollY;
  shell.view.replaceChildren();
  try {
    def.mod.render(shell.view, { params });
  } catch (e) {
    console.error(e);
    shell.view.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Có lỗi khi hiển thị màn hình'), h('p', { class: 'sub' }, errMsg(e)), h('a', { class: 'btn', href: '#/' }, 'Về Tổng quan')));
  }
  document.title = `${def.title} · Quản lý tài chính`;
  paintNav(key);
  paintBanners();
  const changed = current !== key + JSON.stringify(params);
  current = key + JSON.stringify(params);
  window.scrollTo(0, keepScroll && !changed ? y : 0);
}

/* ───────── Menu thêm / menu khác ───────── */
function openAddMenu() {
  if (!store.ready) return;
  const go = (fn) => () => { m.close(); fn(); };
  const item = (ico, title, sub, fn) => h('button', { class: 'menu-item', type: 'button', onclick: go(fn) }, h('span', { class: 'row-ico' }, ico), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, title), h('span', { class: 'sub' }, sub)));
  const m = modal({
    title: 'Thêm mới',
    body: h('div', { class: 'menu' },
      item('－', 'Khoản chi', 'Ghi một khoản chi tiêu', () => openTxForm({ group: 'expense' })),
      item('＋', 'Khoản thu', 'Lương, học bổng, tiền làm thêm… (có thể gửi bố)', () => openQuickAdd('', { income: true })),
      item('✍️', 'Nhập nhanh nhiều khoản', 'Ví dụ: cafe 25k, ăn trưa 45k, +lương 10tr', () => openQuickAdd('')),
      item('⇄', 'Chuyển / đổi tiền', 'Giữa hai tài khoản, kể cả khác tiền tệ', () => openTxForm({ group: 'transfer' })),
      item('🤝', 'Vay nợ', 'Cho vay, nhận trả, đi vay, trả nợ', () => openTxForm({ group: 'debt' }))),
  });
}

function openMoreMenu() {
  const more = SIDE_ORDER.filter((k) => !TAB_ORDER.includes(k));
  const m = modal({
    title: 'Khác',
    body: h('div', { class: 'menu' }, more.map((k) => h('a', { class: 'menu-item', href: `#/${k}`, onclick: () => m.close() }, h('span', { class: 'row-ico' }, icon(ROUTES[k].icon)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, ROUTES[k].title))))),
  });
}

/* ───────── Khởi động ───────── */
let started = false;
let unsub = null;

function start() {
  const rerender = debounce(() => { if (!needsLogin()) route({ keepScroll: true }); else route(); }, 30);
  if (unsub) unsub();
  unsub = store.on(rerender);
  route();
  if (started) return;
  started = true;

  window.addEventListener('hashchange', () => route());
  window.addEventListener('online', () => { paintBanners(); if (store.mode === 'cloud') store.refresh().catch(() => {}); });
  window.addEventListener('offline', paintBanners);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || store.mode !== 'cloud' || !store.user) return;
    if (Date.now() - store.loadedAt < 30000 || document.querySelector('.overlay')) return;
    store.refresh().catch(() => {});
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.overlay') || needsLogin()) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAddMenu(); }
    if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); openQuickAdd(''); }
  });
}

function showFatal(app, e) {
  app.className = 'app login';
  app.replaceChildren(h('div', { class: 'login-wrap' }, h('div', { class: 'login-card' },
    h('div', { class: 'login-logo' }, '⚠️'),
    h('h1', {}, 'Không mở được dữ liệu'),
    h('p', { class: 'sub center' }, errMsg(e)),
    h('button', { class: 'btn primary block', onclick: () => location.reload() }, 'Thử lại'))));
}

async function boot() {
  applyTheme();
  const app = $('#app');
  const cfg = window.APP_CONFIG || {};
  try {
    await store.init(cfg);
  } catch (e) {
    console.error(e);
    showFatal(app, e);
    return;
  }
  start();
  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator) || window.Capacitor) return;
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW:', e));
}

if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
boot();
