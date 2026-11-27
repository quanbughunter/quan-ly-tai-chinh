import { Select as S } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { useFieldId } from './field.jsx';

const NONE = '__none__'; // Radix không cho phép giá trị rỗng, nên '' được đổi qua lại với giá trị này

/**
 * options: [{ value, label, disabled? }]. value/onChange dùng chuỗi thường; value '' nghĩa là "không chọn".
 */
export function Select({ options = [], value, onChange, placeholder = 'Chọn…', disabled, className, id, size = 'default', ...rest }) {
  const fid = useFieldId();
  const hasEmpty = options.some((o) => o.value === '');
  const v = value == null || value === '' ? (hasEmpty ? NONE : '') : String(value);
  return (
    <S.Root value={v} onValueChange={(x) => onChange && onChange(x === NONE ? '' : x)} disabled={disabled}>
      <S.Trigger
        id={id ?? fid}
        data-slot="select-trigger"
        className={cn(
          'flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input bg-card px-3.5 text-left text-base text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground/80 md:text-[15px]',
          size === 'sm' ? 'h-8 rounded-lg px-3 text-[13px]' : 'h-10',
          className,
        )}
        {...rest}
      >
        <span className="min-w-0 flex-1 truncate"><S.Value placeholder={placeholder} /></span>
        <S.Icon asChild><ChevronDown className="size-4 shrink-0 text-muted-foreground" /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          data-slot="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="relative z-[80] max-h-[min(var(--radix-select-content-available-height),20rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl shadow-black/10 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <S.Viewport className="p-1.5">
            {options.map((o) => (
              <S.Item
                key={`${o.value}`}
                value={o.value === '' ? NONE : String(o.value)}
                disabled={o.disabled}
                className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg py-2 pr-8 pl-3 text-[15px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator className="absolute right-2.5"><Check className="size-4 text-primary" /></S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
