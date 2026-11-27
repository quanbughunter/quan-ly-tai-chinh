import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { money } from '@/lib/format.js';

/**
 * Số tiền "đếm" mượt tới giá trị mới khi giá trị đổi. Lần hiện đầu tiên và khi tắt hoạt ảnh
 * luôn hiện ngay chữ cuối cùng (thuộc tính data-final luôn chứa chữ cuối).
 */
export function AnimatedMoney({ value, cur = 'VND', opts, className }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduce || prev.current === value || !Number.isFinite(value) || !Number.isFinite(prev.current)) {
      prev.current = value;
      setShown(value);
      return undefined;
    }
    const controls = animate(prev.current, value, { duration: 0.45, ease: 'easeOut', onUpdate: (v) => setShown(v), onComplete: () => setShown(value) });
    prev.current = value;
    return () => { controls.stop(); setShown(value); };
  }, [value, reduce]);
  return <span className={className} data-final={money(value, cur, opts)}>{money(shown, cur, opts)}</span>;
}
