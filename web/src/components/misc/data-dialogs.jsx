import { useState } from 'react';
import { COLLECTIONS } from '@logic/model.js';
import { store } from '@/lib/store-hooks.js';
import { errMsg, fmtNum, pickFile } from '@/lib/format.js';
import { openDialog, confirmBox, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Modal } from '@/components/ui/modal.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';

const LABELS = {
  accounts: 'Tài khoản', parties: 'Người/đối tượng', categories: 'Danh mục', txs: 'Giao dịch', deals: 'Lệnh đổi tiền',
  dorm: 'KTX', scholarships: 'Học bổng MIIGAiK', budgets: 'Ngân sách', settings: 'Cài đặt',
};

function ImportForm({ obj, name, counts }) {
  const { close } = useDialog();
  const [mode, setMode] = useState('merge');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const replace = mode === 'replace';
    if (replace && !(await confirmBox('Xóa toàn bộ dữ liệu hiện có rồi nhập từ file?', { okLabel: 'Thay toàn bộ', danger: true }))) return;
    setBusy(true);
    try {
      const n = await store.importAll(obj, { replace });
      close();
      toast(`Đã nhập ${fmtNum(n)} bản ghi.`, 'ok');
    } catch (e) {
      setBusy(false);
      toast(errMsg(e), 'error');
    }
  };

  return (
    <Modal
      title="Nhập dữ liệu"
      footer={(
        <>
          <Button variant="ghost" onClick={close}>Hủy</Button>
          <Button onClick={run} disabled={busy}>{busy ? 'Đang nhập…' : 'Nhập'}</Button>
        </>
      )}
    >
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">{`File: ${name}`}</p>
        <div className="flex flex-wrap gap-1.5">{counts.map(([c, n]) => <Badge key={c}>{`${LABELS[c] || c}: ${fmtNum(n)}`}</Badge>)}</div>
        <Field label="Cách nhập" hint="Gộp: bản ghi cùng mã sẽ được ghi đè, còn lại giữ nguyên. Thay toàn bộ: xóa dữ liệu hiện có rồi nhập (nên xuất sao lưu trước).">
          <Segmented options={[{ value: 'merge', label: 'Gộp thêm' }, { value: 'replace', label: 'Thay toàn bộ' }]} value={mode} onChange={setMode} />
        </Field>
      </div>
    </Modal>
  );
}

/** Chọn file JSON rồi mở hộp thoại nhập. */
export async function openImport() {
  const f = await pickFile('.json,application/json');
  if (!f) return;
  let obj;
  try { obj = JSON.parse(f.text); } catch { toast('File không phải JSON hợp lệ.', 'error'); return; }
  const src = obj && obj.data ? obj.data : obj;
  const counts = COLLECTIONS.map((c) => [c, Array.isArray(src && src[c]) ? src[c].length : 0]).filter(([, n]) => n);
  if (!counts.length) { toast('Không tìm thấy dữ liệu nào trong file.', 'error'); return; }
  openDialog(() => <ImportForm obj={obj} name={f.name} counts={counts} />);
}

function WipeForm() {
  const { close } = useDialog();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = text.trim().toUpperCase() === 'XÓA';

  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await store.importAll({ data: {} }, { replace: true });
      close();
      toast('Đã xóa toàn bộ dữ liệu.', 'ok');
    } catch (e) { setBusy(false); toast(errMsg(e), 'error'); }
  };

  return (
    <Modal
      title="Xóa toàn bộ dữ liệu"
      onSubmit={go}
      footer={(
        <>
          <Button variant="ghost" onClick={close}>Hủy</Button>
          <Button type="submit" variant="destructive" disabled={!ok || busy}>Xóa vĩnh viễn</Button>
        </>
      )}
    >
      <div className="grid gap-3">
        <p className="text-[15px]">{store.mode === 'cloud' ? 'Toàn bộ sổ của tài khoản này trên đám mây sẽ bị xóa và không khôi phục được.' : 'Toàn bộ dữ liệu trong trình duyệt này sẽ bị xóa.'}</p>
        <p className="text-sm text-muted-foreground">Hãy xuất sao lưu trước nếu chưa có.</p>
        <Field><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Gõ XÓA để xác nhận" autoComplete="off" aria-label="Gõ XÓA để xác nhận" /></Field>
      </div>
    </Modal>
  );
}

export const openWipe = () => openDialog(() => <WipeForm />);
