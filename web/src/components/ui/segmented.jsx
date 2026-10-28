import { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn.js';

/** Nhóm nút chọn một (có "viên thuốc" trượt giữa các lựa chọn). options: [{ value, label }]. */
export function Segmented({ options, value, onChange, className, size = 'default', 'aria-label': ariaLabel, fill = true }) {
  const gid = useId();
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('relative inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-muted p-1 no-scrollbar', fill && 'flex w-full', className)}>
      {options.map((o) => {
        const on = String(o.value) === String(value);
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(o.value)}
            className={cn(
              'relative isolate z-0 whitespace-nowrap rounded-lg px-3 font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30',
              fill && 'flex-1',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {on ? <motion.span layoutId={`seg-${gid}`} className="absolute inset-0 -z-10 rounded-lg bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10" transition={{ type: 'spring', stiffness: 520, damping: 38 }} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
