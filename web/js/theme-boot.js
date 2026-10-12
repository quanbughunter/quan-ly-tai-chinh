// Chạy trước khi vẽ trang để không bị chớp nền sáng khi dùng giao diện tối.
try {
  var m = localStorage.getItem('qltc:theme');
  if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m);
} catch (e) { /* bỏ qua */ }
