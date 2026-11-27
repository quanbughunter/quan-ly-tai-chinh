import { Toaster as Sonner } from 'sonner';
import { useResolvedTheme } from '@/lib/use-theme.js';

export function Toaster() {
  const theme = useResolvedTheme();
  return (
    <Sonner
      theme={theme}
      position="top-center"
      offset={{ top: 'max(12px, env(safe-area-inset-top))' }}
      mobileOffset={{ top: 'max(12px, env(safe-area-inset-top))' }}
      toastOptions={{
        classNames: {
          toast: '!rounded-2xl !border !border-border !bg-popover !text-popover-foreground !font-sans !shadow-xl',
          title: '!text-sm !font-semibold',
        },
      }}
    />
  );
}
