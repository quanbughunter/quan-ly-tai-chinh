import { cn } from '@/lib/cn.js';

export function Card({ className, ...props }) {
  return <section data-slot="card" className={cn('rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgb(20_10_60/0.04),0_6px_20px_-10px_rgb(40_30_120/0.14)] dark:shadow-none', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-[15px] font-bold tracking-tight', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-4 pb-4 pt-3 sm:px-5 sm:pb-5', className)} {...props} />;
}

/** Thẻ có tiêu đề + nút bên phải + nội dung — dạng hay dùng nhất. */
export function Section({ title, right, children, className, contentClassName, flush = false }) {
  return (
    <Card className={className}>
      {title || right ? <CardHeader>{title ? <CardTitle>{title}</CardTitle> : <span />}{right || null}</CardHeader> : null}
      <CardContent className={cn(!title && !right && 'pt-4 sm:pt-5', flush && 'px-0 pb-1 sm:px-0 sm:pb-2', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
