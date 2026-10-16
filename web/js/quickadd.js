// Nhập nhanh: "cafe 25k, ăn trưa 45k; +lương 10,9tr; grab 38k usd" → nhiều giao dịch riêng.
// Giữ ý tưởng của tab `vnd` (nhập nhiều khoản một lần) nhưng mỗi khoản có ghi chú và phân loại.

import { parseAmount, SUFFIX_WORDS } from './money.js';
import { fold } from './calc.js';

const SUFFIX_RE = [...SUFFIX_WORDS].sort((a, b) => b.length - a.length).join('|');
const AMOUNT_RE = new RegExp(`(?<![\\p{L}\\d])([+-]?\\d[\\d.,]*)\\s*(${SUFFIX_RE})?(?![\\p{L}\\d])`, 'iu');
const CUR_RE = /(?:^|\s)(rub|rúp|rup|usdt|usd|vnd)(?=\s|$)|([₽$₫])/giu;

const CUR_WORD = { rub: 'RUB', 'rúp': 'RUB', rup: 'RUB', usdt: 'USDT', usd: 'USD', vnd: 'VND', '₽': 'RUB', $: 'USD', '₫': 'VND' };

// từ khóa → tên danh mục mặc định
const KEYWORDS = [
  ['Ăn uống', ['cafe', 'ca phe', 'cà phê', 'an ', 'ăn', 'com', 'cơm', 'pho', 'phở', 'bun', 'bún', 'tra sua', 'trà sữa', 'nuoc', 'nước', 'sieu thi', 'siêu thị', 'perekrestok', 'magnit', 'thuc pham', 'thực phẩm', 'banh', 'bánh', 'bia', 'nhau', 'nhậu', 'lau', 'lẩu', 'tiec', 'tiệc']],
  ['Đi lại', ['grab', 'taxi', 'xe', 'bus', 'buýt', 'xăng', 'xang', 'metro', 'tau', 'tàu', 've may bay', 'vé máy bay', 'gui xe', 'gửi xe', 'troika']],
  ['Nhà ở / KTX', ['ktx', 'tro', 'trọ', 'nha', 'nhà', 'dien', 'điện', 'internet', 'wifi']],
  ['Học tập', ['hoc', 'học', 'sach', 'sách', 'but', 'bút', 'khoa hoc', 'khóa học', 'hoc phi', 'học phí']],
  ['Biếu gia đình', ['bieu', 'biếu', 'me ', 'mẹ', 'bo ', 'bố', 'tang', 'tặng', 'qua ', 'quà', 'dam cuoi', 'đám cưới']],
  ['Sức khỏe', ['thuoc', 'thuốc', 'kham', 'khám', 'benh vien', 'bệnh viện', 'rang', 'răng']],
  ['Mua sắm', ['mua', 'ao ', 'áo', 'quan ', 'quần', 'giay', 'giày', 'dong ho', 'đồng hồ', 'wildberries', 'ozon']],
  ['Du lịch / giải trí', ['du lich', 'du lịch', 'phim', 'game', 'karaoke', 'choi', 'chơi', 've ', 'vé']],
  ['Phí & dịch vụ', ['phi ', 'phí', 'sim', 'dien thoai', 'điện thoại', 'ship', 'chuyen khoan', 'chuyển khoản', 'commission']],
  ['Lương', ['luong', 'lương']],
  ['Học bổng', ['hoc bong', 'học bổng', 'stipendiya', 'стипендия']],
  ['Sinh hoạt phí', ['sinh hoat phi', 'sinh hoạt phí']],
];

// Từ ngắn (≤3 ký tự) phải đứng riêng một từ để tránh khớp nhầm ("xe" trong "xem").
function hasWord(haystack, w) {
  const needle = fold(w).trim();
  return needle.length <= 3 ? haystack.includes(` ${needle} `) : haystack.includes(needle);
}

export function guessCategoryName(note, kind = 'expense') {
  const n = ` ${fold(note).replace(/[^\p{L}\d]+/gu, ' ')} `;
  for (const [name, words] of KEYWORDS) {
    const isIncome = ['Lương', 'Học bổng', 'Sinh hoạt phí'].includes(name);
    if (kind === 'income' ? !isIncome : isIncome) continue;
    if (words.some((w) => hasWord(n, w))) return name;
  }
  return null;
}

/**
 * @returns {Array<{raw, kind, amount, currency, note, categoryName, error}>}
 */
export function parseQuick(text, { defaultCurrency = 'VND', defaultKind = 'expense' } = {}) {
  const parts = String(text || '')
    .split(/\n|;|,\s+(?=\D)/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((raw) => {
    let s = raw;
    let kind = defaultKind;
    let currency = null;
    s = s.replace(CUR_RE, (m, w, sym) => {
      currency = CUR_WORD[String(w || sym).toLowerCase()] || currency;
      return ' ';
    });
    if (s.trim().startsWith('+')) { kind = 'income'; s = s.trim().slice(1); }
    const m = AMOUNT_RE.exec(s);
    if (!m) return { raw, error: 'Không thấy số tiền' };
    let numStr = m[1];
    if (numStr.startsWith('+')) { kind = 'income'; numStr = numStr.slice(1); }
    else if (numStr.startsWith('-')) { numStr = numStr.slice(1); if (defaultKind === 'income') kind = 'expense'; }
    const amount = parseAmount(numStr + (m[2] || ''));
    if (!(amount > 0)) return { raw, error: 'Số tiền không hợp lệ' };
    const note = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim();
    return {
      raw,
      kind,
      amount,
      currency: currency || defaultCurrency,
      note,
      categoryName: guessCategoryName(note, kind),
    };
  });
}
