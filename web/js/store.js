// Lớp lưu trữ. Hai backend cùng giao diện:
//  - CloudBackend: Supabase (bảng `records`, chính sách RLS theo user_id) — dùng khi đã cấu hình config.js
//  - LocalBackend: IndexedDB trên máy — "chế độ thử" khi chưa cấu hình Supabase
// Toàn bộ dữ liệu được tải vào bộ nhớ (vài nghìn bản ghi), mọi phép tính làm ở máy khách.

import { COLLECTIONS, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, uid } from './model.js';

/* ───────── KV nhỏ trên IndexedDB (có dự phòng bộ nhớ khi không có IndexedDB) ───────── */
const memKV = new Map();
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('qltc', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const kv = {
  async get(k) {
    if (typeof indexedDB === 'undefined') return memKV.get(k);
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const r = db.transaction('kv').objectStore('kv').get(k);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch { return memKV.get(k); }
  },
  async set(k, v) {
    memKV.set(k, v);
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await openDB();
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } catch { /* bộ nhớ vẫn giữ bản sao */ }
  },
  async del(k) {
    memKV.delete(k);
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await openDB();
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(k);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } catch { /* bỏ qua */ }
  },
};

/* ───────── Backend trên máy ───────── */
class LocalBackend {
  constructor(key = 'qltc:local') { this.key = key; this.state = null; }
  async _ensure() {
    if (!this.state) this.state = (await kv.get(this.key)) || {};
    return this.state;
  }
  async _save() { await kv.set(this.key, this.state); }
  async load() { return JSON.parse(JSON.stringify(await this._ensure())); }
  async upsert(col, docs) {
    const s = await this._ensure();
    const list = s[col] || (s[col] = []);
    for (const d of docs) {
      const i = list.findIndex((x) => x.id === d.id);
      if (i >= 0) list[i] = d; else list.push(d);
    }
    await this._save();
  }
  async remove(col, ids) {
    const s = await this._ensure();
    const set = new Set(ids);
    s[col] = (s[col] || []).filter((d) => !set.has(d.id));
    await this._save();
  }
  async removeAll() { this.state = {}; await this._save(); }
}

/* ───────── Backend Supabase ───────── */
const PAGE = 1000;
class CloudBackend {
  constructor(client) { this.c = client; }
  async load() {
    const out = {};
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.c.from('records').select('id,collection,data').order('id').range(from, from + PAGE - 1);
      if (error) throw error;
      for (const r of data) (out[r.collection] || (out[r.collection] = [])).push({ id: r.id, ...r.data });
      if (data.length < PAGE) break;
    }
    return out;
  }
  async upsert(col, docs) {
    for (let i = 0; i < docs.length; i += 500) {
      const rows = docs.slice(i, i + 500).map(({ id, ...rest }) => ({ id, collection: col, data: rest }));
      const { error } = await this.c.from('records').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  }
  async remove(col, ids) {
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await this.c.from('records').delete().in('id', ids.slice(i, i + 100));
      if (error) throw error;
    }
  }
  async removeAll() {
    const { error } = await this.c.from('records').delete().neq('collection', '__none__');
    if (error) throw error;
  }
}

/* ───────── Store ───────── */
const listeners = new Set();
const S = {
  mode: 'local', // 'local' | 'cloud'
  client: null,
  backend: null,
  user: null,
  data: {},
  offline: false,
  ready: false,
  loadedAt: 0,
  _idx: {},
  _sig: '',
};
for (const c of COLLECTIONS) S.data[c] = [];

function emit(col) { S._idx = {}; for (const f of listeners) { try { f(col); } catch (e) { console.error(e); } } }

function assertWritable() {
  if (S.offline) throw new Error('Đang ngoại tuyến: chỉ xem được, chưa ghi được dữ liệu.');
  if (!S.backend) throw new Error('Chưa kết nối kho dữ liệu.');
}

function fillAll(raw) {
  for (const c of COLLECTIONS) S.data[c] = (raw && raw[c]) || [];
}

