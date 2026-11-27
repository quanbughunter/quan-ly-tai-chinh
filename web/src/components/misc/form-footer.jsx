import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

/** Chân hộp thoại chuẩn: [Xóa] ……… [Hủy] [Lưu]. Nút Lưu là type=submit (Modal có onSubmit). */
export function FormFooter({ onDelete, onCancel, saveLabel = 'Lưu', saving = false, deleteLabel = 'Xóa' }) {
  return (
    <>
      {onDelete ? (
        <Button variant="ghost" className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
          <Trash2 />{deleteLabel}
        </Button>
      ) : null}
      <Button variant="ghost" onClick={onCancel}>Hủy</Button>
      <Button type="submit" disabled={saving}>{saveLabel}</Button>
    </>
  );
}
