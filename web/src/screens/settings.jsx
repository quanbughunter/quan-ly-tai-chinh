import { useState } from 'react';
import { motion } from 'motion/react';
import { Cloud, Database, Download, FlaskConical, Layers, LogOut, Plus, RefreshCw, Repeat, GraduationCap, Eye, Sigma, Tags, Target, Trash2, Upload, Sparkles } from 'lucide-react';
import { CURRENCIES } from '@logic/money.js';
import { todayStr } from '@logic/dates.js';
import { COLLECTIONS } from '@logic/model.js';
import { seedDemo } from '@logic/demo.js';
import { getTheme, setTheme } from '@logic/theme.js';
import { store, useStore } from '@/lib/store-hooks.js';
import { money, errMsg, download } from '@/lib/format.js';
import { accountOptions } from '@/lib/options.js';
import { confirmBox } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Section } from '@/components/ui/card.jsx';
import { Field, FieldRow } from '@/components/ui/field.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/checkbox.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { Row, RowList } from '@/components/row.jsx';
import { NumField } from '@/components/misc/num-field.jsx';
import { openCategory } from '@/components/misc/category-dialog.jsx';
import { openBudget } from '@/components/misc/budget-dialog.jsx';
import { openImport, openWipe } from '@/components/misc/data-dialogs.jsx';

