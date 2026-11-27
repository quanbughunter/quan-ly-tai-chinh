import { Plus, Info } from 'lucide-react';
import { Select } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';

/** Ô chọn + nút "＋" nhỏ bên phải để tạo mới ngay tại chỗ (không phải thoát form). */
export function SelectWithAdd({ options, value, onChange, addLabel, onAdd, placeholder, ...rest }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <Select options={options} value={value} onChange={onChange} placeholder={placeholder} {...rest} />
      </div>
      <Button variant="outline" size="icon" aria-label={addLabel} title={addLabel} onClick={onAdd}>
        <Plus className="size-5" />
      </Button>
    </div>
  );
}

/** Dòng chú thích nhỏ có biểu tượng thông tin. */
export function InfoNote({ children, tone = 'muted' }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs leading-relaxed ${tone === 'primary' ? 'text-primary' : 'text-muted-foreground'}`}>
      <Info className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
