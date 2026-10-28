import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CloudOff, FlaskConical, WifiOff } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { toast } from '@/lib/toast.js';
import { errMsg } from '@/lib/format.js';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/cn.js';

const tone = {
  warn: 'border-warning/40 bg-warning/15 text-warning-foreground',
  info: 'border-primary/25 bg-primary/8 text-foreground',
};

function Banner({ kind = 'warn', icon: Icon, children, action }) {
  return (
    <motion.div layout initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div role="status" className={cn('mb-3 flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-[13px] font-medium', tone[kind])}>
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{children}</span>
        {action || null}
      </div>
    </motion.div>
  );
}

export function Banners() {
  useStore();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => { setOnline(true); if (store.mode === 'cloud') store.refresh().catch(() => {}); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return (
    <AnimatePresence initial={false}>
      {!online ? <Banner key="net" icon={WifiOff}>Không có mạng — ghi dữ liệu có thể thất bại.</Banner> : null}
      {store.offline ? (
        <Banner key="off" icon={CloudOff} action={<Button size="sm" variant="outline" onClick={() => store.refresh().catch((e) => toast(errMsg(e), 'error'))}>Thử lại</Button>}>
          Đang xem bản lưu gần nhất (ngoại tuyến). Chưa ghi được cho đến khi có mạng.
        </Banner>
      ) : null}
      {store.mode === 'local' ? (
        <Banner key="local" kind="info" icon={FlaskConical}>Chế độ thử: dữ liệu chỉ lưu trong trình duyệt này. <a className="font-bold text-primary underline-offset-2 hover:underline" href="#/settings">Cài đặt</a></Banner>
      ) : null}
    </AnimatePresence>
  );
}
