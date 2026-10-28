# setup/

Các file ở đây cần chép sang chỗ khác một lần, vì công cụ chạy từ xa không được phép ghi thẳng vào `.github/`.

Chạy trong thư mục dự án:

```powershell
npm run setup:workflows
```

Lệnh này chép `setup/github-workflows/*.yml` vào `.github/workflows/` (GitHub chỉ đọc workflow ở đó). Sau đó commit và push như bình thường. Muốn sửa workflow về sau: sửa ở `.github/workflows/` rồi commit; thư mục `setup/` chỉ là bản gốc để chép lần đầu.
