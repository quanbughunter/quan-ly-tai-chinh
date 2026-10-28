import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn.js';

export function EmptyState({ children, action, icon: Icon = Inbox, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center text-muted-foreground', className)}>
      <span className="grid size-14 place-content-center rounded-2xl bg-secondary text-primary"><Icon className="size-7" strokeWidth={1.6} /></span>
      <p className="max-w-xs text-sm leading-relaxed">{children}</p>
      {action || null}
    </div>
  );
}
