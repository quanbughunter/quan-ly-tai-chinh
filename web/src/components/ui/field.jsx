import { createContext, useContext, useId } from 'react';
import { cn } from '@/lib/cn.js';

const FieldCtx = createContext(undefined);
/** id của ô nhập nằm trong <Field> gần nhất (để nhãn bấm vào là trúng ô). */
export const useFieldId = () => useContext(FieldCtx);

export function Label({ className, ...props }) {
  return <label data-slot="label" className={cn('text-[13px] font-semibold leading-none text-muted-foreground select-none', className)} {...props} />;
}

/** Nhãn + ô nhập + gợi ý. Dùng <div>, không dùng <label> bọc ngoài để các nút bên trong không bị chuyển cú bấm. */
export function Field({ label, hint, error, children, className, row = false }) {
  const id = useId();
  return (
    <FieldCtx.Provider value={id}>
      <div data-slot="field" className={cn('grid min-w-0 gap-1.5', className)}>
        {label ? <Label htmlFor={id}>{label}</Label> : null}
        {row ? <div className="flex items-center gap-2">{children}</div> : children}
        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </FieldCtx.Provider>
  );
}

export function FieldRow({ className, ...props }) {
  return <div className={cn('grid gap-3 sm:grid-cols-2', className)} {...props} />;
}
