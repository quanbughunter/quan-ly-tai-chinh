import { h, field, errMsg } from '../ui.js';
import { store } from '../store.js';

export function renderLogin(root, onSignedIn) {
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, placeholder: 'ban@example.com', inputmode: 'email' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Đăng nhập');
  const form = h('form', { class: 'login-card', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Đang đăng nhập…';
    try {
      await store.signIn(email.value.trim(), pass.value);
      onSignedIn();
    } catch (ex) {
      const m = errMsg(ex);
      err.textContent = /invalid login/i.test(m) ? 'Sai email hoặc mật khẩu.' : m;
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  } },
  h('img', { class: 'login-logo', src: 'icons/icon.svg', alt: 'Logo Quản lý tài chính', width: 72, height: 72 }),
  h('h1', {}, 'Quản lý tài chính'),
  h('p', { class: 'sub center' }, 'Đăng nhập để xem sổ của bạn. Dữ liệu được mã hóa khi truyền và chỉ tài khoản của bạn đọc được.'),
  field('Email', email),
  field('Mật khẩu', pass),
  err,
  btn);
  root.append(h('div', { class: 'login-wrap' }, form));
  email.focus();
}
