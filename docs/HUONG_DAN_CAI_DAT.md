# Hướng dẫn cài đặt từ đầu đến cuối

Làm theo thứ tự. Mỗi bước có cách kiểm tra "đã xong chưa". Toàn bộ chi phí: 0 đồng (GitHub, Supabase và GitHub Actions đều có gói miễn phí đủ dùng cho một người).

**Cần có:** tài khoản GitHub, GitHub Desktop, Node.js (đã cài), tài khoản Supabase (đăng ký bằng GitHub hoặc email), điện thoại Android.

---

## Bước 1. Tạo cơ sở dữ liệu trên Supabase

1. Vào <https://supabase.com> → **New project**. Đặt tên tùy ý, chọn vùng gần nhất (ví dụ Singapore), tạo mật khẩu cơ sở dữ liệu (lưu vào trình quản lý mật khẩu; app không dùng đến mật khẩu này).
2. Chờ 1–2 phút cho dự án khởi tạo.
3. Menu trái → **SQL Editor** → **New query** → mở file `supabase/schema.sql`, dán toàn bộ nội dung → **Run**. Thấy "Success. No rows returned" là xong.
   - Kiểm tra: **Table Editor** có bảng `records`, cạnh tên bảng không có cảnh báo "RLS disabled".

## Bước 2. Tạo tài khoản đăng nhập của bạn và khóa đăng ký công khai

1. **Authentication → Users → Add user → Create new user**: nhập email + mật khẩu của bạn, tick **Auto Confirm User**. Đây là tài khoản duy nhất dùng app.
2. **Authentication → Sign In / Providers** (hoặc *Settings*, tùy giao diện Supabase hiện tại) → tắt **Allow new users to sign up**. Việc này ngăn người lạ tự tạo tài khoản trên dự án của bạn.
   - Dù có ai đó biết địa chỉ web, họ cũng không đăng nhập được, và chính sách RLS (trong `schema.sql`) bảo đảm mỗi tài khoản chỉ đọc được dữ liệu của chính nó.

## Bước 3. Điền cấu hình kết nối

1. **Project Settings → API** (hoặc *Data API*): chép **Project URL** và khóa **anon / publishable** (khóa công khai).
2. Mở `web/public/config.js`, dán vào:

   ```js
   window.APP_CONFIG = {
     supabaseUrl: 'https://xxxxxxxx.supabase.co',
     supabaseAnonKey: 'eyJ… hoặc sb_publishable_…',
   };
   ```

> **Tuyệt đối không** dán khóa `service_role` hay `secret` vào file này. Khóa anon/publishable được phép công khai vì dữ liệu được bảo vệ bằng đăng nhập + RLS.

Muốn thử trước khi kết nối? Để `config.js` trống: app chạy ở "chế độ thử" với dữ liệu giả, chỉ lưu trong trình duyệt. Chạy thử: `npm install` (một lần), rồi `npm run dev` và mở <http://localhost:5173> (sửa mã là thấy ngay), hoặc `npm run serve` để dựng bản thật và mở <http://localhost:8080>.

## Bước 4. Đẩy mã lên GitHub

0. Trong thư mục dự án, chạy một lần: `npm run setup:workflows`. Lệnh này chép hai file workflow từ `setup/github-workflows/` vào `.github/workflows/` (GitHub chỉ chạy workflow ở đó).
1. GitHub Desktop → **File → Add local repository** → chọn thư mục `D:\C1.CODING\myAPP\quan-ly-tai-chinh`. Nếu nó hỏi tạo repository, đồng ý.
2. Kiểm tra danh sách file thay đổi: **không được có** `private/`, `*.xlsx`, `.clasp.json`, `node_modules/`, `dist/` (đã nằm trong `.gitignore`). Thư mục `web/src/` (mã giao diện React) thì **phải có**. Nếu thấy chúng, dừng lại và hỏi.
3. **Commit to main** → **Publish repository** (đặt tên, ví dụ `quan-ly-tai-chinh`). Repo công khai cũng được, vì mã nguồn không chứa dữ liệu của bạn.

