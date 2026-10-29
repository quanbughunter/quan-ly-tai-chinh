import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { store } from '@/lib/store-hooks.js';
import { PARTY_ROLES } from '@logic/model.js';
import { openDialog, useDialog, confirmBox } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg, money } from '@/lib/format.js';
import { partyUsage, deleteParty } from '@logic/partydel.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';

/** Nội dung hộp xác nhận khi người đã có giao dịch: nói rõ sẽ mất gì và số dư thẻ đổi thế nào. */
function deleteWarning(p, u) {
  const owes = Object.entries(u.balance).map(([cur, v]) => (v > 0
    ? `${p.name} đang nợ mình ${money(v, cur)}`
    : `mình đang nợ ${p.name} ${money(-v, cur)}`));
  const lines = [
    `“${p.name}” đã có ${u.txs.length} giao dịch${u.deals.length ? ` và ${u.deals.length} lệnh đổi tiền` : ''}.`,
    owes.length ? `Vay nợ hiện tại: ${owes.join('; ')}.` : 'Vay nợ hiện tại: đã tất toán.',
    '',
  ];
  if (u.txs.length) lines.push(`Xóa người này sẽ xóa luôn ${u.txs.length} giao dịch đó. Số dư các thẻ liên quan được tính lại như thể các khoản này chưa từng có.`);
  if (u.deals.length) lines.push('Lệnh đổi tiền được giữ nguyên, chỉ bỏ tên người.');
  lines.push('Không hoàn tác được. Nên xuất sao lưu trong Cài đặt trước nếu chưa chắc.');
  return lines.join('\n');
}

function PartyForm({ party: p, opts }) {
  const { close } = useDialog();
  const [st, setSt] = useState(() => ({ name: p ? p.name : '', role: p ? p.role || 'person' : opts.role || 'person', note: p ? p.note || '' : '' }));
  const patch = (x) => setSt((s) => ({ ...s, ...x }));

  async function onSave() {
    if (!st.name.trim()) return toast('Nhập tên.', 'error');
    try {
      const d = await store.put('parties', { ...(p || {}), name: st.name.trim(), role: st.role, note: st.note.trim() });
      close();
      toast('Đã lưu.', 'ok');
      if (opts.onSaved) opts.onSaved(d);
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  async function onDelete() {
    const u = partyUsage(p.id, { txs: store.all('txs'), deals: store.all('deals') });
    const ok = u.used
      ? await confirmBox(deleteWarning(p, u), { okLabel: 'Xóa cả giao dịch', danger: true, title: 'Xóa người và giao dịch?' })
      : await confirmBox(`Xóa “${p.name}”?`, { okLabel: 'Xóa', danger: true });
    if (!ok) return;
    try {
      await deleteParty(store, p.id);
      close();
      toast(u.txs.length ? `Đã xóa ${p.name} và ${u.txs.length} giao dịch.` : 'Đã xóa.', 'ok');
      if (opts.onDeleted) opts.onDeleted();
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  return (
    <Modal
      title={p ? 'Sửa thông tin' : 'Thêm người / đối tượng'}
      size="sm"
      onSubmit={onSave}
      footer={(
        <>
          {p ? <Button variant="ghost" className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}><Trash2 />Xóa</Button> : null}
          <Button variant="ghost" onClick={close}>Hủy</Button>
          <Button type="submit"><Check />Lưu</Button>
        </>
      )}
    >
      <div className="grid gap-4">
        <Field label="Tên"><Input value={st.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Vai trò">
          <Select options={Object.entries(PARTY_ROLES).map(([value, label]) => ({ value, label }))} value={st.role} onChange={(v) => patch({ role: v })} />
        </Field>
        <Field label="Ghi chú"><Input value={st.note} onChange={(e) => patch({ note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/** openPartyForm() · openPartyForm({ onSaved }) · openPartyForm(party, { onSaved, onDeleted }) */
export function openPartyForm(p = null, opts = {}) {
  let party = p;
  let o = opts;
  if (p && !p.id) { o = p; party = null; } // gọi openPartyForm({ onSaved })
  return openDialog(() => <PartyForm party={party} opts={o} />);
}
