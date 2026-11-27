// Cầu nối giữa kho dữ liệu (store.js, không phụ thuộc React) và React.
// Mỗi lần kho phát sự kiện, "phiên bản" tăng lên và mọi component đang dùng useStore() được vẽ lại.
// Nhiều sự kiện liên tiếp (putMany, nhập dữ liệu…) được gộp thành một lần vẽ lại.

import { useSyncExternalStore } from 'react';
import { store } from '@logic/store.js';

let version = 0;
let timer = null;
let hooked = false;
const subs = new Set();

function hook() {
  if (hooked) return;
  hooked = true;
  store.on(() => {
    version += 1;
    if (timer) return;
    timer = setTimeout(() => { timer = null; subs.forEach((f) => f()); }, 0);
  });
}

const subscribe = (fn) => { hook(); subs.add(fn); return () => subs.delete(fn); };
const getVersion = () => version;

/** Gọi ở đầu component; trả số phiên bản (dùng làm khóa cho useMemo). */
export function useStore() {
  hook();
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

export { store };