## Bước 5. Bật GitHub Pages (bản web)

1. Trên github.com, vào repo → **Settings → Pages** → mục **Build and deployment → Source** chọn **GitHub Actions**.
2. Tab **Actions** sẽ tự chạy workflow "Đưa web lên GitHub Pages" (vài phút). Nếu chưa chạy: workflow → **Run workflow**.
3. Khi xong, địa chỉ web là `https://<tên-tài-khoản>.github.io/<tên-repo>/`. Mở lên, đăng nhập bằng tài khoản ở Bước 2.
   - Trên điện thoại: mở địa chỉ đó bằng Chrome → menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính** để dùng như app.

**Cách khác để điền cấu hình:** thay vì sửa `config.js` trong git, vào repo → **Settings → Secrets and variables → Actions → Variables** → tạo hai biến `SUPABASE_URL` và `SUPABASE_ANON_KEY`. Workflow sẽ ghi đè `web/public/config.js` lúc build.

## Bước 6. Nhập dữ liệu từ file Excel cũ

Việc này chạy trên máy bạn; dữ liệu không đi đâu ngoài file riêng tư trong `private/`.

1. Mở PowerShell trong thư mục dự án:

   ```powershell
   npm install
   npm run import:xlsx -- "D:\đường\dẫn\QUAN_LY_TAI_CHINH_2026.xlsx"
   ```

2. Công cụ in **báo cáo đối chiếu** (cũng lưu ở `private/import-report.txt`): với mỗi thẻ, khoản nợ và lệnh đổi tiền, số tính lại từ giao dịch được so với số trong sheet cũ. Mọi dòng phải là ✓. Phần "CẦN XEM LẠI" liệt kê những chỗ công cụ đã phải đoán.
3. Công cụ **không đọc** tab `password_incen`, và không nhập các tab đã bỏ (`VKA_2`, `usdt`, `vnd`, hai sổ công nợ ăn chung).
4. Mở app (đã đăng nhập) → **Cài đặt → Dữ liệu → Nhập từ file** → chọn `private/import.json` → **Thay toàn bộ**.
   - "Thay toàn bộ" xóa dữ liệu hiện có trong tài khoản rồi nạp dữ liệu từ file. Dùng cho lần nhập đầu.
5. Xem **Tổng quan**: tổng tài sản bằng số cũ **trừ phần công nợ của hai sổ ăn chung không nhập** (báo cáo nhập có ghi rõ số đã trừ).
6. Mở mục **Báo tỉ giá**: các lệnh đổi tiền cũ đã vào ở trạng thái *đã chốt*, app hỏi bạn có muốn **cộng bù lãi của chúng vào thẻ MB** hay **bỏ qua**.

## Bước 7. Dựng APK cho Android

1. Repo → **Actions → Dựng APK Android → Run workflow**. Chờ khoảng 6–12 phút.
2. Khi xong, mở lần chạy đó → cuộn xuống **Artifacts** → tải `quan-ly-tai-chinh-apk` (file .zip) → giải nén được `app-debug.apk`.
3. Chép file sang điện thoại (cáp, Zalo/Telegram "Saved Messages", Google Drive…). Mở file; Android sẽ hỏi cho phép **cài ứng dụng từ nguồn không rõ** cho ứng dụng bạn dùng để mở file → cho phép → **Cài đặt**.
4. Mở app, đăng nhập một lần; sau đó app giữ phiên đăng nhập.

Icon app là logo QLTC (nền chàm; Q và C chồng lên nhau, L và T chung một thanh ngang). Icon Android được workflow tự tạo từ ba file PNG trong `assets/`; muốn đổi hình, sửa màu/nét trong `tools/make_logo.py` rồi chạy `python3 tools/make_logo.py` (cần Python; xuất PNG cần thêm Playwright).

