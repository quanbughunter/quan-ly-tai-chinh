import { parseExpr, fmtMoney, fmtNum } from '@logic/money.js';
import { cn } from '@/lib/cn.js';
import { Input } from './input.jsx';

/** Đọc số từ chuỗi người dùng gõ ("25k", "1,5tr", "3tr+500k-120000"); NaN nếu không hiểu. */
export function readAmount(text) {
  const r = parseExpr(String(text ?? ''));
  return r ? r.total : NaN;
}

/**
 * Ô nhập số tiền, kiểm soát bằng chuỗi: value (string) + onChange(string).
 * Bên dưới hiện số đã hiểu, ví dụ "= 25.000 ₫". currency rỗng thì hiện số thường.
 */
export function MoneyInput({ value, onChange, currency = 'VND', placeholder = '0', className, id, hint = true, ...rest }) {
  const t = String(value ?? '').trim();
  const r = t ? parseExpr(t) : null;
  return (
    <div className="grid gap-1">
      <Input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        aria-invalid={t && !r ? true : undefined}
        className={cn('tnum', className)}
        {...rest}
      />
      {hint && t ? (
        <span className={cn('tnum text-xs', r ? 'text-muted-foreground' : 'font-medium text-destructive')}>
          {r ? `= ${currency ? fmtMoney(r.total, currency) : fmtNum(r.total, 4)}` : 'Không đọc được số tiền'}
        </span>
      ) : null}
    </div>
  );
}
