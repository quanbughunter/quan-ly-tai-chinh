// Hộp thoại dạng lệnh: openDialog(({ close }) => <XxxForm />) mở một hộp, nhiều hộp xếp chồng nhau.
// Nút Back của Android gọi closeTopDialog() để đóng từng lớp một (xem @logic/backnav.js).
import { createContext, useContext, useSyncExternalStore } from 'react';

let nextId = 1;
let entries = []; // { id, open, render, api }
const subs = new Set();
const set = (next) => { entries = next; subs.forEach((f) => f()); };
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const getEntries = () => entries;

const CLOSE_MS = 220; // khớp thời lượng hiệu ứng đóng của Modal

function closeEntry(id) {
  const e = entries.find((x) => x.id === id);
  if (!e || !e.open) return;
  set(entries.map((x) => (x.id === id ? { ...x, open: false } : x)));
  setTimeout(() => set(entries.filter((x) => x.id !== id)), CLOSE_MS);
}

/** render: ({ close }) => ReactNode. Trả { close }. */
export function openDialog(render) {
  const id = nextId++;
  const api = { id, close: () => closeEntry(id) };
  set([...entries, { id, open: true, render, api }]);
  return api;
}

export const hasOpenDialog = () => entries.some((e) => e.open);

/** Đóng lớp trên cùng. Nếu đang mở danh sách chọn (Select) thì đóng danh sách trước. Trả true nếu đã đóng được gì đó. */
export function closeTopDialog() {
  if (typeof document !== 'undefined' && document.querySelector('[data-slot="select-content"][data-state="open"]')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].open) { closeEntry(entries[i].id); return true; }
  }
  return false;
}

const Ctx = createContext({ open: true, close: () => {} });
export const useDialog = () => useContext(Ctx);

export function DialogHost() {
  const list = useSyncExternalStore(subscribe, getEntries, getEntries);
  return list.map((e) => (
    <Ctx.Provider key={e.id} value={{ open: e.open, close: e.api.close }}>{e.render(e.api)}</Ctx.Provider>
  ));
}

/** Hộp xác nhận. Trả Promise<boolean>. */
export function confirmBox(message, { okLabel = 'Đồng ý', danger = false, title = 'Xác nhận' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, close) => { if (!done) { done = true; resolve(v); } close(); };
    openDialog((api) => <ConfirmContent message={message} okLabel={okLabel} danger={danger} title={title} onDone={(v) => finish(v, api.close)} onDismiss={() => { if (!done) { done = true; resolve(false); } }} />);
  });
}

import { ConfirmContent } from '@/components/confirm-content.jsx';
