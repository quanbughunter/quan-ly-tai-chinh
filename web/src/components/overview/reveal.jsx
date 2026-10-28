import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

/** true ở lần vẽ đầu tiên của màn hình, false từ lần vẽ sau (để chỉ chạy hiệu ứng "xuất hiện" khi mới vào, không nhấp nháy khi dữ liệu đổi). */
export function useFirstRender() {
  const first = useRef(true);
  const value = first.current;
  useEffect(() => { first.current = false; }, []);
  return value;
}

/** Xuất hiện lần lượt: index càng lớn càng trễ (tối đa ~0,25 giây). enabled=false: vẽ thẳng, không hiệu ứng. */
export function Reveal({ index = 0, enabled = true, className, children, ...rest }) {
  const cls = ['min-w-0', className].filter(Boolean).join(' ');
  if (!enabled) return <div className={cls} {...rest}>{children}</div>;
  return (
    <motion.div
      className={cls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
