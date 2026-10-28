import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { store } from '@/lib/store-hooks.js';
import { PARTY_ROLES } from '@logic/model.js';
import { openDialog, useDialog, confirmBox } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg } from '@/lib/format.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';

function PartyForm({ party: p, opts }) {
  const { close } = useDialog();
  const [st, setSt] = useState(() => ({ name: p ? p.name : '', role: p ? p.role || 'person' : opts.role || 'person', note: p ? p.note || '' : '' }));
  const patch = (x) => setSt((s) => ({ ...s, ...x }));
  const used = p ? (store.all('txs').some((t) => t.partyId === p.id) || store.all('deals').some((d) => d.partyId === p.id)) : false;

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
    if (!(await confirmBox(`Xóa “${p.name}”?`, { okLabel: 'Xóa', danger: true }))) return;
    try { await store.del('parties', p.id); close(); toast('Đã xóa.', 'ok'); if (opts.onDeleted) opts.onDeleted(); } catch (e) { toast(errMsg(e), 'error'); }
  }

  return (
    <Modal
      title={p ? 'Sửa thông tin' : 'Thêm người / đối tượng'}
      size="sm"
      onSubmit={onSave}
      footer={(
        <>
          {p && !used ? <Button variant="ghost" className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}><Trash2 />Xóa</Button> : null}
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
