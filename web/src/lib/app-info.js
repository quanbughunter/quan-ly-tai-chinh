import { useEffect, useState } from 'react';
import { DEV_BUILD, describeBuild, isNative, readNativeVersion } from '@logic/appinfo.js';

// __APP_INFO__ do vite.config.js điền lúc dựng (xem `define`); không có (chạy thử ngoài Vite) thì coi là bản thử.
const BUILD = typeof __APP_INFO__ !== 'undefined' ? __APP_INFO__ : DEV_BUILD;

/** Thông tin phiên bản đang chạy: { platform, version, commit, when, line }. Trong APK sẽ tự thay bằng số thật của gói cài. */
export function useAppInfo() {
  const [info, setInfo] = useState(() => ({ ...BUILD, platform: isNative() ? 'android' : 'web' }));
  useEffect(() => {
    let alive = true;
    readNativeVersion().then((n) => { if (alive && n) setInfo((p) => ({ ...p, version: n.version })); });
    return () => { alive = false; };
  }, []);
  return describeBuild(info);
}
