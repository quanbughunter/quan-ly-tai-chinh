// Báo tỉ giá: máy tính báo giá sang / về, lưu báo giá, và CHỐT giao dịch.
// Chỉ khi chốt, lãi mới được cộng vào thẻ nhận lãi (mặc định thẻ MB; thẻ VND hay thẻ rúp đều được) đúng ngày của lệnh.
import { useEffect } from 'react';
import { store, useStore } from '@/lib/store-hooks.js';
import { takeOpenRequest, pendingPost } from '@logic/deals.js';
import { PageHeader } from '@/components/page-header.jsx';
import { Calculator } from '@/components/exchange/calculator.jsx';
import { DealList, PendingBanner } from '@/components/exchange/deal-list.jsx';
import { openDealForm } from '@/components/exchange/deal-dialog.jsx';

export { openDealForm };

export default function ExchangeScreen() {
  useStore();
  const params = store.settings().params;
  const pend = pendingPost();

  // Mở lệnh theo yêu cầu từ màn hình Giao dịch (bấm vào giao dịch lãi tự động).
  useEffect(() => {
    const rq = takeOpenRequest();
    if (!rq) return undefined;
    const d = store.byId('deals', rq);
    if (!d) return undefined;
    const t = setTimeout(() => openDealForm(d), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader title="Báo tỉ giá" subtitle="Tính giá sang / về cho khách, lưu báo giá và chốt lãi." className="mb-1" />
      {pend.length ? <PendingBanner list={pend} params={params} /> : null}
      <Calculator />
      <DealList params={params} />
    </div>
  );
}
