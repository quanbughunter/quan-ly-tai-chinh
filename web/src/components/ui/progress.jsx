import { motion } from 'motion/react';
import { cn } from '@/lib/cn.js';

/** Thanh tiến độ ngân sách: xanh khi ổn, vàng khi gần hết (>= warn), đỏ khi vượt. pct là tỷ lệ 0..1+ */
export function Progress({ pct, warn = 0.8, className }) {
  const p = Math.max(0, Math.min(1, pct));
  const tone = pct > 1 ? 'bg-destructive' : pct >= warn ? 'bg-warning' : 'bg-primary';
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <motion.div className={cn('h-full rounded-full', tone)} initial={{ width: 0 }} animate={{ width: `${p * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
    </div>
  );
}
