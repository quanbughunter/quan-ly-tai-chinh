import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        neutral: 'bg-secondary text-secondary-foreground',
        muted: 'bg-muted text-muted-foreground',
        success: 'bg-income/12 text-income',
        danger: 'bg-destructive/12 text-destructive',
        warning: 'bg-warning/20 text-warning-foreground',
        outline: 'border text-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({ className, variant, ...props }) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
