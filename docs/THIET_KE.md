# Thiết kế lại hệ thống quản lý tài chính

Từ Google Sheet + Apps Script → web app (GitHub Pages) + APK Android, dữ liệu lưu trên cloud có đăng nhập (Supabase).

> Tài liệu này không chứa số liệu tài chính thật. Mọi con số trong đây là cấu trúc, công thức hoặc hằng số lấy từ file `QUAN_LY_TAI_CHINH_2026.xlsx` và code trong `src/`.

---

## 1. Hiện trạng: file đang làm 4 việc khác nhau cùng lúc

| Nhóm | Các tab | Bản chất | Trong app mới |
|---|---|---|---|
| Sổ cá nhân | `cá nhân` (3 thẻ), `bố`, `mẹ`, `học bổng miigaik` | Thu chi và số dư của chính bạn | Có |
| | `tiêu sài`, `lương sĩ quan` | Ghi lại khoản chi / khoản lương theo ngày | Có, vào tài khoản «Sổ chi tiêu» chỉ ghi lại theo ngày (không tính vào tổng tài sản) |
| | `vnd` | Sổ MBBank cũ | **Bỏ** |
| Vay nợ | `cho vay` (5 người) | Khoản phải thu theo từng người | Có |
| | 2 tab công nợ ăn chung | Tự đồng bộ sang một sheet riêng, đã chia sẻ cho những người liên quan | **Bỏ** (giữ nguyên ở sheet riêng) |
| Kinh doanh đổi tiền RUB↔VND qua USDT | `sang`, `về` | Máy tính báo giá cho khách | Có → mục **Báo tỉ giá** |
| | `usdt`, `VKA_2` | Sổ USDT, sổ tiền đang nằm ở các đối tác | **Bỏ** |
| Khác | `ktx_quan`, `tổng hợp` | Tiền KTX, bảng tổng | Có (KTX, Tổng quan) |
| | `password_incen` | Mật khẩu | **Không bao giờ nhập** |

Hai tab `sang` và `về` có sẵn hàng trăm dòng công thức nhưng chỉ vài dòng có giá chốt thật, nên thực chất là **máy tính báo giá** — bạn đã xác nhận đây là công cụ cần giữ, nên app có hẳn một mục riêng cho nó (mục 5).

## 2. Những vấn đề của logic hiện tại

Mỗi mục dưới đây đã được đối chiếu trực tiếp với file và code.

1. **Dữ liệu bố trí theo hình thức, không theo bản ghi.** `usdt` dùng khối 15 dòng/ngày, `VKA_2` dùng khối 4 dòng/ngày với 3.034 ô gộp. `autoaddrow.js` tồn tại chỉ để nhân bản các khối này. Hệ quả: thêm một ngày là một thao tác phức tạp, và chính hàm đó đang lỗi (mục 3).
2. **Hằng số chôn trong công thức.** Ví dụ: số dư đầu kỳ cộng thẳng vào `bố`!C2, `lương sĩ quan`!C2, `cá nhân`!D3, `vnd`!E2/J2, `VKA_2`!M3/X3. Tỷ giá `300` và `26000` nằm trong `tổng hợp`!O2. Các hằng số `23100000`, `1200000`, `5000` nằm trong `sang`/`về`. Không ai kiểm toán được con số đó từ đâu ra.
3. **Vùng tham chiếu cố định và không đối xứng.** `cho vay`!H3 là `SUM(F3:F202) − SUM(G3:G102)`: vùng "vay" dài 200 dòng, vùng "trả" chỉ 100 dòng. Từ dòng 103 trở đi, mọi khoản trả bị bỏ sót mà không báo lỗi. Tương tự các tab vay nợ riêng theo tên người, `tiêu sài`!E1 (đến dòng 289), `bố` (đến dòng 240).
4. **Đơn vị trộn lẫn trong cùng một cột.** Triệu VND, VND, nghìn VND (26,8 nghĩa là 26.800), RUB, USD nằm chung cột; đơn vị chỉ nằm ở tiêu đề hoặc ghi chú. Tab `cho vay` của một người còn chứa cả khoản USD và khoản VND.
5. **Liên thông ngầm giữa các tab.** `cá nhân`!D3 tự cộng tiền trả nợ lấy từ `cho vay`. `tổng hợp`!K3 gộp khoản cho vay, tiền gửi bố và thẻ MB vào ô "tiền mặt VND". Số dư một thẻ phụ thuộc vào ô ở tab khác mà không có dấu vết giao dịch.
6. **Tỷ giá cố định trong bảng tổng.** `tổng hợp`!O2 quy đổi RUB và USD ra VND bằng 300 và 26.000, và `P2 = O2 + tổng tiêu` khiến con số cuối khó diễn giải. Tỷ giá đổi thì tổng tài sản sai.
7. **Mẹo `FORMULATEXT` trong tab `vnd`.** Bạn nhập `=-3830-10210-16025` vào một ô, rồi một công thức dài tách chuỗi để cộng các số âm nhỏ hơn 500.000. Chạy được duy nhất trên Google Sheets (xuất ra Excel thành `__xludf.DUMMYFUNCTION`). Ý tưởng đúng (nhập nhiều khoản một lần) nhưng không truy vết được từng khoản.
8. **Không phân loại, không ngân sách, không lịch sử tỷ giá.** Tab `tiêu sài` là một cột số kèm ghi chú, hầu hết không có ngày. Không biết tiêu vào đâu, tháng nào, so với mục tiêu ra sao.
9. **Bảo mật.** Tab `password_incen` lưu mật khẩu trong bảng tính, và cùng một file chứa dữ liệu của người thân, người vay và các đối tác.

