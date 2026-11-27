// Danh sách lựa chọn cho các ô chọn (tài khoản, danh mục, người) — dạng [{ value, label }].
import { store } from '@logic/store.js';

export function accountOptions({ none = null, includeArchived = false, only } = {}) {
  const list = store.all('accounts')
    .filter((a) => (includeArchived || !a.archived) && (!only || only(a)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
  const opts = list.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }));
  return none ? [{ value: '', label: none }, ...opts] : opts;
}

export function categoryOptions(type, none = '— Không phân loại —') {
  const list = store.all('categories').filter((c) => !type || c.type === type)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
  return [{ value: '', label: none }, ...list.map((c) => ({ value: c.id, label: `${c.icon || ''} ${c.name}`.trim() }))];
}

export function partyOptions(roles, none = '— Chọn người —') {
  const list = store.all('parties').filter((p) => !roles || roles.includes(p.role || 'person'))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return [{ value: '', label: none }, ...list.map((p) => ({ value: p.id, label: p.name }))];
}

export { CURRENCIES } from '@logic/money.js';
import { CURRENCIES } from '@logic/money.js';
export const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

export const catById = (id) => store.byId('categories', id);
export const accById = (id) => store.byId('accounts', id);
export const partyById = (id) => store.byId('parties', id);
