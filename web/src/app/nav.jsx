import { useEffect, useState } from 'react';
import { Ellipsis, Plus, Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn.js';
import { ROUTES, SIDE_ORDER, TAB_ORDER, routeHref } from '@/lib/nav.js';
import { getTheme, setTheme, resolvedTheme } from '@logic/theme.js';
import { useResolvedTheme } from '@/lib/use-theme.js';
import { Button } from '@/components/ui/button.jsx';
import { openAddMenu } from './add-menu.jsx';
import { openMoreMenu } from './more-menu.jsx';

export function Sidebar({ active }) {
  const theme = useResolvedTheme();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col gap-5 border-r bg-card/60 px-4 py-6 backdrop-blur-xl lg:flex" aria-label="Thanh bên">
      <a href={routeHref('home')} className="flex items-center gap-3 px-2 text-[17px] font-extrabold tracking-tight outline-none">
        <img src="icons/icon.svg" alt="" width={40} height={40} className="size-10 rounded-xl shadow-md shadow-primary/30" />
        <span>Quản lý tài chính</span>
      </a>
      <nav aria-label="Điều hướng" className="grid gap-1">
        {SIDE_ORDER.map((k) => {
          const Icon = ROUTES[k].icon;
          const on = active === k;
          return (
            <a key={k} href={routeHref(k)} data-route={k} aria-current={on ? 'page' : undefined} className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30', on ? 'text-primary' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
              {on ? <motion.span layoutId="side-pill" className="absolute inset-0 -z-0 rounded-xl bg-primary/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} /> : null}
              <Icon className="relative size-5" strokeWidth={on ? 2.3 : 1.9} />
              <span className="relative">{ROUTES[k].title}</span>
            </a>
          );
        })}
      </nav>
      <div className="mt-auto grid gap-3">
        <Button size="lg" onClick={openAddMenu} className="w-full"><Plus className="size-5" />Thêm giao dịch</Button>
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>Phím tắt: N thêm · Q nhập nhanh</span>
          <button type="button" aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} onClick={() => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')} className="grid size-8 place-content-center rounded-lg outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function TabBar({ active }) {
  const moreOn = !TAB_ORDER.includes(active);
  const tabCls = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-2 text-[11px] font-semibold outline-none transition-colors focus-visible:text-primary';
  return (
    <nav aria-label="Điều hướng chính" className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {TAB_ORDER.map((k) => {
        const Icon = ROUTES[k].icon;
        const on = active === k;
        return (
          <a key={k} href={routeHref(k)} data-route={k} aria-current={on ? 'page' : undefined} className={cn(tabCls, on ? 'text-primary' : 'text-muted-foreground')}>
            {on ? <motion.span layoutId="tab-pill" className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} /> : null}
            <Icon className="size-[22px]" strokeWidth={on ? 2.4 : 1.9} />
            <span>{ROUTES[k].title}</span>
          </a>
        );
      })}
      <button type="button" data-route="more" aria-current={moreOn ? 'page' : undefined} onClick={openMoreMenu} className={cn(tabCls, moreOn ? 'text-primary' : 'text-muted-foreground')}>
        {moreOn ? <motion.span layoutId="tab-pill" className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} /> : null}
        <Ellipsis className="size-[22px]" strokeWidth={moreOn ? 2.6 : 2.2} />
        <span>Khác</span>
      </button>
    </nav>
  );
}

export function Fab() {
  // Cuộn xuống thì nút ＋ ẩn đi (khỏi che số tiền ở mép phải), cuộn lên hoặc về đầu trang thì hiện lại.
  const [hide, setHide] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      if (Math.abs(dy) < 6) return;
      setHide(dy > 0 && y > 120);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <motion.button
      type="button"
      aria-label="Thêm giao dịch"
      onClick={openAddMenu}
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={hide ? { scale: 0.7, opacity: 0, y: 28 } : { scale: 1, opacity: 1, y: 0 }}
      style={{ pointerEvents: hide ? 'none' : 'auto' }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-content-center rounded-2xl bg-gradient-to-br from-hero-from to-hero-to text-white shadow-xl shadow-primary/40 outline-none focus-visible:ring-4 focus-visible:ring-ring/40 lg:hidden"
    >
      <Plus className="size-7" strokeWidth={2.4} />
    </motion.button>
  );
}