export const store = {
  get mode() { return S.mode; },
  get user() { return S.user; },
  get offline() { return S.offline; },
  get ready() { return S.ready; },
  get loadedAt() { return S.loadedAt; },

  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Khởi tạo. cfg = { supabaseUrl, supabaseAnonKey }. Trả { needsLogin }. */
  async init(cfg = {}) {
    const hasCloud = cfg.supabaseUrl && cfg.supabaseAnonKey && typeof window !== 'undefined' && window.supabase;
    if (hasCloud) {
      S.mode = 'cloud';
      S.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      const { data } = await S.client.auth.getSession();
      if (data && data.session) {
        S.user = data.session.user;
        S.backend = new CloudBackend(S.client);
        await this.loadAll();
        return { needsLogin: false };
      }
      return { needsLogin: true };
    }
    S.mode = 'local';
    S.backend = new LocalBackend();
    await this.loadAll();
    return { needsLogin: false };
  },

  async signIn(email, password) {
    const { data, error } = await S.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    S.user = data.user;
    S.backend = new CloudBackend(S.client);
    await this.loadAll();
  },

  async signOut() {
    if (S.client) await S.client.auth.signOut();
    S.user = null;
    S.backend = null;
    S.ready = false;
    fillAll({});
    emit('*');
  },

  async loadAll() {
    const cacheKey = `qltc:cache:${S.user ? S.user.id : 'local'}`;
    const wasOffline = S.offline;
    const wasReady = S.ready;
    let raw;
    try {
      raw = await S.backend.load();
      S.offline = false;
      if (S.mode === 'cloud') kv.set(cacheKey, raw);
    } catch (e) {
      const cached = S.mode === 'cloud' ? await kv.get(cacheKey) : null;
      if (!cached) throw e;
      raw = cached;
      S.offline = true;
    }
    // Không vẽ lại giao diện nếu dữ liệu không đổi (tránh mất chữ đang gõ khi tự làm mới).
    const sig = JSON.stringify(raw);
    const same = wasReady && sig === S._sig && wasOffline === S.offline;
    S._sig = sig;
    S.loadedAt = Date.now();
    if (same) return;
    fillAll(raw);
    S.ready = true;
    await this._seed();
    emit('*');
  },

  async refresh() { if (S.backend) await this.loadAll(); },

  async _seed() {
    if (S.offline) return;
    if (!S.data.categories.length) {
      const cats = DEFAULT_CATEGORIES.map((c) => ({ id: uid(), ts: Date.now(), ...c }));
      await S.backend.upsert('categories', cats);
      S.data.categories = cats;
    }
  },

  all(col) { return S.data[col] || []; },

  byId(col, id) {
    if (!S._idx[col]) S._idx[col] = new Map((S.data[col] || []).map((d) => [d.id, d]));
    return S._idx[col].get(id);
  },

  /** Thêm hoặc sửa một bản ghi. Cập nhật bộ nhớ ngay, hoàn tác nếu ghi lỗi. */
  async put(col, doc) {
    assertWritable();
    const d = { ...doc, id: doc.id || uid(), ts: doc.ts || Date.now() };
    const list = S.data[col];
    const i = list.findIndex((x) => x.id === d.id);
    const prev = i >= 0 ? list[i] : null;
    if (i >= 0) list[i] = d; else list.push(d);
    emit(col);
    try {
      await S.backend.upsert(col, [d]);
    } catch (e) {
      if (prev) list[i] = prev; else list.splice(list.indexOf(d), 1);
      emit(col);
      throw e;
    }
    return d;
  },

  async putMany(col, docs) {
    assertWritable();
    const list = S.data[col];
    const out = docs.map((doc) => ({ ...doc, id: doc.id || uid(), ts: doc.ts || Date.now() }));
    const snapshot = [...list];
    const map = new Map(list.map((x) => [x.id, x]));
    for (const d of out) map.set(d.id, d);
    S.data[col] = [...map.values()];
    emit(col);
    try {
      await S.backend.upsert(col, out);
    } catch (e) {
      S.data[col] = snapshot;
      emit(col);
      throw e;
    }
    return out;
  },

  async del(col, id) { return this.delMany(col, [id]); },

  async delMany(col, ids) {
    assertWritable();
    const snapshot = S.data[col];
    const set = new Set(ids);
    S.data[col] = snapshot.filter((d) => !set.has(d.id));
    emit(col);
    try {
      await S.backend.remove(col, ids);
    } catch (e) {
      S.data[col] = snapshot;
      emit(col);
      throw e;
    }
  },

  settings() {
    const s = S.data.settings[0];
    return {
      ...DEFAULT_SETTINGS,
      ...(s || {}),
      rates: { ...DEFAULT_SETTINGS.rates, ...((s && s.rates) || {}) },
      params: { ...DEFAULT_SETTINGS.params, ...((s && s.params) || {}) },
    };
  },

  async saveSettings(patch) {
    const cur = S.data.settings[0] || {};
    const merged = { ...cur, ...patch };
    if (patch.rates) merged.rates = { ...(cur.rates || {}), ...patch.rates };
    if (patch.params) merged.params = { ...(cur.params || {}), ...patch.params };
    return this.put('settings', merged);
  },

  /** Xuất toàn bộ dữ liệu (để sao lưu hoặc chuyển máy). */
  exportAll() {
    const out = { app: 'quan-ly-tai-chinh', version: 1, exportedAt: new Date().toISOString(), data: {} };
    for (const c of COLLECTIONS) out.data[c] = S.data[c];
    return out;
  },

  /** Nhập dữ liệu từ file JSON (của công cụ import hoặc bản sao lưu). replace=true: xóa dữ liệu hiện có trước. */
  async importAll(obj, { replace = false } = {}) {
    assertWritable();
    const src = obj && obj.data ? obj.data : obj;
    if (!src || typeof src !== 'object') throw new Error('File không đúng định dạng.');
    if (replace) {
      await S.backend.removeAll();
      fillAll({});
    }
    let n = 0;
    for (const c of COLLECTIONS) {
      const docs = Array.isArray(src[c]) ? src[c] : [];
      if (!docs.length) continue;
      const fixed = docs.map((d) => ({ ...d, id: d.id || uid() }));
      if (c === 'settings') {
        const cur = S.data.settings[0];
        await this.putMany(c, [{ ...fixed[0], id: cur ? cur.id : fixed[0].id }]);
        n += 1;
        continue;
      }
      await this.putMany(c, fixed);
      n += fixed.length;
    }
    await this._seed();
    emit('*');
    return n;
  },
};