### Lỗi trong Apps Script (`src/`)

| # | Vị trí | Vấn đề | Cách xử lý trong thiết kế mới |
|---|---|---|---|
| 1 | `autoaddrow.js` | Bản đang chạy giả định `rowsPerNewDay` là số, nhưng 3/4 sheet đặt `null` → "Thêm ngày" lỗi | Không còn khái niệm "thêm ngày": mỗi giao dịch là một bản ghi |
| 2 | `autoaddrow.js` | Khoảng một nửa file là bản cũ đã comment | Bỏ; lịch sử nằm trong git |
| 3 | `button.js` | `Go today` chỉ quét `A1:A1000`, trong khi `usdt` dài hơn 4.000 dòng | Lọc theo ngày bằng truy vấn |
| 4 | `mirror.js` | Cấu hình `tbank_incen` nhưng file không có tab này | Không còn đồng bộ giữa các tab theo tên |
| 5 | `mirror.js` | Trạng thái đồng bộ giấu trong **ghi chú ô** (`setNote`) | Không cần đồng bộ giữa tab: một nguồn dữ liệu duy nhất |
| 6 | `mirror.js` | Chỉ đồng bộ khi sửa đúng 1 ô và là số nguyên; dán nhiều ô hoặc số thập phân bị bỏ qua | Ghi bản ghi qua form, kiểm tra hợp lệ trước khi lưu |
| 7 | `mirror.js` | `DETECT_CACHE` nằm trong biến toàn cục nên mất sau mỗi lần chạy `onEdit` | Không còn dò cột theo tiêu đề |

## 3. Nguyên tắc thiết kế mới

1. **Sổ cái.** Mọi thứ là giao dịch. Số dư = số dư đầu + tổng các giao dịch. Không bao giờ lưu số dư thành một ô nhập tay.
2. **Mỗi số tiền mang tiền tệ của nó.** Không có "triệu" hay "nghìn" trong dữ liệu; chỉ khi hiển thị mới rút gọn.
3. **Một sự kiện = một bản ghi.** Nhóm theo ngày là việc của truy vấn, không phải của bố cục.
4. **Tham số nghiệp vụ nằm trong Cài đặt** (tỷ giá quy đổi, cỡ lô 1.200.000 / 5.000, 23.100.000, thẻ nhận lãi). Đổi một nơi, dùng mọi chỗ.
5. **Khoản phải thu không phải tiền mặt.** Bảng Tổng quan tách riêng: tiền thật, khoản cho vay, khoản đang nợ.
6. **Nhập nhanh nhiều khoản một lần** (giữ ý tưởng hay của tab `vnd`): gõ `cafe 25k, ăn trưa 45k, grab 38k` → 3 giao dịch riêng, có ghi chú và phân loại.

