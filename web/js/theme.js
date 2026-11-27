// Giao diện sáng / tối. Lưu lựa chọn trong localStorage (nếu có), mặc định theo hệ thống.
// Luôn ghi data-theme = light | dark lên <html> (kể cả chế độ "theo máy") để CSS chỉ cần một nhánh.

const KEY = 'qltc:theme';

export function getTheme() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}

export function setTheme(mode) {
  try { localStorage.setItem(KEY, mode); } catch { /* bỏ qua */ }
  applyTheme();
}

export function resolvedTheme() {
  const mode = getTheme();
  if (mode === 'light' || mode === 'dark') return mode;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme() {
  const t = resolvedTheme();
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#15141f' : '#f6f5fb');
}
