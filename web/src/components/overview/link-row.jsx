import { cn } from '@/lib/cn.js';
import { IconBubble } from '@/components/row.jsx';

/** Giống Row nhưng là liên kết <a href> (mở được bằng chuột giữa, đúng ngữ nghĩa điều hướng). */
export function LinkRow({ href, icon, tone, title, sub, right, className }) {
  return (
    <a href={href} className={cn('flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent active:bg-accent sm:px-5', className)}>
      {icon != null ? <IconBubble tone={tone}>{icon}</IconBubble> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold leading-snug">{title}</span>
        {sub ? <span className="truncate text-[13px] text-muted-foreground">{sub}</span> : null}
      </span>
      {right ? <span className="flex shrink-0 flex-wrap justify-end gap-1 text-right">{right}</span> : null}
    </a>
  );
}
