-- ════════════════════════════════════════════════════════════════════════════
-- Quản lý tài chính — lược đồ Supabase
-- Chạy MỘT LẦN: Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần cũng an toàn (các lệnh đều idempotent).
-- ════════════════════════════════════════════════════════════════════════════
--
-- Mô hình: một bảng "records" chứa mọi loại dữ liệu (tài khoản, giao dịch, công nợ…)
-- dưới dạng JSON, phân biệt bằng cột "collection". App tải hết về trình duyệt rồi tính toán,
-- nên không cần nhiều bảng/khóa ngoại; đổi sang bảng riêng sau này vẫn được.
--
-- Bảo mật: Row Level Security (RLS) bắt buộc. Mỗi dòng gắn user_id = người tạo,
-- và người dùng CHỈ thấy/sửa/xóa được dòng của chính mình. Khóa "anon" công khai trong
-- config.js không đọc được gì nếu chưa đăng nhập.

create table if not exists public.records (
  id          uuid        primary key,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection  text        not null check (length(collection) between 1 and 40),
  data        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists records_user_collection_idx on public.records (user_id, collection);

-- Tự cập nhật updated_at mỗi lần sửa
create or replace function public.records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.user_id := old.user_id; -- không cho đổi chủ sở hữu của một dòng
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before update on public.records
  for each row execute function public.records_touch();

-- Row Level Security
alter table public.records enable row level security;

drop policy if exists records_owner_select on public.records;
drop policy if exists records_owner_insert on public.records;
drop policy if exists records_owner_update on public.records;
drop policy if exists records_owner_delete on public.records;

create policy records_owner_select on public.records
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy records_owner_insert on public.records
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy records_owner_update on public.records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy records_owner_delete on public.records
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Người chưa đăng nhập (anon) không có quyền gì với bảng này
revoke all on public.records from anon;
revoke all on public.records from public;
grant select, insert, update, delete on public.records to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Kiểm tra nhanh sau khi chạy (tùy chọn):
--   select tablename, rowsecurity from pg_tables where tablename = 'records';   -- rowsecurity phải là true
--   select policyname, cmd from pg_policies where tablename = 'records';        -- 4 chính sách
-- ════════════════════════════════════════════════════════════════════════════
