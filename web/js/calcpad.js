// Bàn phím máy tính trong ô nhập tiền: mỗi phím sửa chuỗi biểu thức người dùng đang gõ.
// Hàm thuần để kiểm thử; phần vẽ nút nằm ở web/src/components/ui/calc-pad.jsx.
// Chuỗi tạo ra luôn đọc được bằng parseExpr (money.js): số, k/tr/tỷ, + - × ÷, ngoặc.

const OPS = '+-×÷*/';
const isOp = (c) => !!c && OPS.includes(c);
const isDigit = (c) => !!c && c >= '0' && c <= '9';
/** Chuỗi đang kết thúc bằng một số (kể cả số đã có k/tr/tỷ) → có thể gõ phép tính hoặc ngoặc đóng. */
const endsValue = (t) => isDigit(t.slice(-1)) || /(k|tr|tỷ)$/.test(t) || t.endsWith(')');

/** Phím hợp lệ: 0-9, 000, ',', '+', '-', '×', '÷', '(', ')', 'k', 'tr', 'tỷ', 'back', 'clear'. */
export function pressKey(text, key) {
  const t = String(text ?? '');
  const c = t.slice(-1);

  if (key === 'clear') return '';
  if (key === 'back') return /(tr|tỷ)$/.test(t) ? t.slice(0, -2) : t.slice(0, -1);

  if (/^\d$/.test(key)) return t.endsWith(')') || /(k|tr|tỷ)$/.test(t) ? `${t}×${key}` : t + key;
  if (key === '000') return isDigit(c) ? t + key : t;

  if (key === ',') {
    const num = /[\d.,]*$/.exec(t)[0];
    if (num.includes(',') || num.includes('.')) return t;       // một số chỉ có một dấu thập phân
    if (isDigit(c)) return `${t},`;
    return /(k|tr|tỷ|\))$/.test(t) ? t : `${t}0,`;
  }

  if (key === 'k' || key === 'tr' || key === 'tỷ') return isDigit(c) ? t + key : t;

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