## 4. Mô hình dữ liệu

Tất cả lưu trong một bảng `records(collection, data jsonb)` trên Supabase, với chính sách bảo mật theo dòng (RLS). Cách này cho phép đổi cấu trúc mà không cần migration, và tính toán số dư làm ở máy khách (dữ liệu cá nhân chỉ vài nghìn dòng).

| Collection | Trường chính |
|---|---|
| `accounts` | `name`, `kind` (tiền mặt, ngân hàng, thẻ, tiết kiệm, ví, crypto), `currency`, `opening`, `networth` (có tính vào tài sản không), `archived` |
| `parties` | `name`, `role` (người quen vay mượn / khách đổi tiền / người nhà), `note` |
| `categories` | `name`, `type` (thu/chi), `icon` |
| `txs` | `date`, `kind`, `amount`, `currency`, `accountId`, `toAccountId`, `toAmount`, `partyId`, `categoryId`, `note`, `accountAmount` (chỉ có ở khoản vay nợ khác tiền tệ với tài khoản), `dealId` (chỉ có ở khoản lãi tự cộng khi chốt giao dịch), `scholarshipId` (chỉ có ở khoản học bổng tự cộng khi đánh dấu đã nhận) |
| `deals` | Lệnh đổi tiền: `dir` (`sang`/`ve`), `status` (`quote` báo giá / `done` đã chốt), `date`, `partyId`, `inputs`, `actual`, `profit` (VND, chỉ khi đã chốt), `profitTxId` (giao dịch lãi đã cộng vào thẻ), `postSkipped` |
| `dorm` | `paidDate`, `amount`, `payer`, `period`, `receiptSent` |
| `scholarships` | Mục «Học bổng MIIGAiK»: `month`, `availableDate`, `receivedDate` (có = đã nhận), `amount` (₽), `currency` (`RUB`), `txId` (khoản thu đã cộng vào thẻ) |
| `budgets` | `categoryId`, `amount`, `currency` (ngân sách theo tháng) |
| `settings` | tiền tệ gốc, tỷ giá, tham số nghiệp vụ, tùy chọn giao diện |

**Các loại giao dịch (`txs.kind`) và ảnh hưởng lên số dư:**

| `kind` | Tài khoản | Công nợ với `partyId` |
|---|---|---|
| `income` | + `amount` | |
| `expense` | − `amount` | |
| `transfer` | − `amount` ở `accountId`, + `toAmount` (mặc định = `amount`) ở `toAccountId`; khác tiền tệ thì là đổi ngoại tệ | |
| `lend` (cho vay) | − `amount` (nếu có tài khoản) | người đó nợ mình **+** |
| `repay_in` (được trả) | + `amount` | nợ **−** |
| `borrow` (đi vay) | + `amount` | nợ **−** (mình nợ họ) |
| `repay_out` (trả nợ) | − `amount` | nợ **+** |
| `adjust` | ± `amount` (đối soát số dư) | |

### Vay nợ khác tiền tệ với tài khoản (ví dụ: đổi đô la ở Vietcombank rồi chuyển đồng cho người vay)

Khoản nợ và tài khoản **không bắt buộc cùng tiền tệ**. Trong form Vay nợ, sau khi chọn tài khoản, ô **Tiền tệ khoản nợ** mặc định bằng tiền tệ tài khoản (hành vi cũ); đổi sang tiền tệ khác thì app hiện thêm ô số tiền thật sự đi ra / đi vào tài khoản.