Đây là bản **debug** (đủ dùng cho cá nhân, không đưa lên Google Play).

### Khi nào cần dựng lại APK, khi nào không

- **Không cần APK mới:** thêm/sửa tài khoản ngân hàng, người vay, danh mục, giao dịch… Tất cả là *dữ liệu* nhập ngay trong app (trên điện thoại hay web), lưu vào Supabase, hiện ngay ở mọi thiết bị. Ví dụ mở thêm thẻ BIDV: **Tài khoản → ＋ Thêm**, hoặc bấm **＋ Tài khoản mới** ngay trong form giao dịch.
- **Cần APK mới:** chỉ khi *mã* của app thay đổi (thêm tính năng, sửa lỗi giao diện), vì app Android đóng gói sẵn bản giao diện đã dựng (thư mục `dist/`) tại thời điểm dựng. Bản web trên GitHub Pages thì tự cập nhật sau mỗi lần đẩy mã.

### Cài bản mới đè bản cũ (không phải gỡ app)

Android chỉ cho cài đè khi bản mới được ký bằng **cùng một khóa** với bản cũ, và số phiên bản không nhỏ hơn. Workflow đã lo hai việc này:

- **Số phiên bản** tự tăng theo số lần chạy workflow (`1.0.<số lần chạy>`).
- **Khóa ký cố định:** đặt khóa vào secret `DEBUG_KEYSTORE_BASE64` (Settings → Secrets and variables → Actions → New repository secret). Cách tạo khóa nằm trong chú thích của `.github/workflows/android.yml`. Khóa chỉ cần tạo **một lần** và phải cất ở nơi an toàn **ngoài kho mã** (kho này công khai). Mất khóa thì lần cài sau lại phải gỡ app một lần.

Nếu chưa có secret này, mỗi lần dựng GitHub tự sinh một khóa tạm khác nhau nên Android từ chối cài đè: lúc đó phải gỡ app cũ rồi cài bản mới (dữ liệu nằm trên Supabase nên không mất, chỉ cần đăng nhập lại). Lần cài đầu tiên sau khi đặt khóa cố định vẫn phải gỡ bản cũ một lần; từ các bản sau là cài đè bình thường.

---

## Dùng hằng ngày

- **Thêm nhanh:** ô "Nhập nhanh" ở Tổng quan, ví dụ `cafe 25k, ăn trưa 45k; +lương 10tr`. App tách từng khoản, tự đoán danh mục và cho bạn xem lại trước khi lưu.
  - Khoản **chi** có thể chia cho người trong Vay nợ (Cộng nợ / Trừ nợ) khi bạn mua hộ.
  - Khoản **thu** (có dấu `+`) có lựa chọn **Giữ lại / Gửi cho bố**. Chọn gửi thì app ghi thêm một khoản chi «Gửi bố» (danh mục Biếu gia đình) từ cùng thẻ; để trống số tiền là gửi cả khoản, hoặc gõ một phần (ví dụ `8tr`). App nhớ lựa chọn lần trước theo từng loại thu (lương / học bổng…).
