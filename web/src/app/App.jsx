import { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { store, useStore } from '@/lib/store-hooks.js';
import { useRoute } from '@/lib/route.js';
import { ROUTES } from '@/lib/nav.js';
import { errMsg } from '@/lib/format.js';
import { hasOpenDialog, DialogHost } from '@/lib/dialogs.jsx';
import { Toaster } from '@/components/ui/toaster.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { openQuickAdd } from '@/forms/index.js';
import { Sidebar, TabBar, Fab } from './nav.jsx';
import { Banners } from './banners.jsx';
import { ErrorBoundary } from './error-boundary.jsx';
import { openAddMenu } from './add-menu.jsx';
import Dashboard from '@/screens/dashboard.jsx';
import Transactions from '@/screens/transactions.jsx';
import Income from '@/screens/income.jsx';
import Accounts from '@/screens/accounts.jsx';
import Debts from '@/screens/debts.jsx';
import Exchange from '@/screens/exchange.jsx';
import Dorm from '@/screens/dorm.jsx';
import Scholarship from '@/screens/scholarship.jsx';
import Settings from '@/screens/settings.jsx';
import Login from '@/screens/login.jsx';

const SCREENS = { home: Dashboard, tx: Transactions, income: Income, accounts: Accounts, debts: Debts, fx: Exchange, dorm: Dorm, scholarship: Scholarship, settings: Settings };

let initPromise = null;
const initStore = () => (initPromise ||= store.init(window.APP_CONFIG || {}));

function registerSW() {
  if (!('serviceWorker' in navigator) || window.Capacitor) return;
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW:', e));
}

function Splash({ children }) {
  return (
    <div className="boot-splash">
      <div className="boot-dot" />
      <span>{children}</span>
    </div>
  );
}

function Fatal({ error }) {
  return (
    <div className="grid min-h-dvh place-content-center px-6">
      <Card className="w-full max-w-sm p-7 text-center">
        <span className="mx-auto mb-4 grid size-14 place-content-center rounded-2xl bg-destructive/12 text-destructive"><TriangleAlert className="size-7" /></span>
        <h1 className="text-xl font-extrabold">Không mở được dữ liệu</h1>
        <p className="mt-2 text-sm text-muted-foreground">{errMsg(error)}</p>
        <Button className="mt-5 w-full" onClick={() => location.reload()}><RefreshCw className="size-4" />Thử lại</Button>
      </Card>
    </div>
  );
}

function useGlobalBehaviors(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || store.mode !== 'cloud' || !store.user) return;
      if (Date.now() - store.loadedAt < 30000 || hasOpenDialog()) return;
      store.refresh().catch(() => {});
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || hasOpenDialog()) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAddMenu(); }
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); openQuickAdd(''); }
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('visibilitychange', onVisible); document.removeEventListener('keydown', onKey); };
  }, [enabled]);
}

function Shell() {
  const { name, params } = useRoute();
  const key = ROUTES[name] ? name : 'home';
  const Screen = SCREENS[key];
  const pageKey = `${key}/${params.id || ''}`;
  useGlobalBehaviors(true);
  useEffect(() => { document.title = `${ROUTES[key].title} · Quản lý tài chính`; }, [key]);
  useEffect(() => { window.scrollTo(0, 0); }, [pageKey]);
  return (
    <div className="min-h-dvh lg:pl-72">
      <Sidebar active={key} />
      <div className="mx-auto w-full max-w-5xl px-4 pt-[calc(1.1rem+env(safe-area-inset-top))] pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-9 lg:pb-12">
        <Banners />
        <ErrorBoundary key={pageKey}>
          <motion.main id="view" key={pageKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <Screen params={params} />
          </motion.main>
        </ErrorBoundary>
      </div>
      <TabBar active={key} />
      <Fab />
    </div>
  );
}

export function App() {
  useStore();
  const [boot, setBoot] = useState({ status: 'loading', error: null });
  useEffect(() => {
    let alive = true;
    initStore().then(() => { if (alive) { setBoot({ status: 'ready', error: null }); registerSW(); } })
      .catch((e) => { console.error(e); if (alive) setBoot({ status: 'error', error: e }); });
    return () => { alive = false; };
  }, []);

  let body;
  if (boot.status === 'loading') body = <Splash>Đang mở sổ…</Splash>;
  else if (boot.status === 'error') body = <Fatal error={boot.error} />;
  else if (store.mode === 'cloud' && !store.user) body = <Login />;
  else body = <Shell />;

  return (
    <MotionConfig reducedMotion="user">
      {body}
      <DialogHost />
      <Toaster />
    </MotionConfig>
  );
}
