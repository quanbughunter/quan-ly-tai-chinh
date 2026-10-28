# Bằng chứng mốc 1

| Tệp | Là gì |
|---|---|
| `truoc-sau-freetext.png` | Cùng một hộp chữ, Poppler render. Trên: tệp do EmbedPDF 2.15.1 tự lưu, dấu bị mất (G1). Dưới: tệp sau bước xuất của ezPDF |
| `mau-da-xuat-tu-trinh-duyet.pdf` | Tệp xuất thật từ luồng e2e trong Chromium: highlight, hộp chữ tiếng Việt ở trang 1 (đã mở lại và di chuyển), hộp chữ trên trang `/Rotate 90`. **Mở bằng Acrobat, Edge, Foxit hay viewer bất kỳ để tự kiểm** |
| `mau-ma-hoa-aes256.pdf` | Kết quả engine-proof trên tệp có mật khẩu chủ sở hữu AES-256. Mã hóa vẫn còn, chữ Việt hiển thị đúng |
| `poppler-trang1.png`, `mupdf-trang2-xoay90.png` | Render độc lập của tệp engine-proof |
| `pdfjs-trang1.png`, `pdfjs-trang2-xoay90.png` | pdf.js (engine của Firefox) render `mau-da-xuat-tu-trinh-duyet.pdf` |
| `app-mo-lai-file-da-xuat.png` | ezPDF mở lại tệp đã xuất; annotation hiện từ appearance có phông nhúng |
| `app-xoay-hien-thi.png` | ezPDF khi xoay hiển thị 90°, hộp chữ đi theo trang |
| `e2e-results.json` | 32 điểm kiểm và chi tiết từng điểm |
