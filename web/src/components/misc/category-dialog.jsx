import { useState } from 'react';
import { store } from '@/lib/store-hooks.js';
import { errMsg } from '@/lib/format.js';
import { openDialog, confirmBox, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { cn } from '@/lib/cn.js';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Modal } from '@/components/ui/modal.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';
import { FormFooter } from './form-footer.jsx';

const ICONS = ['🍜', '☕', '🚌', '🏠', '📚', '🎁', '💊', '🛍️', '🎈', '🧾', '✨', '💼', '🎓', '🏦', '💱', '🌱', '🧴', '📱', '🎬', '🐶', '✈️', '⚽'];

function CategoryForm({ c }) {
  const { close } = useDialog();
  const [name, setName] = useState(c ? c.name : '');
  const [type, setType] = useState(c ? c.type : 'expense');
  const [icon, setIcon] = useState(c ? c.icon || '' : '');
  const [saving, setSaving] = useState(false);
  const usedBy = c ? store.all('txs').filter((t) => t.categoryId === c.id).length : 0;

  const save = async () => {
    const n = name.trim();
    if (!n) return toast('Nhập tên danh mục.', 'error');
    if (store.all('categories').some((x) => x.id !== (c && c.id) && x.type === type && x.name.toLowerCase() === n.toLowerCase())) return toast('Đã có danh mục trùng tên.', 'error');
    setSaving(true);
    try { await store.put('categories', { ...(c || {}), name: n, type, icon: icon.trim() }); close(); toast('Đã lưu.', 'ok'); } catch (e) { setSaving(false); toast(errMsg(e), 'error'); }
  };

  const remove = async () => {
    const msg = usedBy ? `Xóa “${c.name}”? ${usedBy} giao dịch đang dùng sẽ trở thành “chưa phân loại”.` : `Xóa “${c.name}”?`;
    if (!(await confirmBox(msg, { okLabel: 'Xóa', danger: true }))) return;
    try {
      if (usedBy) await store.putMany('txs', store.all('txs').filter((t) => t.categoryId === c.id).map((t) => ({ ...t, categoryId: '' })));
      const bs = store.all('budgets').filter((b) => b.categoryId === c.id);
      if (bs.length) await store.delMany('budgets', bs.map((b) => b.id));
      await store.del('categories', c.id);
      close();
      toast('Đã xóa danh mục.', 'ok');
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <Modal title={c ? 'Sửa danh mục' : 'Thêm danh mục'} onSubmit={save} footer={<FormFooter onDelete={c ? remove : null} onCancel={close} saving={saving} />}>
      <div className="grid gap-4">
        <Field label="Tên danh mục"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Loại"><Segmented options={[{ value: 'expense', label: 'Chi' }, { value: 'income', label: 'Thu' }]} value={type} onChange={setType} /></Field>
        <Field label="Biểu tượng">
          <Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} aria-label="Biểu tượng" className="w-24 text-center text-xl" />
        </Field>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn nhanh biểu tượng">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Biểu tượng ${i}`}
              aria-pressed={icon === i}
              onClick={() => setIcon(i)}
              className={cn('grid size-10 place-content-center rounded-xl border text-xl outline-none transition-all hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95', icon === i ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/60')}
            >{i}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export const openCategory = (c) => openDialog(() => <CategoryForm c={c} />);