| Trường | Ý nghĩa |
|---|---|
| `amount`, `currency` | Khoản nợ: người đó nợ mình bao nhiêu, bằng tiền tệ nào (ví dụ 7.800.000 VND) |
| `accountAmount` | Số tiền đi ra (`lend`, `repay_out`) hoặc đi vào (`repay_in`, `borrow`) tài khoản, theo tiền tệ **của tài khoản** (ví dụ 300 USD). Không có trường này = cùng tiền tệ, số dư dùng `amount` như trước |

- Số dư tài khoản dùng `accountAmount`; công nợ của người đó dùng `amount` + `currency`. Một giao dịch duy nhất nên tài khoản và sổ nợ luôn khớp, không còn bước "chuyển sang tài khoản đồng rồi mới cho vay".
- App tính **tỷ giá ngầm** (ví dụ `1 USD = 26.000 VND`) từ hai số bạn nhập để đối chiếu với tỷ giá ngân hàng.
- Đổi tài khoản sang một tài khoản cùng tiền tệ với khoản nợ thì `accountAmount` tự bị bỏ.
- Tổng quan quy đổi riêng từng phần: tiền thật (USD giảm) và khoản phải thu (VND tăng), theo tỷ giá trong Cài đặt.
- Logic ở `calc.js` (`accAmount`, `accountEffects`), `money.js` (`impliedRate`); kiểm thử trong `tests/calc.test.js`, `tests/money.test.js`.

Công nợ tính riêng theo **từng người × từng tiền tệ**, nên một người vừa nợ USD vừa nợ VND không còn bị nhập chung cột.

## 5. Công thức đổi tiền (chuyển nguyên bản từ `sang` và `về`)

Mọi tỷ giá lưu theo đơn vị tự nhiên (ví dụ 26.000 VND/USDT, không phải 26,0).

**Chiều `sang`** (khách đưa VND, bên Nga nhận RUB). `D` = số VND khách đưa, `E` = lãi mong muốn.
- Giá báo (VND/RUB) = `(VND/USDT ÷ RUB/USDT) ÷ (1 − E ÷ cỡ lô sang)`; cỡ lô sang mặc định 1.200.000 VND (trong sheet: `1000*E/1200000`, `E` tính bằng nghìn VND)
- RUB phải trả = `D ÷ giá báo`
- Thực tế: USDT cần bán = `RUB trả ÷ giá bán RUB/USDT`; VND bỏ ra = `USDT × giá mua VND/USDT`; **lãi thực = D − VND bỏ ra**

**Chiều `về`** (khách đưa RUB, nhận VND).
- Giá báo (VND/RUB) = `VND/USDT ÷ RUB/USDT − E ÷ cỡ lô về`; cỡ lô về mặc định 5.000 RUB (trong sheet: `1000*E/5000`)
- VND phải trả khách = `giá báo × RUB nhận`
- Thực tế: VND thu về = `RUB nhận ÷ RUB/USDT thực × VND/USDT thực`; **lãi thực = VND thu về − VND trả khách**

Đây là cách mình hiểu ý nghĩa của `E` qua công thức (lãi mong muốn trên một lô chuẩn); phần cỡ lô là hằng số, nên đưa vào Cài đặt chứ không để chôn trong công thức. Mục 8 liệt kê các điểm cần bạn xác nhận.

### Báo giá → chốt giao dịch → cộng lãi vào thẻ MB

Nhiều khách chỉ hỏi giá rồi không giao dịch, nên **báo giá không bao giờ làm thay đổi số dư**. Mỗi lệnh có hai trạng thái:

| Trạng thái | Ý nghĩa | Ảnh hưởng số dư |
|---|---|---|
| `quote` — Báo giá | Đã tính giá cho khách, chưa chắc làm | Không |
| `done` — Đã chốt | Giao dịch thật sự xảy ra | Lãi được ghi **một khoản thu** vào thẻ nhận lãi (mặc định thẻ MB) **đúng ngày của lệnh** |

