import { fmtMoney, fmtNum } from '@logic/money.js';
import { store } from '@logic/store.js';

/** Hiển thị tiền; khi bật "ẩn số dư" trong Cài đặt thì che bằng dấu chấm. */
export function money(n, cur = 'VND', opts = {}) {
  if (store.settings().hideAmounts) return '•••••';
  return fmtMoney(n, cur, opts);
}

export const hidden = () => !!store.settings().hideAmounts;
export const fmtPct = (p) => `${fmtNum(p * 100, 0)}%`;
export const errMsg = (e) => (e && (e.message || e.error_description || e.msg)) || String(e);
export { fmtMoney, fmtNum };

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.style.display = 'none';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      resolve(f ? { name: f.name, text: await f.text() } : null);
    });
    document.body.append(inp);
    inp.click();
  });
}
