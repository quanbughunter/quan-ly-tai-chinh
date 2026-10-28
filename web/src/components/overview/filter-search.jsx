import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input.jsx';

/** Ô tìm kiếm: gõ xong ~200ms mới áp dụng (đỡ giật). */
export function FilterSearch({ value, onChange, placeholder = 'Tìm ghi chú…', 'aria-label': ariaLabel = 'Tìm ghi chú' }) {
  const [text, setText] = useState(value || '');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9"
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(v), 200);
        }}
      />
    </div>
  );
}
