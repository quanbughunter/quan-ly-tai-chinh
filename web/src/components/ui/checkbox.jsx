import { Checkbox as C, Switch as SW } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn.js';

export function Checkbox({ className, ...props }) {
  return (
    <C.Root data-slot="checkbox" className={cn('peer grid size-5 shrink-0 place-content-center rounded-md border border-input bg-card shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground', className)} {...props}>
      <C.Indicator><Check className="size-3.5" strokeWidth={3} /></C.Indicator>
    </C.Root>
  );
}

export function Switch({ className, ...props }) {
  return (
    <SW.Root data-slot="switch" className={cn('peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent bg-input outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:bg-primary', className)} {...props}>
      <SW.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SW.Root>
  );
}

/** Hàng "ô tick + chữ" bấm được cả dòng. */
export function CheckRow({ checked, onChange, children, className, disabled }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-[15px]', disabled && 'cursor-not-allowed opacity-60', className)}>
      <Checkbox checked={!!checked} disabled={disabled} onCheckedChange={(v) => onChange && onChange(v === true)} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}