- Lãi ghi nhận = lãi thực tính từ giá thực tế (điền khi chốt); nếu chưa có giá thực tế thì lấy lãi theo giá báo (`sang`: VND × lãi ÷ cỡ lô; `về`: RUB × lãi ÷ cỡ lô). Bạn luôn sửa được số này. Lãi âm (lỗ) được ghi thành một khoản chi.
- Khoản lãi trong sổ gắn với lệnh qua `dealId`/`profitTxId`: **sửa** lệnh thì khoản lãi tự cập nhật, **hủy chốt** hoặc **xóa** lệnh thì khoản lãi tự biến mất, số dư luôn khớp. Khoản này không sửa tay ở màn hình Giao dịch (app dẫn bạn về lệnh gốc).
- **Thẻ nhận lãi** là tùy chọn của từng lệnh: hộp «Chốt giao dịch» có ô chọn **bất kỳ thẻ nào** (thẻ MB, thẻ rúp, thẻ của người khác…) và nút «＋ Thẻ mới» để tạo thẻ ngay tại đó. Thẻ được gợi ý sẵn theo thứ tự: thẻ đặt trong Cài đặt → thẻ bạn chọn ở lần chốt trước (nhớ trên máy này; chỉ khi Cài đặt để «Nhớ thẻ lần chốt trước») → thẻ VND có tên chứa "MB" → thẻ VND đầu tiên → thẻ bất kỳ. Có thể bỏ tick "Cộng lãi vào thẻ" cho từng lệnh.
- **Lãi theo đơn vị và tỉ giá áng chừng.** Lãi của lệnh (`deal.profit`) luôn lưu bằng **VND** để thống kê, nhưng khi chốt bạn chọn được đơn vị nhập lãi (₫ hoặc ₽/ngoại tệ của thẻ) và, khi cần quy đổi, điền **tỉ giá áng chừng** (₫ cho 1 đơn vị ngoại tệ):
  - Thẻ VND + nhập bằng ₫: không cần tỉ giá (như trước).
  - Thẻ rúp (hoặc ngoại tệ khác) + nhập bằng ₫: số vào thẻ = lãi ₫ ÷ tỉ giá, làm tròn 2 số lẻ.
  - Nhập thẳng bằng ₽: lãi VND = số ₽ × tỉ giá (để thống kê); số vào thẻ rúp đúng bằng số ₽ đã nhập. Nhập bằng ₽ rồi nhận vào thẻ VND thì số vào thẻ = lãi VND quy đổi.
  - Tỉ giá gợi ý sẵn: rúp → **giá báo của chính lệnh** (₫/₽), không có thì tỉ giá trong Cài đặt; ngoại tệ khác → tỉ giá trong Cài đặt. Sửa tay thì app giữ số bạn nhập. Đơn vị và tỉ giá đã dùng được lưu vào lệnh (`profitUnit`, `profitRate`), và tỉ giá ghi vào ghi chú khoản lãi để truy lại. Lỗ (âm) thành khoản chi bằng tiền của thẻ.
  - Hàm thuần `convertProfit` (deals.js) làm phép quy đổi; `saveDeal` nhận thêm `cardAmount` (số tiền theo tiền của thẻ) và tự quy đổi từ `profit` + `profitRate` nếu thiếu.
  - Cộng bù hàng loạt (lệnh cũ nhập từ sheet) chỉ dùng thẻ VND, vì lãi các lệnh cũ chỉ có số ₫ (muốn vào thẻ rúp thì mở từng lệnh và chốt lại).
- Các lệnh cũ nhập từ sheet được đánh dấu **đã chốt nhưng chưa cộng vào thẻ** (số dư MB trong sheet cũ chưa từng có các khoản này). App hiện một thông báo để bạn chọn **cộng bù** (mỗi lệnh một khoản thu đúng ngày) hoặc **bỏ qua**.

### Học bổng MIIGAiK → cộng vào thẻ ₽

Mỗi tháng một dòng, mặc định **15.000 ₽** (đổi được trong Cài đặt). Cũng như báo giá, **chưa nhận thì không đụng số dư**:

