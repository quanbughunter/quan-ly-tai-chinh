import { useEffect } from 'react';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useDialog } from '@/lib/dialogs.jsx';

export function ConfirmContent({ message, okLabel, danger, title, onDone, onDismiss }) {
  const { open } = useDialog();
  // Đóng bằng Esc / bấm nền / nút Back = không đồng ý.
  useEffect(() => { if (!open) onDismiss(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={() => onDone(false)}>Hủy</Button>
          <Button variant={danger ? 'destructive' : 'default'} onClick={() => onDone(true)} autoFocus>{okLabel}</Button>
        </>
      )}
    >
      <p className="text-[15px] leading-relaxed whitespace-pre-line">{message}</p>
    </Modal>
  );
}
