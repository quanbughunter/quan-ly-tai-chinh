import test from 'node:test';
import assert from 'node:assert/strict';
import { decideBack, installBackButton } from '../web/js/backnav.js';

// Nút Back / cử chỉ vuốt cạnh trong APK: đóng hộp thoại → lùi màn → thu app xuống nền.

test('Back: có hộp thoại thì chỉ đóng hộp, không lùi màn, không thoát', () => {
  assert.equal(decideBack({ closedModal: true, canGoBack: true }), 'none');
  assert.equal(decideBack({ closedModal: true, canGoBack: false }), 'none');
});

test('Back: không có hộp thoại thì lùi màn nếu còn lịch sử, hết lịch sử thì thu app xuống nền', () => {
  assert.equal(decideBack({ closedModal: false, canGoBack: true }), 'history');
  assert.equal(decideBack({ closedModal: false, canGoBack: false }), 'minimize');
  assert.equal(decideBack(), 'minimize');
});

function fakeCapacitor({ native = true, available = true } = {}) {
  const calls = { listeners: [], minimize: 0, exit: 0 };
  const App = {
    addListener: (name, fn) => { calls.listeners.push({ name, fn }); return Promise.resolve({ remove() {} }); },
    minimizeApp: () => { calls.minimize += 1; },
    exitApp: () => { calls.exit += 1; },
  };
  const cap = { isNativePlatform: () => native, isPluginAvailable: () => available, registerPlugin: (n) => (n === 'App' ? App : null) };
  return { cap, calls };
}

test('trình duyệt thường hoặc APK thiếu plugin App: không gắn gì (giữ nút Back của trình duyệt)', () => {
  assert.equal(installBackButton({ cap: undefined }), false);
  assert.equal(installBackButton({ cap: fakeCapacitor({ native: false }).cap }), false);
  const noPlugin = fakeCapacitor({ available: false });
  assert.equal(installBackButton({ cap: noPlugin.cap }), false);
  assert.equal(noPlugin.calls.listeners.length, 0);
});

test('APK: sự kiện backButton đi đúng nhánh', () => {
  let modalOpen = 2;
  let backs = 0;
  const { cap, calls } = fakeCapacitor();
  const ok = installBackButton({ cap, closeTopModal: () => { if (modalOpen > 0) { modalOpen -= 1; return true; } return false; }, back: () => { backs += 1; } });
  assert.equal(ok, true);
  assert.equal(calls.listeners.length, 1);
  assert.equal(calls.listeners[0].name, 'backButton');
  const fire = (canGoBack) => calls.listeners[0].fn({ canGoBack });

  fire(true); fire(false); // hai hộp thoại lồng nhau: mỗi lần Back đóng một lớp
  assert.deepEqual([modalOpen, backs, calls.minimize], [0, 0, 0]);
  fire(true); // hết hộp thoại, còn lịch sử → lùi màn
  assert.deepEqual([backs, calls.minimize], [1, 0]);
  fire(false); // màn đầu → thu xuống nền
  assert.deepEqual([backs, calls.minimize, calls.exit], [1, 1, 0]);
});

test('APK: không có minimizeApp thì dùng exitApp', () => {
  const { cap, calls } = fakeCapacitor();
  const App = cap.registerPlugin('App');
  delete App.minimizeApp;
  installBackButton({ cap, closeTopModal: () => false });
  calls.listeners[0].fn({ canGoBack: false });
  assert.equal(calls.exit, 1);
});
