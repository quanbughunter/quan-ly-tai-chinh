import { ArrowLeftRight, HandCoins, MinusCircle, PenLine, PlusCircle } from 'lucide-react';
import { openDialog } from '@/lib/dialogs.jsx';
import { store } from '@/lib/store-hooks.js';
import { Modal } from '@/components/ui/modal.jsx';
import { IconBubble } from '@/components/row.jsx';
import { useDialog } from '@/lib/dialogs.jsx';
import { openTxForm, openQuickAdd } from '@/forms/index.js';

function MenuItem({ icon: Icon, tone, title, sub, onPick }) {
  return (
    <button type="button" onClick={onPick} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent active:bg-accent">
      <IconBubble tone={tone}><Icon strokeWidth={2.1} /></IconBubble>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

function AddMenu() {
  const { close } = useDialog();
  const go = (fn) => () => { close(); fn(); };
  return (
    <Modal title="Thêm mới" size="sm">
      <div className="-mx-2 grid gap-0.5">
        <MenuItem icon={MinusCircle} tone="expense" title="Khoản chi" sub="Ghi một khoản chi tiêu" onPick={go(() => openTxForm({ group: 'expense' }))} />
        <MenuItem icon={PlusCircle} tone="income" title="Khoản thu" sub="Lương, học bổng, tiền làm thêm… (có thể gửi bố)" onPick={go(() => openQuickAdd('', { income: true }))} />
        <MenuItem icon={PenLine} tone="primary" title="Nhập nhanh nhiều khoản" sub="Ví dụ: cafe 25k, ăn trưa 45k, +lương 10tr" onPick={go(() => openQuickAdd(''))} />
        <MenuItem icon={ArrowLeftRight} tone="primary" title="Chuyển / đổi tiền" sub="Giữa hai tài khoản, kể cả khác tiền tệ" onPick={go(() => openTxForm({ group: 'transfer' }))} />
        <MenuItem icon={HandCoins} tone="warning" title="Vay nợ" sub="Cho vay, nhận trả, đi vay, trả nợ" onPick={go(() => openTxForm({ group: 'debt' }))} />
      </div>
    </Modal>
  );
}

export function openAddMenu() {
  if (!store.ready) return null;
  return openDialog(() => <AddMenu />);
}