const save = async (fn) => {
  try { await fn(); toast('Đã lưu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
};

const T = ({ icon: Icon, children }) => <span className="inline-flex items-center gap-2"><Icon className="size-4 text-primary" strokeWidth={2.2} />{children}</span>;

/* ───────── Các khối ───────── */
function CloudCard() {
  const refresh = async () => { try { await store.refresh(); toast('Đã tải lại dữ liệu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); } };
  const logout = async () => {
    if (!(await confirmBox('Đăng xuất khỏi thiết bị này?', { okLabel: 'Đăng xuất' }))) return;
    await store.signOut();
    location.hash = '#/';
  };
  return (
    <Section title={<T icon={Cloud}>Đồng bộ đám mây</T>}>
      <div className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-xs font-semibold text-muted-foreground">Đăng nhập</dt><dd className="mt-0.5 truncate text-[15px] font-bold">{store.user ? store.user.email : '—'}</dd></div>
          <div><dt className="text-xs font-semibold text-muted-foreground">Trạng thái</dt><dd className="mt-0.5 text-[15px] font-bold">{store.offline ? 'Ngoại tuyến (chỉ xem)' : 'Đã đồng bộ'}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refresh}><RefreshCw />Tải lại</Button>
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={logout}><LogOut />Đăng xuất</Button>
        </div>
      </div>
    </Section>
  );
}

function LocalModeCard() {
  const seed = async () => {
    if (store.all('accounts').length && !(await confirmBox('Thêm dữ liệu mẫu vào dữ liệu hiện có?', { okLabel: 'Thêm' }))) return;
    try { await seedDemo(); toast('Đã tạo dữ liệu mẫu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <Section title={<T icon={FlaskConical}>Chế độ thử (chưa nối đám mây)</T>}>
      <div className="grid gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">Dữ liệu đang chỉ nằm trong trình duyệt này, không đồng bộ giữa máy tính và điện thoại. Điền Supabase vào config.js (xem hướng dẫn trong docs) để có đăng nhập và đồng bộ.</p>
        <div><Button variant="outline" onClick={seed}><Sparkles />Tạo dữ liệu mẫu</Button></div>
      </div>
    </Section>
  );
}

function DisplayCard({ s }) {
  const [theme, setThemeState] = useState(getTheme());
  return (
    <Section title={<T icon={Eye}>Hiển thị</T>}>
      <div className="grid gap-5">
        <Field label="Giao diện">
          <Segmented
            aria-label="Giao diện"
            options={[{ value: 'auto', label: 'Theo máy' }, { value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }]}
            value={theme}
            onChange={(v) => { setThemeState(v); setTheme(v); }}
          />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-[15px] leading-snug">Ẩn số tiền (hiện •••••), tiện khi mở app nơi đông người</span>
          <Switch checked={!!s.hideAmounts} onCheckedChange={(v) => save(() => store.saveSettings({ hideAmounts: v }))} aria-label="Ẩn số tiền" />
        </label>
      </div>
    </Section>
  );
}

function RatesCard({ s }) {
  return (
    <Section title={<T icon={Repeat}>Tỷ giá quy đổi</T>}>
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">Chỉ dùng để quy ra ₫ ở màn Tổng quan và ngân sách. Không ảnh hưởng số dư từng tài khoản.</p>
        <FieldRow>
          {CURRENCIES.filter((c) => c !== s.baseCurrency).map((c) => (
            <NumField key={c} label={`1 ${c} = ? ₫`} value={s.rates[c] ?? ''} cur="VND" onSave={(v) => store.saveSettings({ rates: { [c]: v } })} />
          ))}
        </FieldRow>
      </div>
    </Section>
  );
}

function ParamsCard({ s }) {
  const P = s.params;
  const setP = (k) => (v) => store.saveSettings({ params: { [k]: v } });
  return (
    <Section title={<T icon={Layers}>Tham số đổi tiền</T>}>
      <div className="grid gap-4">
        <FieldRow>
          <NumField label="Cỡ lô chiều “Sang” (₫)" value={P.lotSang} cur="VND" onSave={setP('lotSang')} />
          <NumField label="Cỡ lô chiều “Về” (₽)" value={P.lotVe} cur="RUB" onSave={setP('lotVe')} />
          <NumField label="Lãi mặc định chiều Sang (₫/lô)" value={P.defaultMarginSang} cur="VND" onSave={setP('defaultMarginSang')} />
          <NumField label="Lãi mặc định chiều Về (₫/lô)" value={P.defaultMarginVe} cur="VND" onSave={setP('defaultMarginVe')} />
          <NumField label="Số ₫ tham chiếu để quy ra ₽" value={P.refVnd} cur="VND" onSave={setP('refVnd')} hint="Dòng “… ₫ tương đương … ₽” trong máy tính báo giá." />
        </FieldRow>
        <Field
          label="Thẻ nhận lãi mặc định khi chốt giao dịch"
          hint="Khi bạn bấm “Chốt giao dịch” ở mục Báo tỉ giá, lãi thực được cộng vào thẻ gợi ý sẵn, đúng ngày của lệnh; thẻ VND hay thẻ rúp đều được (thẻ rúp thì lãi quy đổi theo tỉ giá áng chừng bạn nhập khi chốt). Mỗi lần chốt bạn vẫn chọn lại được thẻ khác. Để “Nhớ thẻ lần chốt trước” thì app gợi ý đúng thẻ bạn vừa chọn lần trước. Báo giá mà chưa chốt thì không cộng gì."
        >
          <Select options={accountOptions({ none: '— Nhớ thẻ lần chốt trước —' })} value={P.dealAccountId} onChange={(v) => save(() => store.saveSettings({ params: { dealAccountId: v } }))} />
        </Field>
      </div>
    </Section>
  );
}

function ScholarshipCard({ s }) {
  const P = s.params;
  return (
    <Section title={<T icon={GraduationCap}>Học bổng MIIGAiK</T>}>
      <div className="grid gap-4">
        <NumField label="Số tiền mỗi tháng (₽)" value={P.scholarshipAmount} cur="RUB" onSave={(v) => store.saveSettings({ params: { scholarshipAmount: v } })} hint="Điền sẵn khi thêm tháng mới ở mục Học bổng MIIGAiK." />
        <Field label="Thẻ nhận học bổng chọn sẵn" hint="Khi bạn tick “Đã nhận” ở một tháng học bổng, số tiền được cộng vào thẻ chọn ở đó. App nhớ thẻ bạn chọn lần gần nhất.">
          <Select
            options={accountOptions({ none: '— Tự chọn: Gazprom, rồi PSPB —', only: (a) => a.currency === 'RUB' && a.kind !== 'savings' })}
            value={P.scholarshipAccountId}
            onChange={(v) => save(() => store.saveSettings({ params: { scholarshipAccountId: v } }))}
          />
        </Field>
      </div>
    </Section>
  );
}

function CategoryGroup({ type, title, cats }) {
  const list = cats.filter((c) => c.type === type).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
  return (
    <div className="px-4 pt-3 sm:px-5">
      <div className="pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
      {list.length ? (
        <div className="flex flex-wrap gap-2">
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openCategory(c)}
              className="inline-flex h-10 items-center gap-2 rounded-full border bg-secondary/60 pr-3.5 pl-3 text-[14px] font-semibold outline-none transition-all hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95"
            >
              <span aria-hidden className="text-base">{c.icon || '•'}</span>{c.name}
            </button>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Chưa có.</p>}
    </div>
  );
}

function CategoriesCard() {
  const cats = store.all('categories');
  return (
    <Section title={<T icon={Tags}>Danh mục</T>} right={<Button size="sm" onClick={() => openCategory(null)}><Plus />Thêm</Button>} flush>
      <CategoryGroup type="expense" title="Khoản chi" cats={cats} />
      <CategoryGroup type="income" title="Khoản thu" cats={cats} />
      <p className="px-4 pb-2 pt-3 text-xs text-muted-foreground sm:px-5">Bấm vào một danh mục để sửa hoặc xóa.</p>
    </Section>
  );
}

function BudgetsCard() {
  const rows = store.all('budgets').map((b) => ({ b, cat: b.categoryId ? store.byId('categories', b.categoryId) : null }))
    .sort((x, y) => (x.cat ? x.cat.name : '').localeCompare(y.cat ? y.cat.name : '', 'vi'));
  return (
    <Section title={<T icon={Target}>Ngân sách mỗi tháng</T>} right={<Button size="sm" onClick={() => openBudget(null)}><Plus />Thêm</Button>} flush>
      <p className="px-4 pb-2 text-sm text-muted-foreground sm:px-5">Đặt hạn mức chi theo danh mục (hoặc tổng chi). Màn Tổng quan sẽ cảnh báo khi gần chạm hạn mức.</p>
      {rows.length ? (
        <RowList>
          {rows.map(({ b, cat }) => (
            <Row
              key={b.id}
              onClick={() => openBudget(b)}
              tone="neutral"
              icon={cat ? <span aria-hidden>{cat.icon || '•'}</span> : <Sigma strokeWidth={2.2} />}
              title={cat ? cat.name : 'Tổng chi mọi danh mục'}
              right={<span className="tnum text-[15px] font-bold">{money(b.amount, b.currency || 'VND')}</span>}
            />
          ))}
        </RowList>
      ) : <EmptyState>Chưa đặt ngân sách nào.</EmptyState>}
    </Section>
  );
}

function DataCard() {
  const total = COLLECTIONS.filter((c) => c !== 'settings').reduce((n, c) => n + store.all(c).length, 0);
  return (
    <Section title={<T icon={Database}>Dữ liệu</T>}>
      <div className="grid gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">Sao lưu định kỳ: tải file JSON về máy. File chứa toàn bộ số liệu cá nhân — đừng đưa lên GitHub.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { download(`quan-ly-tai-chinh-${todayStr()}.json`, JSON.stringify(store.exportAll(), null, 2)); toast('Đã tải file sao lưu.', 'ok'); }}><Download />Xuất sao lưu</Button>
          <Button variant="outline" onClick={openImport}><Upload />Nhập từ file</Button>
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={openWipe}><Trash2 />Xóa toàn bộ dữ liệu</Button>
        </div>
        <p className="text-sm text-muted-foreground">{`Hiện có ${total} bản ghi.`}</p>
      </div>
    </Section>
  );
}

/* ───────── Màn hình ───────── */
export default function Settings() {
  useStore();
  const s = store.settings();
  return (
    <div>
      <PageHeader title="Cài đặt" />
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          {store.mode === 'cloud' ? <CloudCard /> : <LocalModeCard />}
          <DisplayCard s={s} />
          <RatesCard s={s} />
          <ParamsCard s={s} />
          <ScholarshipCard s={s} />
        </div>
        <div className="grid gap-4">
          <CategoriesCard />
          <BudgetsCard />
          <DataCard />
        </div>
      </motion.div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Quản lý tài chính · bản 2.0 · tiền được tính từ sổ giao dịch, không nhập tay số dư.</p>
    </div>
  );
}
