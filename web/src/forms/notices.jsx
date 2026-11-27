import { ArrowRight, Info } from 'lucide-react';
import { store } from '@/lib/store-hooks.js';
import { openDialog, useDialog } from '@/lib/dialogs.jsx';
import { navigate } from '@/lib/route.js';
import { fmtMoney } from '@logic/money.js';
import { accById } from '@/lib/options.js';
import { requestOpenDeal } from '@logic/deals.js';
import { requestOpenScholarship, SCHOLARSHIP_NAME } from '@logic/scholarship.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';

function Notice({ title, text, actionLabel, onAction }) {
  const { close } = useDialog();
  return (
    <Modal
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={close}>Đóng</Button>
          {onAction ? <Button onClick={() => { close(); onAction(); }}>{actionLabel}<ArrowRight /></Button> : null}
        </>
      )}
    >
      <div className="flex gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary"><Info className="size-5" /></span>
        <p className="text-[15px] leading-relaxed">{text}</p>
      </div>
    </Modal>
  );
}

/** Giao dịch lãi do lệnh đổi tiền tự tạo: không sửa tay ở đây để số dư luôn khớp với lệnh. */
export function openDealTxNotice(t) {
  const deal = store.byId('deals', t.dealId);
  const a = accById(t.accountId);
  return openDialog(() => (
    <Notice
      title="Lãi từ giao dịch đổi tiền"
      text={`Khoản này (${fmtMoney(t.amount, t.currency)}${a ? ` · ${a.name}` : ''}) được tạo tự động khi chốt giao dịch ở mục Báo tỉ giá. Muốn sửa số lãi, đổi ngày hoặc hủy, hãy mở lệnh đó — khoản này sẽ tự cập nhật theo.`}
      actionLabel="Mở lệnh đổi tiền"
      onAction={deal ? () => { requestOpenDeal(deal.id); navigate('fx'); } : null}
    />
  ));
}

/** Khoản học bổng do mục Học bổng MIIGAiK tự tạo: sửa ở đó để số dư thẻ luôn khớp. */
export function openScholarshipTxNotice(t) {
  const item = store.byId('scholarships', t.scholarshipId);
  const a = accById(t.accountId);
  return openDialog(() => (
    <Notice
      title={SCHOLARSHIP_NAME}
      text={`Khoản này (${fmtMoney(t.amount, t.currency)}${a ? ` · ${a.name}` : ''}) được tạo tự động khi bạn đánh dấu đã nhận học bổng ở mục ${SCHOLARSHIP_NAME}. Muốn sửa số tiền, đổi ngày, đổi thẻ hoặc hủy, hãy mở tháng đó — khoản này sẽ tự cập nhật theo.`}
      actionLabel="Mở tháng học bổng"
      onAction={item ? () => { requestOpenScholarship(item.id); navigate('scholarship'); } : null}
    />
  ));
}
