import { useSyncExternalStore } from 'react';

const subscribe = (fn) => {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
};
const get = () => document.documentElement.getAttribute('data-theme') || 'light';

/** 'light' | 'dark' đang áp dụng lên giao diện. */
export const useResolvedTheme = () => useSyncExternalStore(subscribe, get, () => 'light');
