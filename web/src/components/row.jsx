import { cn } from '@/lib/cn.js';

export const TONES = {
  primary: 'bg-primary/10 text-primary',
  income: 'bg-income/12 text-income',
  expense: 'bg-expense/12 text-expense',
  warning: 'bg-warning/20 text-warning-foreground',
  muted: 'bg-muted text-muted-foreground',
  neutral: 'bg-secondary text-secondary-foreground',
};

/** Ô tròn bo góc chứa biểu tượng (hoặc emoji của danh mục). */
export function IconBubble({ children, tone = 'primary', className }) {
  return <span className={cn('grid size-10 shrink-0 place-content-center rounded-2xl text-lg [&_svg]:size-5', TONES[tone] || TONES.primary, className)}>{children}</span>;
}

/** Một dòng danh sách: biểu tượng | tiêu đề + phụ đề | bên phải. Có onClick thì là nút bấm được. */
export function Row({ icon, tone, title, sub, right, onClick, className, children }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-slot="row"
      className={cn('flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left sm:px-5', onClick && 'transition-colors hover:bg-accent/60 active:bg-accent focus-visible:bg-accent focus-visible:outline-none', className)}
    >
      {icon != null ? <IconBubble tone={tone}>{icon}</IconBubble> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold leading-snug">{title}</span>
        {sub ? <span className="truncate text-[13px] text-muted-foreground">{sub}</span> : null}
        {children}
      </span>
      {right ? <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">{right}</span> : null}
    </Comp>
  );
}

/** Khung chứa nhiều Row, có vạch ngăn mảnh. */
export function RowList({ children, className }) {
  return <div className={cn('divide-y divide-border/70', className)}>{children}</div>;
}
