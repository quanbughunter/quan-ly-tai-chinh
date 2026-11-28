// Bàn phím máy tính trong ô nhập tiền: mỗi phím sửa chuỗi biểu thức người dùng đang gõ.
// Hàm thuần để kiểm thử; phần vẽ nút nằm ở web/src/components/ui/calc-pad.jsx.
// Chuỗi tạo ra luôn đọc được bằng parseExpr (money.js): số, k/tr/tỷ (kể cả kiểu 5tr2 = 5,2 triệu), + - × ÷, ngoặc.

const OPS = '+-×÷*/';
const isOp = (c) => !!c && OPS.includes(c);
const isDigit = (c) => !!c && c >= '0' && c <= '9';
/** Chuỗi đang kết thúc bằng một số (kể cả số đã có k/tr/tỷ) → có thể gõ phép tính hoặc ngoặc đóng. */
const endsValue = (t) => isDigit(t.slice(-1)) || /(k|tr|tỷ)$/.test(t) || t.endsWith(')');

const ZEROS = { k: 3, tr: 6, 'tỷ': 9 };
/** Số cuối chuỗi đã có đơn vị: "5tr2" → { head: '5', unit: 'tr', tail: '2' }; chưa có đơn vị → null. */
const unitPart = (t) => {
  const m = /(\d[\d.,]*)(k|tr|tỷ)(\d*)$/.exec(t);
  return m ? { head: m[1], unit: m[2], tail: m[3] } : null;
};
/** Gõ thêm được n chữ số sau đơn vị không: "5tr" + 2 → "5tr2" (= 5,2 triệu). Không được nếu đã có dấu phẩy ("1,5tr") hoặc hết chỗ (k: 3 số, tr: 6, tỷ: 9). */
const tailRoom = (u, n) => /^\d+$/.test(u.head) && u.tail.length + n <= ZEROS[u.unit];

/** Phím hợp lệ: 0-9, 000, ',', '+', '-', '×', '÷', '(', ')', 'k', 'tr', 'tỷ', 'back', 'clear'. */
export function pressKey(text, key) {
  const t = String(text ?? '');
  const c = t.slice(-1);
  const u = unitPart(t);

  if (key === 'clear') return '';
  if (key === 'back') return /(tr|tỷ)$/.test(t) ? t.slice(0, -2) : t.slice(0, -1);

  if (/^\d$/.test(key)) {
    if (t.endsWith(')')) return `${t}×${key}`;
    if (u) return tailRoom(u, 1) ? t + key : t;
    return t + key;
  }
  if (key === '000') return isDigit(c) && (!u || tailRoom(u, 3)) ? t + key : t;

  if (key === ',') {
    if (u) return t;                                              // "5tr2" không thêm dấu phẩy được

    const num = /[\d.,]*$/.exec(t)[0];
    if (num.includes(',') || num.includes('.')) return t;       // một số chỉ có một dấu thập phân
    if (isDigit(c)) return `${t},`;
    return /(k|tr|tỷ|\))$/.test(t) ? t : `${t}0,`;
  }

  if (key === 'k' || key === 'tr' || key === 'tỷ') return isDigit(c) && !u ? t + key : t;

  if (key === '(') return endsValue(t) ? `${t}×(` : `${t}(`;
  if (key === ')') {
    const open = (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length;
    return open > 0 && endsValue(t) ? `${t})` : t;
  }

  if (key === '+' || key === '-' || key === '×' || key === '÷') {
    if (!t || c === '(') return key === '-' ? t + key : t;     // đầu biểu thức / sau "(" chỉ cho dấu trừ
    if (isOp(c)) return t.slice(0, -1) + key;                    // đổi phép tính thay vì gõ đôi
    if (c === ',') return t;
    return t + key;
  }
  return t;
}
