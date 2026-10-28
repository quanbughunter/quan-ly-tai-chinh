# ezPDF

Ứng dụng đọc và chỉnh PDF chạy trên trình duyệt, desktop và Android. Mọi xử lý diễn ra trên thiết bị: tài liệu không bao giờ bị tải lên đâu cả.

**Trạng thái: Mốc 1, chứng minh engine.** Đã làm được: mở PDF, thêm chữ tiếng Việt, highlight, undo/redo, zoom, xoay hiển thị, xuất PDF mới, mở lại để sửa tiếp. Xem `docs/`.

## Chạy

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # bản production trong dist/
```

## Kiểm thử

```bash
npm run test:engine  # headless: 3 tệp (thường, AES-256, RC4) × 4 kiểu trang × chữ Việt + highlight + chữ ký → xuất → đọc lại
npm run verify       # kiểm các tệp xuất của test:engine bằng qpdf, Poppler, MuPDF
npm run e2e          # Chromium thật: 32 điểm kiểm, gồm cả pdf.js và việc không có request ra ngoài
```

Script kiểm thử cần: Node 22+, Python 3 với `pymupdf` và `pikepdf`, `qpdf`, `poppler-utils`, Playwright với Chromium.

## Cấu trúc

```
src/
  app/                 UI (React): App (engine + plugin), Workspace (mở/xuất/trạng thái),
                       Toolbar, Viewer (trang ảo hoá, các lớp render/chọn chữ/annotation)
  engine/
    config.ts          WASM và phông tự host, không dùng CDN
    vn-freetext-export.ts  bước xuất: vẽ lại appearance FreeText bằng phông tiếng Việt nhúng
    appearance-pdf.ts      dựng trang PDF nguồn chứa bản vẽ + phông CID nhúng
    pdf-incremental.ts     đọc xref + incremental update (bổ sung /Fields của AcroForm)
    font-metrics.ts        metric TrueType + ngắt dòng
    export.worker.ts       PDFium thứ hai trong Web Worker, chỉ dùng khi xuất
public/fonts/          ezPDF Sans VN (subset Noto Sans, SIL OFL 1.1, đã đổi tên)
tests/                 engine-proof.ts, fixtures, trang pdf.js để kiểm độc lập
scripts/               e2e.cjs, verify_export.py, inspect_export.py, make_fixture.py
docs/                  đánh giá engine, kết quả mốc 1, kế hoạch các mốc, bằng chứng
```

## Nguyên tắc kiến trúc

- **Một nguồn trạng thái:** annotation state và history của EmbedPDF. UI chỉ đọc state và gọi lệnh, không giữ bản sao riêng.
- **Hệ tọa độ trang PDF:** annotation lưu theo point, gốc trên-trái của trang chưa xoay (`normalizeRotation: true`). Zoom và xoay chỉ là phép biến đổi khi hiển thị.
- **Tệp gốc giữ nguyên:** “Xuất PDF” luôn tạo tệp mới `… (ezPDF).pdf`. Lưu nháp là chuyện khác, thuộc mốc 3.
- **Không làm giả:** nút nào chưa chạy được đến cuối luồng thì không xuất hiện.
- `@embedpdf/*` được **ghim đúng 2.15.1**. Trước khi nâng cấp, xem `docs/01-danh-gia-engine.md` mục 4.
