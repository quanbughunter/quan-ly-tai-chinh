import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/cn.js';

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold outline-none transition-all duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border border-input bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-white shadow-sm hover:bg-destructive/90',
        soft: 'bg-primary/10 text-primary hover:bg-primary/15',
        link: 'h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant, size, asChild = false, type, ...props }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" type={asChild ? undefined : type || 'button'} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