- **Thu nhập:** mục riêng (thanh bên; trên điện thoại ở **Khác → Thu nhập**) gom mọi khoản bạn kiếm được: lương, học bổng, lãi đổi tiền… theo tháng, lọc theo thẻ và nguồn thu. Nút **＋ Thêm khoản thu** ở đó mở thẳng form nhập khoản thu (không cần gõ `+`).
- **Đổi tên «Sổ chi tiêu & lương (chỉ ghi lại)»:** đó là một tài khoản trong dữ liệu của bạn, nên đổi ngay trong app: **Tài khoản** → bấm vào tài khoản đó → sửa ô **Tên** thành «Sổ chi tiêu» → Lưu. Không cần dựng lại APK.
- **Báo tỉ giá (khách đổi RUB↔VND):** nhập giá và số tiền khách đưa → app tính giá báo, số tiền phải trả và lãi dự kiến.
  - Khách chỉ hỏi giá: bấm **Lưu báo giá** — chưa tính lãi, số dư không đổi (lệnh nằm ở "Chờ chốt").
  - Giao dịch thật sự xảy ra: bấm **✓ Chốt giao dịch** (hoặc nút *Chốt* ở lệnh đã lưu), điền giá thực tế nếu có → app ghi **một khoản thu = lãi vào thẻ MB đúng ngày giao dịch**. Hủy chốt hoặc xóa lệnh thì khoản lãi tự gỡ.
  - Ở hộp chốt, ô **Thẻ nhận lãi** cho chọn bất kỳ thẻ nào (thẻ MB, thẻ rúp, thẻ của người khác…) riêng cho lệnh đó; chưa có thẻ thì bấm **＋ Thẻ mới** ngay tại đó. Thẻ gợi ý sẵn là thẻ đặt ở **Cài đặt**, hoặc (nếu Cài đặt để «Nhớ thẻ lần chốt trước») thẻ bạn chọn ở lần chốt trước.
  - **Thẻ rúp:** chọn thẻ rúp thì hiện thêm ô **Tỉ giá áng chừng** (₫ cho 1 ₽, app điền sẵn theo giá báo của lệnh; sửa lại nếu muốn). Ở mục **Lãi ghi nhận** bạn bấm **₫ VND** hoặc **₽ RUB** để chọn nhập lãi bằng đơn vị nào; dòng nhỏ bên dưới cho thấy số tiền sẽ cộng vào thẻ (ví dụ «Lãi tính ra +330.000 ₫ · cộng +1.000 ₽ vào thẻ …»). Lãi trong thống kê vẫn tính bằng ₫.
  - Các tham số khác (cỡ lô, lãi mặc định) cũng chỉnh ở **Cài đặt**.
- **Chuyển tiền / đổi tiền** giữa tài khoản (kể cả khác loại tiền) ở nút **Chuyển / đổi**: ghi số tiền ra và số tiền vào, app tự tính tỷ giá thực tế.
- **Khớp số dư:** ở **Tài khoản**, bấm "Khớp số dư" khi số trong ngân hàng khác số trong app; app tạo một dòng điều chỉnh có ghi chú thay vì sửa lịch sử.
- **Sao lưu:** **Cài đặt → Dữ liệu → Xuất sao lưu** (file JSON) thỉnh thoảng một lần. File này chứa dữ liệu thật, đừng đưa vào git.

## Khi cập nhật mã

Sửa file → GitHub Desktop commit và push → workflow Pages tự chạy lại. App web dùng chiến lược "mạng trước", nên mở lại là có bản mới. APK thì bấm chạy lại workflow Android khi có thay đổi lớn (mã web được đóng gói bên trong APK).

## Gặp sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Banner "Chế độ thử" hiện ở app thật | `config.js` còn trống hoặc sai; kiểm tra Project URL và khóa |
| "Sai email hoặc mật khẩu" | Chưa tick *Auto Confirm User* khi tạo user, hoặc gõ sai; vào Authentication → Users để đặt lại |
| Đăng nhập được nhưng không thấy dữ liệu / lỗi khi lưu | Chưa chạy `schema.sql` hoặc chạy lỗi giữa chừng; chạy lại (an toàn khi chạy nhiều lần) |
| Web Pages trắng trơn | Mở Console (F12) xem lỗi; thường do `config.js` sai cú pháp |
| Workflow Pages báo lỗi "Pages not enabled" | Chưa đặt Source = GitHub Actions ở Settings → Pages |
| Dự án Supabase "paused" | Gói miễn phí có thể tạm dừng dự án khi lâu không hoạt động; vào dashboard bấm **Restore** (dữ liệu vẫn còn) |
