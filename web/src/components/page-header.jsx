import { cn } from '@/lib/cn.js';

export function PageHeader({ title, subtitle, actions, back, className }) {
  return (
    <header className={cn('mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3', className)}>
      <div className="min-w-0">
        {back || null}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