| Trạng thái | Ảnh hưởng số dư |
|---|---|
| Chưa tick «Đã nhận» | Không |
| Đã nhận + chọn thẻ (Gazprom hoặc PSPB… — mọi thẻ ₽ trừ sổ tiết kiệm) | Ghi **một khoản thu ₽** vào thẻ đó, đúng **ngày thực nhận**; số dư thẻ tăng đúng số tiền |
| Đã nhận + «Không cộng vào thẻ nào» | Không (dành cho tháng cũ mà số dư thẻ đã tính sẵn) |

- Khoản thu gắn với tháng qua `scholarshipId`/`txId`: **đổi** số tiền, ngày hoặc thẻ thì khoản tự cập nhật; **bỏ tick «Đã nhận»** hoặc **xóa tháng** thì khoản tự biến mất. Khoản này không sửa tay ở màn hình Giao dịch (app dẫn về tháng gốc) — nên đừng thêm lại học bổng ở mục Giao dịch, sẽ bị tính hai lần.
- Thẻ chọn sẵn là thẻ bạn chọn lần trước; lần đầu là thẻ có tên chứa "Gazprom", rồi "PSPB". Cài đặt có ô chọn thẻ mặc định.
- 14 tháng nhập từ sheet cũ giữ nguyên, **không** có khoản cộng nào (số dư thẻ trong sheet cũ đã khớp). Khi mở một tháng cũ chưa nhận mà tick «Đã nhận», thẻ được chọn sẵn như tháng mới.

### Nhập nhanh ↔ Vay nợ (mình là thủ quỹ mua đồ ăn cho nhiều người)

Mỗi **khoản chi** trong «Nhập nhanh» có thanh **Chia cho người trong Vay nợ**: `Không chia` (như cũ) · `Cộng nợ` · `Trừ nợ`. (**Khoản thu** không có thanh này, xem «Khoản thu và gửi bố» ngay dưới.) Chọn người bằng ô tick (danh sách đúng như màn hình Vay nợ), hoặc «＋ Thêm người» ngay trong hộp thoại.

| Chế độ | Ý nghĩa | Ghi vào sổ |
|---|---|---|
| **Cộng nợ** | Mình trả hộ cả khoản | Tài khoản **trừ đủ** số tiền. Mỗi người được chọn một giao dịch **Cho vay** (`lend`, họ nợ mình thêm phần của họ). Nếu tick «Tính cả phần của mình» (mặc định) thì phần của mình là một khoản **chi** bình thường, có danh mục |
| **Trừ nợ** | Họ đưa tiền cho mình | Tài khoản **cộng** số tiền. Mỗi người một giao dịch **Thu nợ** (`repay_in`, nợ giảm). Không tạo khoản thu nhập nào |

- Mặc định **chia đều** (mình + những người được chọn). Sửa tay phần của một người thì người còn lại (và mình) chia đều số dư. Tổng các phần **luôn khớp đúng số tiền**: tính theo đơn vị nhỏ nhất (VND 1 đồng, ₽ 0,01), số lẻ do **người trả gánh** nên không ai bị tính dư.
- Mỗi người hiện «đang nợ mình / mình đang nợ / hiện chưa nợ» (theo tiền tệ của khoản) và dòng tóm tắt tác động lên tài khoản trước khi lưu. Phần chia sai (không chọn ai, vượt tổng, thiếu) hiện màu đỏ và **không được lưu**.
- Nhớ người và lựa chọn «Tính cả phần của mình» của lần trước; nút «Dùng cho tất cả khoản» áp cùng cách chia cho mọi khoản đang nhập. Mỗi giao dịch tạo ra là giao dịch thường (không liên kết với nhau), sửa/xóa riêng ở Giao dịch hoặc trong trang của người đó ở Vay nợ.
- Logic chia nằm ở `web/js/share.js` (hàm thuần, kiểm thử trong `tests/share.test.js`).

### Khoản thu và «Gửi cho bố»; mục Thu nhập

