// Nút Back của Android (kể cả cử chỉ vuốt từ cạnh màn hình) trong bản APK.
//
// Vì sao cần: Capacitor 6 không tự xử lý nút Back. Nếu không có plugin @capacitor/app thì Android
// đóng luôn cả app, bất kể đang mở form hay đang ở màn con. Với plugin nhưng không có trình nghe,
// Capacitor chỉ lùi lịch sử WebView và không đóng hộp thoại. Vì vậy app tự nghe sự kiện `backButton`:
//   1. đang có hộp thoại (form, menu, xác nhận) → đóng hộp thoại trên cùng;
//   2. không có hộp thoại nhưng còn lịch sử màn hình → lùi về màn trước (router theo #hash);
//   3. đang ở màn đầu → thu app xuống nền (giống hành vi Android mới), không tắt hẳn.
// Trên trình duyệt thường không làm gì: nút Back của trình duyệt giữ nguyên.

/** Quyết định phải làm gì khi nhận một lần Back. closedModal: vừa đóng được một hộp thoại. */
export function decideBack({ closedModal = false, canGoBack = false } = {}) {
  if (closedModal) return 'none';
  return canGoBack ? 'history' : 'minimize';
}

/** Gắn trình nghe Back. Trả true nếu đã gắn (đang chạy trong APK có plugin App), false nếu bỏ qua. */
export function installBackButton({ cap = globalThis.Capacitor, closeTopModal, back = () => history.back() } = {}) {
  try {
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return false;
    if (typeof cap.isPluginAvailable === 'function' && !cap.isPluginAvailable('App')) return false;
    const App = cap.registerPlugin('App');
    const res = App.addListener('backButton', (ev) => {
      const closedModal = typeof closeTopModal === 'function' ? !!closeTopModal() : false;
      const act = decideBack({ closedModal, canGoBack: !!(ev && ev.canGoBack) });
      if (act === 'history') back();
      else if (act === 'minimize') (App.minimizeApp || App.exitApp).call(App);
    });
    if (res && typeof res.catch === 'function') res.catch(() => {});
    return true;
  } catch (e) {
    console.warn('Back:', e);
    return false;
  }
}
