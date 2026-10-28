# Giao diện mới — quy ước chung

Ngăn xếp: React 19 · Vite · Tailwind v4 · shadcn/ui (viết tay, trên `radix-ui`) · Lucide · Motion · Recharts · Sonner.
Logic nghiệp vụ nằm ở `web/js/*.js` (thuần JS, **không đổi**): import qua `@logic/…` (calc, money, dates, deals, fx, share, quickadd, quicksave, scholarship, store, model, demo).
Mã giao diện nằm ở `web/src` (import qua `@/…`).

## Quy tắc

- Mọi chữ hiển thị là **tiếng Việt**, giữ nguyên câu chữ của bản cũ (bản cũ đã xóa; xem lịch sử git trước phiên bản 2.0) trừ khi có lý do rõ ràng.
- Mỗi màn hình: `export default function XxxScreen({ params })` trong `screens/xxx.jsx`. Gọi `useStore()` (từ `@/lib/store-hooks.js`) ở đầu component để tự vẽ lại khi dữ liệu đổi; đọc dữ liệu bằng `store.all('txs')`, `store.byId(...)`, `store.settings()`.
- Tính toán nặng bọc `useMemo(..., [ver])` với `const ver = useStore()`.
- Số tiền luôn qua `money(n, cur, {sign})` từ `@/lib/format.js` (tôn trọng chế độ "ẩn số dư"), class `tnum` cho số.
- Màu theo token, không viết màu cứng: `bg-background text-foreground bg-card border-border text-muted-foreground bg-primary text-primary-foreground bg-secondary bg-accent bg-muted text-income text-expense text-warning text-destructive`, biểu đồ `var(--chart-1..8)`, thẻ nổi bật `bg-gradient-to-br from-hero-from to-hero-to text-white`. Chế độ tối tự đổi theo token (dùng `dark:` khi thật cần).
- Không thêm thư viện mới. Biểu tượng: `lucide-react` (kiểm tra tên có thật trong `node_modules/lucide-react`).
- Hộp thoại: `openDialog(() => <MyForm />)` từ `@/lib/dialogs.jsx`; bên trong dùng `<Modal title footer onSubmit>` (`@/components/ui/modal.jsx`) và `useDialog()` để lấy `close`. `confirmBox(message, {okLabel, danger})` trả Promise<boolean>. Toast: `toast(msg, 'ok' | 'error' | 'info')` từ `@/lib/toast.js`.
- Ô chọn: `<Select options=[{value,label}] value onChange />` (giá trị `''` được hỗ trợ). Nhãn + ô: `<Field label hint error>`. Tiền: `<MoneyInput value onChange currency />` + `readAmount(text)` (NaN nếu sai). Nhóm nút chọn một: `<Segmented options value onChange />`. Tick: `<CheckRow checked onChange>`.
- Danh sách giao dịch: `<TxRow tx onClick showDate />` trong `<RowList>`; dòng tự do: `<Row icon tone title sub right onClick />`.
- Thẻ: `<Section title right>…</Section>` hoặc `<Card>`. Tiêu đề trang: `<PageHeader title subtitle actions />`. Trạng thái rỗng: `<EmptyState action>`.
- Bố cục trang: khối dọc `grid gap-4`; cột đôi trên máy tính `lg:grid-cols-2`; trên điện thoại một cột, bấm được bằng ngón cái (nút cao ≥ 40px). Nội dung không được tràn ngang ở 360px.
- Hiệu ứng (Motion): nhẹ và có chủ đích — xuất hiện lần lượt cho danh sách (`delay: Math.min(i, 8) * 0.03`), số/thanh tiến độ chuyển mượt, bấm nút co nhẹ. Không làm chậm thao tác. `MotionConfig reducedMotion="user"` đã bật ở gốc.
- Điều hướng: `href="#/tx"`, `navigate('debts', id)` từ `@/lib/route.js`.
- Truy cập: nút chỉ có biểu tượng phải có `aria-label`; hộp thoại có tiêu đề.

## Kiểm thử bằng Playwright (Python) với bản dựng riêng

```
npx vite build --outDir /tmp/dist-<tên> --emptyOutDir        # KHÔNG dựng vào dist/ (các tiến trình khác đang dùng)
python3 -m http.server <cổng> -d /tmp/dist-<tên> &            # cổng riêng
```
Trong Playwright chặn `**/config.js` trả `window.APP_CONFIG = {};` để vào chế độ thử (dữ liệu trong IndexedDB), rồi bấm "Tạo dữ liệu mẫu" ở Tổng quan để có dữ liệu giả. Kiểm tra ở 390×844 và 1280×800, sáng và tối; chụp ảnh và nhìn lại; theo dõi `console`/`pageerror` phải sạch.
