# Quản lý tài chính

Sổ thu chi, tài khoản nhiều loại tiền, công nợ, **Báo tỉ giá** RUB↔VND (báo giá → chốt giao dịch → tự cộng lãi vào thẻ MB), KTX và **Học bổng MIIGAiK** (tick “đã nhận” + chọn thẻ ₽ → tự cộng 15.000 ₽ vào số dư thẻ), **Nhập nhanh** nhiều khoản (có thể chia tiền ăn cho người trong Vay nợ: cộng nợ / trừ nợ) — thay cho file Google Sheet cũ.

- **Web** (GitHub Pages) và **APK Android** (Capacitor) dùng chung một mã nguồn trong `web/`: HTML + JavaScript thuần, **không cần bước build**.
- **Dữ liệu** nằm trên Supabase, sau đăng nhập bằng email + mật khẩu; bảo vệ bằng Row Level Security. Repo công khai chỉ chứa mã nguồn.
- Giao diện sáng/tối, tiếng Việt, cài được như PWA, mở lại được khi mất mạng (chỉ xem).

| Cần làm gì | Đọc |
|---|---|
| Cài đặt từ đầu đến cuối | [`docs/HUONG_DAN_CAI_DAT.md`](docs/HUONG_DAN_CAI_DAT.md) |
| Vì sao thiết kế như vậy, công thức, ánh xạ từ sheet cũ | [`docs/THIET_KE.md`](docs/THIET_KE.md) |

## Cấu trúc

```
web/                 ứng dụng (index.html, js/, css/, sw.js, manifest) — thư mục được đưa lên Pages
  js/calc.js         số dư, công nợ, tổng quan (tính từ giao dịch)
  js/fx.js           công thức báo giá sang / về và lãi thực
  js/deals.js        lệnh đổi tiền: báo giá / đã chốt, cộng lãi vào thẻ khi chốt
  js/store.js        lưu trữ: Supabase (đám mây) hoặc trình duyệt (chế độ thử)
supabase/schema.sql  bảng records + chính sách RLS
tools/import_xlsx.mjs  nhập từ file Excel cũ + đối chiếu số dư
tests/               test cho phần tính toán (node:test, không cần cài gì)
.github/workflows/   pages.yml (web) · android.yml (APK)   ← tạo bằng `npm run setup:workflows` (bản gốc ở setup/)
capacitor.config.json  cấu hình đóng gói APK
```

## Lệnh thường dùng

```powershell
npm test                  # chạy test tính toán
npm run serve             # mở thử ở http://localhost:8080 (chế độ thử nếu config.js trống)
npm run setup:workflows   # (một lần) chép workflow GitHub vào .github/workflows
npm install               # (một lần) cài thư viện cho công cụ nhập Excel
npm run import:xlsx -- "đường\dẫn\file.xlsx"
```

## Quyền riêng tư

Không commit `private/`, file `.xlsx`, hay file JSON xuất từ app: chúng chứa dữ liệu thật (đã có trong `.gitignore`). Khóa `anon`/`publishable` của Supabase được phép công khai; khóa `service_role`/`secret` thì tuyệt đối không.
