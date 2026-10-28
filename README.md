# Quản lý tài chính

Sổ thu chi, tài khoản nhiều loại tiền, công nợ, **Báo tỉ giá** RUB↔VND (báo giá → chốt giao dịch → tự cộng lãi vào thẻ MB), KTX và **Học bổng MIIGAiK** (tick “đã nhận” + chọn thẻ ₽ → tự cộng 15.000 ₽ vào số dư thẻ), **Nhập nhanh** nhiều khoản (có thể chia tiền ăn cho người trong Vay nợ: cộng nợ / trừ nợ) — thay cho file Google Sheet cũ.

- **Web** (GitHub Pages) và **APK Android** (Capacitor) dùng chung một mã nguồn trong `web/`: giao diện **React + Tailwind + shadcn/ui + Lucide + Motion + Recharts**, dựng bằng **Vite** (`npm run build` → `dist/`). Phần tính toán (`web/js/`) là JavaScript thuần, có test riêng.
- **Dữ liệu** nằm trên Supabase, sau đăng nhập bằng email + mật khẩu; bảo vệ bằng Row Level Security. Repo công khai chỉ chứa mã nguồn.
- Giao diện sáng/tối, tiếng Việt, cài được như PWA, mở lại được khi mất mạng (chỉ xem).

| Cần làm gì | Đọc |
|---|---|
| Cài đặt từ đầu đến cuối | [`docs/HUONG_DAN_CAI_DAT.md`](docs/HUONG_DAN_CAI_DAT.md) |
| Vì sao thiết kế như vậy, công thức, ánh xạ từ sheet cũ | [`docs/THIET_KE.md`](docs/THIET_KE.md) |

## Cấu trúc

```
web/                 nguồn ứng dụng — Vite dựng thành dist/ (thư mục được đưa lên Pages và vào APK)
  index.html         trang gốc (Vite)
  src/               giao diện React: app/ (khung, điều hướng), screens/ (các màn hình), forms/ (biểu mẫu),
                     components/ui/ (nút, ô nhập, hộp thoại… kiểu shadcn), lib/ (hộp thoại, định tuyến, định dạng)
  public/            chép nguyên vào dist/: config.js, manifest, icons, sw.js (service worker), vendor/supabase.js
  js/calc.js         số dư, công nợ, tổng quan (tính từ giao dịch)
  js/fx.js           công thức báo giá sang / về và lãi thực
  js/deals.js        lệnh đổi tiền: báo giá / đã chốt, cộng lãi vào thẻ khi chốt
  js/store.js        lưu trữ: Supabase (đám mây) hoặc trình duyệt (chế độ thử)
  js/quicksave.js    lưu Nhập nhanh (có hoặc không gắn tài khoản)
vite.config.js       cấu hình dựng (React, Tailwind, danh sách tệp cho service worker)
supabase/schema.sql  bảng records + chính sách RLS
tools/import_xlsx.mjs  nhập từ file Excel cũ + đối chiếu số dư
tools/make_logo.py   vẽ logo QLTC (Q·C chồng nhau, L·T chung một thanh ngang) và xuất icon web + Android
assets/              icon-only / icon-foreground / icon-background (PNG) — nguồn để dựng icon Android
tests/               test cho phần tính toán (node:test, không cần cài gì)
.github/workflows/   pages.yml (web) · android.yml (APK)   ← tạo bằng `npm run setup:workflows` (bản gốc ở setup/)
capacitor.config.json  cấu hình đóng gói APK
```

## Lệnh thường dùng

```powershell
npm install               # (một lần, và mỗi khi package.json đổi) cài thư viện
npm test                  # chạy test tính toán
npm run dev               # mở bản đang phát triển ở http://localhost:5173 (sửa mã là thấy ngay)
npm run build             # dựng ra dist/
npm run serve             # dựng rồi mở bản thật ở http://localhost:8080 (chế độ thử nếu web/public/config.js trống)
npm run setup:workflows   # (một lần, và mỗi khi workflow đổi) chép workflow GitHub vào .github/workflows
npm run import:xlsx -- "đường\dẫn\file.xlsx"
```

## Quyền riêng tư

Không commit `private/`, file `.xlsx`, hay file JSON xuất từ app: chúng chứa dữ liệu thật (đã có trong `.gitignore`). Khóa `anon`/`publishable` của Supabase được phép công khai; khóa `service_role`/`secret` thì tuyệt đối không.
