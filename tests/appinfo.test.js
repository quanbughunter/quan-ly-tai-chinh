import test from 'node:test';
import assert from 'node:assert/strict';
import { versionText, builtAtText, platformLabel, describeBuild, readNativeVersion, isNative, DEV_BUILD } from '../web/js/appinfo.js';

// Hiện số phiên bản trong app: web (Pages) và APK.

test('versionText: thêm "v", bản chạy trên máy gọi là "bản thử"', () => {
  assert.equal(versionText('1.0.14'), 'v1.0.14');
  assert.equal(versionText('v1.0.14'), 'v1.0.14');
  assert.equal(versionText('dev'), 'bản thử');
  assert.equal(versionText(''), 'bản thử');
  assert.equal(versionText(undefined), 'bản thử');
});

test('builtAtText: dd/MM/yyyy HH:mm, nửa đêm là 00 chứ không phải 24, sai định dạng thì rỗng', () => {
  assert.equal(builtAtText('2026-11-27T14:05:09Z', 'UTC'), '27/11/2026 14:05');
  assert.equal(builtAtText('2026-11-27T00:03:00Z', 'UTC'), '27/11/2026 00:03');
  assert.equal(builtAtText('2026-11-27T14:05:09Z', 'Europe/Moscow'), '27/11/2026 17:05');
  assert.equal(builtAtText(''), '');
  assert.equal(builtAtText('không phải ngày'), '');
});

test('describeBuild: một dòng đủ nền tảng + phiên bản + mã + giờ dựng', () => {
  const d = describeBuild({ platform: 'android', version: '1.0.14', commit: '6c0feee', builtAt: '2026-11-16T09:30:00Z' });
  assert.equal(d.platform, 'Android');
  assert.equal(d.version, 'v1.0.14');
  assert.equal(d.commit, '6c0feee');
  assert.match(d.line, /^Android v1\.0\.14 · mã 6c0feee · dựng \d\d\/11\/2026 \d\d:\d\d$/);
});

test('describeBuild: bản dựng trên máy (dev/local) không bịa mã và giờ', () => {
  const d = describeBuild({ ...DEV_BUILD, platform: 'web' });
  assert.equal(d.line, 'Web bản thử');
  assert.equal(d.commit, '');
  assert.equal(d.when, '');
  assert.equal(describeBuild().line, 'Web bản thử');
  assert.equal(platformLabel('web'), 'Web');
});

const fakeCap = ({ native = true, available = true, info = { version: '1.0.14', build: '14' }, fail = false } = {}) => ({
  isNativePlatform: () => native,
  isPluginAvailable: () => available,
  registerPlugin: () => ({ getInfo: () => (fail ? Promise.reject(new Error('x')) : Promise.resolve(info)) }),
});

test('readNativeVersion: trong APK đọc được versionName thật', async () => {
  assert.deepEqual(await readNativeVersion(fakeCap()), { version: '1.0.14', build: '14' });
  assert.equal(isNative(fakeCap()), true);
});

test('readNativeVersion: ngoài APK, thiếu plugin hoặc lỗi thì trả null (không làm hỏng màn hình)', async () => {
  assert.equal(await readNativeVersion(undefined), null);
  assert.equal(await readNativeVersion(fakeCap({ native: false })), null);
  assert.equal(await readNativeVersion(fakeCap({ available: false })), null);
  assert.equal(await readNativeVersion(fakeCap({ fail: true })), null);
  assert.equal(await readNativeVersion(fakeCap({ info: {} })), null);
  assert.equal(isNative(undefined), false);
});
