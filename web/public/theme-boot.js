// Chạy trước khi vẽ trang để không bị chớp nền sáng khi dùng giao diện tối.
try {
  var m = localStorage.getItem('qltc:theme');
  var dark = m === 'dark' || ((m !== 'light') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
} catch (e) { /* bỏ qua */ }