- Khoản thu trong «Nhập nhanh» (gõ `+lương 11tr`, hoặc mở bằng **Thêm → Khoản thu** / nút «＋ Thêm khoản thu» ở mục Thu nhập, khi đó không cần dấu `+`) có thanh **Sau khi nhận**: `Giữ lại` · `Gửi cho bố`. Chọn «Gửi cho bố» thì nhập số tiền gửi (để trống = gửi cả khoản; không được vượt khoản thu).
- Khoản gửi ghi thành **một khoản chi riêng** (`expense`, danh mục «Biếu gia đình», ghi chú «Gửi bố · lương») trừ vào **cùng tài khoản** đã nhận khoản thu. Nhờ vậy số dư thẻ luôn đúng, và tiền gửi bố thấy được trong thống kê chi. Khoản thu vẫn nguyên số tiền để mục Thu nhập phản ánh đúng thu nhập kiếm được. Không tạo công nợ với bố.
- App nhớ lựa chọn lần trước **theo danh mục** (lương thường gửi, học bổng thì không) trên máy này; mỗi lần vẫn thấy rõ đang chọn gì và đổi được.
- Khoản thu không đoán ra nguồn được xếp vào «Thu khác».
- Mục **Thu nhập** (thanh bên; trên điện thoại ở «Khác», và liên kết ở thẻ tháng trong Tổng quan) liệt kê mọi giao dịch `income` của **mọi tài khoản** (kể cả «Sổ chi tiêu» lưu lương cũ), theo tháng hoặc toàn bộ thời gian, lọc theo tài khoản / nguồn thu, kèm tổng quy VND, tổng theo nguồn và theo từng tiền tệ gốc. Nhận trả nợ, đi vay, chuyển khoản không phải thu nhập nên không có ở đây. Logic tính ở `incomeStats` trong `web/js/calc.js`.
- Tên tài khoản lưu lịch sử chi tiêu / lương cũ nay là «Sổ chi tiêu» (công cụ nhập đặt tên này cho lần nhập sau). Dữ liệu đã nhập từ trước thì đổi tên ngay trong app: **Tài khoản → mở tài khoản → Tên**.

## 6. Ánh xạ từ sheet cũ

| Sheet cũ | Thành | Ghi chú |
|---|---|---|
| `cá nhân` (3 thẻ) | `accounts` + `txs` income/expense | Số dư đầu = hằng số trong công thức cũ |
| `tiêu sài` | `txs` expense | Chỉ ghi lại theo ngày; tách từng khoản trong `=-3830-10210-…` thành giao dịch riêng |
| `lương sĩ quan`, `học bổng miigaik`, `mẹ`, `bố` | `txs` income (hoặc tài khoản tiết kiệm "gửi bố") + `scholarships` | |
| `cho vay` và các tab vay nợ theo tên người | `parties` + `txs` lend/repay | Khoản không gắn tài khoản nguồn → không đụng số dư tài khoản |
| `sang`, `về` | `deals` (đã chốt) + mục Báo tỉ giá | Chỉ nhập dòng có giá chốt thực tế |
| `usdt`, `VKA_2`, `vnd` | **không nhập** | Đã quyết định bỏ khỏi app |
| 2 tab công nợ ăn chung | **không nhập** | Đã có sheet riêng chia sẻ |
| `ktx_quan` | `dorm` | |
| `tổng hợp` | màn hình Tổng quan (tính tự động) | Dùng tỷ giá trong Cài đặt |
| `password_incen` | **không nhập** | Dùng trình quản lý mật khẩu |

Công cụ nhập (`tools/import_xlsx.mjs`, Node.js) chạy trên máy bạn, tạo file JSON riêng tư (đã loại khỏi git) và in báo cáo đối chiếu: số dư tính lại có khớp số trong sheet cũ không.

## 7. Kiến trúc

```
Trình duyệt / APK (cùng một mã nguồn trong web/)
   │  HTML + JS thuần, không cần build; cài được như PWA
   │
   ├── đăng nhập email + mật khẩu ──► Supabase Auth (tắt đăng ký công khai)
   └── đọc/ghi records ────────────► Supabase Postgres + RLS (user_id = auth.uid())

GitHub Pages ── chỉ phục vụ mã nguồn tĩnh (web/), tuyệt đối không có dữ liệu
GitHub Actions ── dựng APK debug bằng Capacitor, xuất file tải về
```

