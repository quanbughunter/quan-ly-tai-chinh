import { cn } from '@/lib/cn.js';
import { useFieldId } from './field.jsx';

const base = 'w-full min-w-0 rounded-xl border border-input bg-card px-3.5 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-[15px]';

export function Input({ className, type = 'text', id, ...props }) {
  const fid = useFieldId();
  return <input data-slot="input" id={id ?? fid} type={type} className={cn(base, 'h-10', className)} {...props} />;
}

export function Textarea({ className, id, ...props }) {
  const fid = useFieldId();
  return <textarea data-slot="textarea" id={id ?? fid} className={cn(base, 'min-h-20 py-2.5', className)} {...props} />;
}
