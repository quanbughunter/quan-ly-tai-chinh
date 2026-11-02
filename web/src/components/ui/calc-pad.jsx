import { Calculator, Delete } from 'lucide-react';
import { pressKey } from '@logic/calcpad.js';
import { parseExpr, toEditable } from '@logic/money.js';
import { cn } from '@/lib/cn.js';

const DIGIT = 'border border-input bg-card text-foreground hover:bg-accent';
const FUNC = 'bg-secondary text-secondary-foreground hover:bg-secondary/70';
const OP = 'bg-primary/10 text-[21px] text-primary hover:bg-primary/15';

// 5 cột × 5 hàng; k / tr / tỷ ở hàng cuối để khỏi gõ nhiều số 0.
const KEYS = [
  { k: '7', t: '7', cls: DIGIT }, { k: '8', t: '8', cls: DIGIT }, { k: '9', t: '9', cls: DIGIT }, { k: '÷', t: '÷', label: 'Chia', cls: OP }, { k: 'back', t: <Delete className="size-5" />, label: 'Xóa lùi', cls: FUNC },
  { k: '4', t: '4', cls: DIGIT }, { k: '5', t: '5', cls: DIGIT }, { k: '6', t: '6', cls: DIGIT }, { k: '×', t: '×', label: 'Nhân', cls: OP }, { k: 'clear', t: 'C', label: 'Xóa hết', cls: FUNC },
  { k: '1', t: '1', cls: DIGIT }, { k: '2', t: '2', cls: DIGIT }, { k: '3', t: '3', cls: DIGIT }, { k: '-', t: '−', label: 'Trừ', cls: OP }, { k: '(', t: '(', label: 'Mở ngoặc', cls: FUNC },
  { k: '0', t: '0', cls: DIGIT }, { k: '000', t: '000', cls: DIGIT }, { k: ',', t: ',', label: 'Dấu phẩy thập phân', cls: DIGIT }, { k: '+', t: '+', label: 'Cộng', cls: OP }, { k: ')', t: ')', label: 'Đóng ngoặc', cls: FUNC },
  { k: 'k', t: 'k', label: 'nghìn', cls: FUNC }, { k: 'tr', t: 'tr', label: 'triệu', cls: FUNC }, { k: 'tỷ', t: 'tỷ', label: 'tỷ', cls: FUNC },
];

const keyCls = 'tnum h-11 select-none rounded-xl text-[17px] font-semibold outline-none transition-all duration-100 active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring/40';

/**
 * Bàn phím máy tính cho một ô nhập tiền kiểu chuỗi: value (string) + onChange(string).
 * "=" thay biểu thức bằng kết quả; nút cuối (mặc định "Xong") gọi onDone.
 * Không lấy mất con trỏ của ô nhập (onMouseDown chặn đổi tiêu điểm).
 */
export function CalcPad({ value, onChange, currency = '', onDone, doneLabel = 'Xong', className }) {
  const text = String(value ?? '');
  const press = (k) => onChange(pressKey(text, k));
  const equals = () => {
    const r = parseExpr(text);
    if (r) onChange(toEditable(r.total, currency));
  };
  return (
    <div
      role="group"
      aria-label="Máy tính"
      data-testid="calc-pad"
      onMouseDown={(e) => e.preventDefault()}
      className={cn('grid grid-cols-5 gap-1.5 rounded-2xl border bg-muted/50 p-2', className)}
    >
      {KEYS.map((x) => (
        <button key={x.k} type="button" aria-label={x.label} data-key={x.k} onClick={() => press(x.k)} className={cn(keyCls, x.cls)}>{x.t}</button>
      ))}
      <button type="button" aria-label="Ra kết quả" data-key="=" onClick={equals} className={cn(keyCls, 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90')}>=</button>
      <button type="button" data-key="done" onClick={onDone} className={cn(keyCls, 'border border-input bg-card px-0 text-[13px] hover:bg-accent')}>{doneLabel}</button>
    </div>
  );
}

/** Nút nhỏ hình máy tính để bật/tắt bàn phím. */
export function CalcToggle({ open, onClick, className }) {
  return (
    <button
      type="button"
      aria-label={open ? 'Đóng máy tính' : 'Mở máy tính'}
      aria-expanded={!!open}
      data-testid="calc-toggle"
      onClick={onClick}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40',
        open && 'bg-primary/10 text-primary',
        className,
      )}
    >
      <Calculator className="size-[18px]" />
    </button>
  );
}