- **Ngoại tuyến:** sau lần tải đầu, app lưu bản sao để mở được khi mất mạng (chỉ xem). Ghi dữ liệu yêu cầu có mạng.
- **Hai thiết bị cùng sửa:** bản ghi nào sửa sau thì thắng (đủ dùng cho một người).
- **Chế độ thử:** nếu chưa cấu hình Supabase, app chạy bằng dữ liệu trên máy để bạn thử ngay.

### Logo và icon

Logo **QLTC** vẽ bằng SVG (không dùng phông chữ): **Q** và **C** là hai vòng chồng lên nhau (Q nằm trên, C tím nhạt nằm dưới), **L** và **T** dùng chung một thanh ngang (chân chữ L chính là thanh ngang chữ T), đuôi chữ Q vắt qua góc chữ L với một khe hở nhỏ để thấy chỗ lồng nhau. Nền chàm, Q trắng, L·T hồng san hô.

- Nguồn duy nhất: `tools/make_logo.py` (màu, độ dày nét, độ dài đuôi Q nằm ở đầu file). Chạy lại sẽ ghi `web/icons/icon.svg` và các PNG: `icon-192/512`, `icon-maskable-512`, `apple-touch-icon` (web/PWA) và `assets/icon-only|foreground|background.png` (Android).
- Icon Android do workflow tự dựng bằng `capacitor-assets` từ ba PNG trong `assets/`; lớp foreground thu nhỏ để nằm trong vùng an toàn nên không bị cắt ở launcher dạng tròn.
- Trong app, logo là ảnh `icons/icon.svg` ở thanh bên và màn hình đăng nhập (thay cho biểu tượng 💸 cũ). `tests/assets.test.js` kiểm tra mọi icon mà manifest, `index.html` và `sw.js` nhắc tới đều có thật.

## 8. Cần bạn xác nhận (mình đã giả định và đánh dấu trong app)

1. Số `23.100.000` trong `sang`/`về`: là mức đơn hàng chuẩn dùng để so sánh giá. Mình giữ làm tham số "VND tham chiếu".
2. Tab `sang` / `về` có nhiều dòng chỉ có báo giá, chưa có giá chốt thực tế. Công cụ nhập **chỉ lấy lệnh đã chốt**; các dòng báo giá cũ bị bỏ qua (số dòng ghi trong báo cáo nhập). Từ nay báo giá mới lưu được trong app ở trạng thái "Chờ chốt".
3. Các lệnh cũ chưa cộng lãi vào thẻ MB: chọn **cộng bù** hay **bỏ qua** (xem mục 5).
4. Một lệnh `về` cũ có lãi bất thường (hàng chục triệu ₫, do giá thực tế chênh xa giá báo); báo cáo nhập có nêu dòng đó để bạn xem lại có gõ nhầm giá không.
5. Các dòng `tiêu sài` không ghi ngày (đầu danh sách) được gán tạm một ngày cố định và ghi chú "(chưa rõ ngày)"; bạn sửa ngày trong app nếu nhớ.
6. Tài khoản "Sổ chi tiêu" (trước đây tên "Sổ chi tiêu & lương (chỉ ghi lại)") giữ lịch sử tiêu sài, lương… theo ngày, **không tính vào tổng tài sản**.
7. Tổng tài sản trong app thấp hơn `tổng hợp`!O2 đúng bằng phần công nợ của hai sổ ăn chung không nhập (báo cáo nhập có dòng đối chiếu đã trừ phần này).

## 9. Việc ngoài phạm vi (làm sau nếu bạn muốn)

- Ghi dữ liệu khi mất mạng rồi tự đồng bộ.
- Tỷ giá tự động lấy từ Internet (hiện nhập tay, vì bạn dùng giá thực tế của mình, không phải giá sàn).
- Khóa app bằng vân tay hoặc PIN.

## 10. Cài đặt

Xem [`HUONG_DAN_CAI_DAT.md`](HUONG_DAN_CAI_DAT.md): Supabase, GitHub Pages, nhập dữ liệu từ Excel, dựng APK.
