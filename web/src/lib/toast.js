import { toast as sonner } from 'sonner';

/** toast('Đã lưu', 'ok') — kind: 'ok' | 'error' | 'info' (giữ nguyên cách gọi của bản cũ). */
export function toast(msg, kind = 'info') {
  if (kind === 'error') return sonner.error(msg, { duration: 6000 });
  if (kind === 'ok') return sonner.success(msg, { duration: 2600 });
  return sonner(msg, { duration: 3000 });
}
