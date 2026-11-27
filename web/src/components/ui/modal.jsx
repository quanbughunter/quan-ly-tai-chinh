import { useRef } from 'react';
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { useDialog } from '@/lib/dialogs.jsx';

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * Hộp thoại: trên điện thoại là tấm trượt từ dưới lên, trên máy tính là hộp giữa màn hình.
 * Phải nằm trong openDialog(...) — trạng thái mở/đóng lấy từ useDialog().
 * footer: nút ở chân hộp (luôn dính đáy). onSubmit: bọc nội dung trong <form> để bấm Enter là lưu.
 */
export function Modal({ title, description, children, footer, size = 'md', wide = false, onSubmit, className }) {
  const { open, close } = useDialog();
  const ref = useRef(null);
  const Body = onSubmit ? 'form' : 'div';
  const bodyProps = onSubmit ? { onSubmit: (e) => { e.preventDefault(); onSubmit(e); }, noValidate: true } : {};
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          ref={ref}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Điện thoại: không tự bật bàn phím. Máy tính: nhảy vào ô nhập đầu tiên.
            e.preventDefault();
            if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
              const el = ref.current && ref.current.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea');
              if (el) el.focus();
            }
          }}
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden border bg-background shadow-2xl outline-none',
            'inset-x-0 bottom-0 rounded-t-3xl',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl',
            wide ? SIZES.lg : SIZES[size] || SIZES.md,
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-16 data-[state=open]:duration-300 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-16 data-[state=closed]:duration-200 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95',
            className,
          )}
        >
          <Body className="flex min-h-0 flex-1 flex-col" {...bodyProps}>
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
              <div className="min-w-0">
                <Dialog.Title className="truncate text-lg font-bold tracking-tight">{title}</Dialog.Title>
                {description ? <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Dialog.Description> : null}
              </div>
              <Dialog.Close className="grid size-9 shrink-0 place-content-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30" aria-label="Đóng">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">{children}</div>
            {footer ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">{footer}</div>
            ) : null}
          </Body>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
