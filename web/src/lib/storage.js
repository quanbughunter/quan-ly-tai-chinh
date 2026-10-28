// localStorage an toàn (có thể không dùng được trong chế độ riêng tư).
export const lsGet = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v == null ? fallback : v; } catch { return fallback; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
export const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } };
export const lsGetJSON = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
export const lsSetJSON = (k, v) => lsSet(k, JSON.stringify(v));
