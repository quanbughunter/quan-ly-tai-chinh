import { useEffect, useState } from 'react';
import { Field } from '@/components/ui/field.jsx';
import { MoneyInput, readAmount } from '@/components/ui/money-input.jsx';
import { toast } from '@/lib/toast.js';
import { errMsg } from '@/lib/format.js';

/**
 * Ô nhập số tự lưu khi rời ô (hoặc bấm Enter). onSave(v) trả Promise; lỗi hiện toast.
 * Không lưu nếu số không đổi, để không bắn "Đã lưu" khi chỉ bấm qua.
 */
export function NumField({ label, value, onSave, cur = '', hint }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => { setText(value == null ? '' : String(value)); }, [value]);

  const commit = async () => {
    const v = readAmount(text);
    if (!Number.isFinite(v) || v < 0) { toast('Số không hợp lệ.', 'error'); return; }
    if (v === Number(value)) return;
    try { await onSave(v); toast('Đã lưu.', 'ok'); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <Field label={label} hint={hint}>
      <MoneyInput
        value={text}
        onChange={setText}
        currency={cur}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      />
    </Field>
  );
}
