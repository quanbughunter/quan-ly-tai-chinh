// Phần thuần (không giao diện) của Nhập nhanh: dựng danh sách khoản từ văn bản, ghi nhớ lựa chọn cũ.
import { store } from '@logic/store.js';
import { parseQuick } from '@logic/quickadd.js';
import { newDebt, newHome, isMismatch } from '@logic/quicksave.js';
import { debtBalances } from '@logic/calc.js';
import { lsGet } from '@/lib/storage.js';
import { partyById } from '@/lib/options.js';

export const SHARE_PEOPLE_KEY = 'qltc:sharePeople';
export const SHARE_ME_KEY = 'qltc:shareIncludeMe';
export const homeKey = (categoryId) => `qltc:homeSend:${categoryId || ''}`;

export const catByName = (name, type) => store.all('categories').find((c) => c.type === type && c.name === name);

/** Những người có thể chọn: đúng như màn hình Vay nợ (người quen / người nhà, hoặc đang có nợ). */
export function sharePartyList() {
  const debts = debtBalances(store.all('txs'));
  return store.all('parties')
    .filter((p) => (p.role || 'person') === 'person' || p.role === 'family' || debts.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function lastSharePeople() {
  try {
    const v = JSON.parse(lsGet(SHARE_PEOPLE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((id) => partyById(id)) : [];
  } catch { return []; }
}

let seq = 0;

/**
 * Đọc văn bản thành các khoản. Gõ thêm chữ thì khoản cũ (cùng dòng gốc) giữ nguyên lựa chọn:
 * danh mục, ghi chú, người chia nợ, gửi bố, và việc đã bỏ khoản đó.
 * account: tài khoản đang chọn, hoặc null = không gắn tài khoản (tiền tệ mặc định VND, không bao giờ lệch).
 */
export function buildItems(text, { account = null, income = false, prev = [] } = {}) {
  const parsed = parseQuick(text, { defaultCurrency: account ? account.currency : 'VND', defaultKind: income ? 'income' : 'expense' });
  const pool = new Map();
  for (const it of prev) if (!it.error) pool.set(it.raw, [...(pool.get(it.raw) || []), it]);
  return parsed.map((p, i) => {
    if (p.error) return { ...p, uid: `err${i}:${p.raw}` };
    const old = (pool.get(p.raw) || []).shift();
    // Khoản thu không đoán ra nguồn → "Thu khác" (đổi lại được ở ô danh mục) để mục Thu nhập không bị "chưa phân loại".
    const cat = p.categoryName ? catByName(p.categoryName, p.kind) : (p.kind === 'income' ? catByName('Thu khác', 'income') : null);
    const sameCur = !old || old.currency === p.currency;
    const debt = old && sameCur ? old.debt : { ...newDebt({ includeMe: lsGet(SHARE_ME_KEY) !== '0' }), text: {}, ...(old ? { partyIds: old.debt.partyIds, includeMe: old.debt.includeMe, mode: old.debt.mode } : {}) };
    const home = old && sameCur ? old.home : { ...newHome(p.kind === 'income' && lsGet(homeKey(cat ? cat.id : '')) === '1'), text: '', ...(old ? { on: old.home.on } : {}) };
    return {
      ...p,
      uid: old ? old.uid : `q${(seq += 1)}`,
      note: old ? old.note : p.note,
      categoryId: old ? old.categoryId : (cat ? cat.id : ''),
      dropped: old ? !!old.dropped : false,
      debt: { text: {}, ...debt },
      home: { text: '', ...home },
      mismatch: isMismatch(p, account),
    };
  });
}
