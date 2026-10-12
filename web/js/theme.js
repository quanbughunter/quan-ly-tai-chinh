// Giao diện sáng / tối. Lưu lựa chọn trong localStorage (nếu có), mặc định theo hệ thống.

const KEY = 'qltc:theme';

export function getTheme() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}

export function setTheme(mode) {
  try { localStorage.setItem(KEY, mode); } catch { /* bỏ qua */ }
  applyTheme();
}

export function applyTheme() {
  const mode = getTheme();
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1b1d2b' : '#f4f1fb');
}
