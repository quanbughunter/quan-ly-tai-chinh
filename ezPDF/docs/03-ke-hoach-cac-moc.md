# 03 · Kế hoạch theo mốc

Mỗi mốc chỉ coi là xong khi bộ kiểm của mốc đó chạy xanh. Bộ kiểm luôn gồm e2e trong trình duyệt và kiểm tệp xuất bằng ít nhất một viewer không dùng PDFium. Nút nào chưa chạy thì không đưa vào bản nghiệm thu.

| Mốc | Nội dung | Nghiệm thu |
|---|---|---|
| **M1 · Chứng minh engine** ✅ | Mở, chữ tiếng Việt, highlight, xuất, mở lại; bộ xuất có phông nhúng; e2e + kiểm độc lập | 32/32 e2e; Poppler, MuPDF, pdf.js đọc đúng |
| **M2 · Khung giao diện đầy đủ** | Toolbar trên, thumbnail trái, trang giữa, panel thuộc tính phải theo đối tượng đang chọn (shadcn/ui + lucide); một màu nhấn; trạng thái công cụ, loading, empty, error, chưa xuất. Hộp chữ tự giãn và vẽ bằng chính bộ ngắt dòng của bước xuất (bỏ giới hạn 1–2). Tìm kiếm có panel kết quả. Ghi chú dán. Phím tắt. Xóa đối tượng | e2e mở rộng: chữ trên màn hình = chữ trong tệp ở mọi zoom; thumbnail và tìm kiếm trên tài liệu 300 trang; không có nút chết |
| **M3 · Ảnh, chữ ký, xoay trang, nháp** | Thêm ảnh (PNG/JPG), vẽ hoặc nhập ảnh chữ ký, xóa nền trắng của ảnh chữ ký (xử lý trên máy); xoay trang lưu vào tệp (`FPDFPage_SetRotation` ở bước xuất); lưu nháp tự động bằng IndexedDB (tệp gốc + trạng thái), tách hẳn khỏi “Xuất PDF” | Ảnh trong suốt hiển thị đúng ở 3 viewer; mở lại nháp sau khi tải lại trang; xoay trang khớp ở 3 viewer |
| **M4 · Đóng gói 3 nền tảng** | PWA (cài được, chạy offline); desktop bằng Tauri 2 (hộp thoại mở/lưu gốc, mở tệp bằng chuột phải); Android bằng Capacitor 8 (Storage Access Framework, chia sẻ tệp vào app). Lớp lưu trữ gồm 3 adapter, dùng chung một interface | Cùng bộ e2e chạy trên bản web; smoke test trên Windows và một máy Android thật; tệp 50 MB mở được trên Android tầm trung |
| **M5 · Đánh giá riêng: redaction, sửa chữ có sẵn, OCR** | Redaction: thử `redactTextInRects`/`applyRedaction`, kiểm rằng chữ, ảnh và vector dưới vùng che **bị xóa thật** (pdftotext, trích ảnh, so pixel). Sửa chữ có sẵn: PDFium 2.x không hỗ trợ, cần đánh giá EmbedPDF 3.x hoặc engine khác. OCR: tesseract.js (WASM, có gói `vie`) chạy trên máy, thêm lớp chữ ẩn | Báo cáo riêng trước khi đưa vào app. Không phủ nền rồi thêm chữ để gọi là “sửa”. Tính năng nào không vượt bài kiểm thì không phát hành |
| **M6 · Hiệu năng và ổn định** | Tránh chép từng byte khi save; xuất chạy cùng worker (custom runner) để khỏi phải parse lần hai; gom phông dùng chung; phông subset theo đúng glyph đã dùng; giới hạn bộ nhớ trên Android | Tệp 200 MB xuất được trên desktop; Android không bị đóng vì hết bộ nhớ với tệp 50 MB |

Phụ thuộc: M2 → M3 → M4. M5 và M6 có thể chạy song song sau M2.
