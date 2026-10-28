// Cấu hình kết nối Supabase (đám mây có đăng nhập).
//
//  - Để TRỐNG hai dòng dưới = "chế độ thử": dữ liệu chỉ lưu trong trình duyệt, không đồng bộ.
//  - Điền Project URL và khóa "anon public" (Supabase → Project Settings → API).
//  - Khóa anon ĐƯỢC PHÉP công khai: dữ liệu vẫn được bảo vệ bởi đăng nhập + chính sách RLS trong supabase/schema.sql.
//  - TUYỆT ĐỐI KHÔNG dán khóa "service_role" vào file này.
window.APP_CONFIG = {
  supabaseUrl: 'https://oykjorjblruqklfzqdfj.supabase.co',
  supabaseAnonKey: 'sb_publishable_MNS9oUoc-8Ohh3h711zwSQ_-wnWn6GX',
};
