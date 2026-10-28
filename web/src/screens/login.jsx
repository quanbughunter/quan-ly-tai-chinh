import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, LoaderCircle, LogIn, ShieldCheck } from 'lucide-react';
import { store } from '@/lib/store-hooks.js';
import { navigate } from '@/lib/route.js';
import { errMsg } from '@/lib/format.js';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fine = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer:fine)').matches;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      await store.signIn(email.trim(), pass);
      navigate('home');
    } catch (ex) {
      const m = errMsg(ex);
      setErr(/invalid login/i.test(m) ? 'Sai email hoặc mật khẩu.' : m);
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      {/* nền: hai quầng sáng mờ theo màu thương hiệu */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 size-[26rem] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 size-[24rem] rounded-full bg-[oklch(0.78_0.12_350)]/25 blur-3xl dark:bg-[oklch(0.55_0.17_350)]/20" />
      </div>

      <motion.form
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border bg-card/90 p-7 shadow-[0_20px_60px_-24px_rgb(40_30_120/0.35)] backdrop-blur-xl"
      >
        <div className="flex flex-col items-center text-center">
          <img src="icons/icon.svg" alt="Logo Quản lý tài chính" width={72} height={72} className="size-[72px] rounded-[22px] shadow-lg shadow-primary/30" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Quản lý tài chính</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Đăng nhập để xem sổ của bạn. Dữ liệu được mã hóa khi truyền và chỉ tài khoản của bạn đọc được.</p>
        </div>

        <div className="mt-6 grid gap-4">
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              placeholder="ban@example.com"
              autoFocus={fine}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-2xl"
            />
          </Field>
          <Field label="Mật khẩu">
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="h-12 rounded-2xl pr-12"
              />
              <button
                type="button"
                aria-label={show ? 'Ẩn ký tự đang gõ' : 'Hiện ký tự đang gõ'}
                aria-pressed={show}
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-1 my-auto grid size-10 place-content-center rounded-xl text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30"
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </Field>
          <p role="alert" className="min-h-0 text-sm font-medium text-destructive empty:hidden">{err}</p>
          <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <LogIn />}
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Kết nối được bảo vệ</p>
      </motion.form>
    </div>
  );
}
