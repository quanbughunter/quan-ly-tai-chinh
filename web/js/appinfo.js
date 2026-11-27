// Thông tin phiên bản để hiện trong app (Cài đặt, màn Đăng nhập) — giúp biết web / APK đang chạy bản nào.
//
// Nguồn số liệu:
//   - Lúc dựng (vite.config.js → __APP_INFO__): số phiên bản = 1.0.<số lần chạy workflow>, mã commit, giờ dựng.
//     Chạy trên máy (npm run dev / dựng thử) thì không có số thật: version = 'dev', commit = 'local'.
//   - Trong APK: đọc thêm versionName thật của gói cài (plugin @capacitor/app), đó chính là số in trên Release.
// Lưu ý: web (Pages) và APK mỗi bên có bộ đếm lần chạy riêng nên số phiên bản có thể khác nhau;
// "mã commit" mới là thứ so sánh được — cùng mã = cùng mã nguồn.

export const DEV_BUILD = { version: 'dev', commit: 'local', builtAt: '' };

export function isNative(cap = globalThis.Capacitor) {
  try { return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()); } catch { return false; }
}

export function platformLabel(platform) {
  return platform === 'android' ? 'Android' : 'Web';
}

/** '1.0.14' → 'v1.0.14'; rỗng hoặc 'dev' → 'bản thử'. */
export function versionText(version) {
  const v = String(version ?? '').trim();
  if (!v || v === 'dev') return 'bản thử';
  return /^v/i.test(v) ? v : `v${v}`;
}

/** ISO → 'dd/MM/yyyy HH:mm' theo giờ máy người xem (timeZone chỉ để kiểm thử). Sai định dạng → ''. */
export function builtAtText(iso, timeZone) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Gom thông tin thành các mảnh để hiển thị + một dòng đầy đủ để sao chép / dán gửi người khác. */
export function describeBuild(info = {}) {
  const platform = platformLabel(info.platform);
  const version = versionText(info.version);
  const commit = info.commit && info.commit !== 'local' ? String(info.commit) : '';
  const when = builtAtText(info.builtAt);
  const line = [`${platform} ${version}`, commit && `mã ${commit}`, when && `dựng ${when}`].filter(Boolean).join(' · ');
  return { platform, version, commit, when, line };
}

/** Trong APK: đọc versionName / versionCode thật của gói cài. Ngoài APK hoặc lỗi → null. */
export async function readNativeVersion(cap = globalThis.Capacitor) {
  try {
    if (!isNative(cap)) return null;
    if (typeof cap.isPluginAvailable === 'function' && !cap.isPluginAvailable('App')) return null;
    const n = await cap.registerPlugin('App').getInfo();
    return n && n.version ? { version: String(n.version), build: n.build ? String(n.build) : '' } : null;
  } catch {
    return null;
  }
}
