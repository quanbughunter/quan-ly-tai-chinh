import { useEffect, useRef, useState } from 'react';
import { parseExpr, fmtMoney, fmtNum, roundCur } from '@logic/money.js';
import { cn } from '@/lib/cn.js';
import { Input } from './input.jsx';
import { CalcPad, CalcToggle } from './calc-pad.jsx';

/**
 * Đọc số từ chuỗi người dùng gõ ("25k", "1,5tr", "3tr+500k-120000", "45k*3", "(2tr+500k)/4"); NaN nếu không hiểu.
 * Truyền currency để làm tròn đúng số lẻ của tiền tệ (VND: đồng; còn lại 2 số lẻ), ví dụ "2tr/3" → 666.667 ₫.
 */
export function readAmount(text, currency = '') {
  const r = parseExpr(String(text ?? ''));
  return r ? roundCur(r.total, currency) : NaN;
}

/**
 * Ô nhập số tiền, kiểm soát bằng chuỗi: value (string) + onChange(string).
 * Gõ được k / tr và + − × ÷ ( ); bên dưới hiện số đã hiểu, ví dụ "= 25.000 ₫".
 * Nút máy tính bên phải ô mở bàn phím (k, tr, 000...). calc={false} để ẩn nút.
 * onCommit: gọi khi đóng bàn phím (cho ô tự lưu khi rời ô). currency rỗng thì hiện số thường.
 */
export function MoneyInput({ value, onChange, currency = 'VND', placeholder = '0', className, id, hint = true, calc = true, onCommit, ...rest }) {
  const [open, setOpen] = useState(false);
  const padRef = useRef(null);
  const wasOpen = useRef(false);
  const t = String(value ?? '').trim();
  const r = t ? parseExpr(t) : null;

  useEffect(() => {
    if (open) padRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    else if (wasOpen.current && onCommit) onCommit();
    wasOpen.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-1">
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode={open ? 'none' : 'text'}
          autoComplete="off"
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          aria-invalid={t && !r ? true : undefined}
          className={cn('tnum', calc && 'pr-11', className)}
          {...rest}
        />
        {calc ? <CalcToggle open={open} onClick={() => setOpen((o) => !o)} className="absolute right-0.5 top-0.5" /> : null}
      </div>
      {hint && t ? (
        <span className={cn('tnum text-xs', r ? 'text-muted-foreground' : 'font-medium text-destructive')}>
          {r ? `= ${currency ? fmtMoney(roundCur(r.total, currency), currency) : fmtNum(r.total, 4)}` : 'Không đọc được số tiền'}
        </span>
      ) : null}
      {calc && open ? (
        <div ref={padRef}>
          <CalcPad value={value} onChange={onChange} currency={currency} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
