// Máy tính báo giá trên màn hình Báo tỉ giá: chọn chiều Sang / Về, nhập giá, xem kết quả, lưu báo giá hoặc chốt.
import { useState } from 'react';
import { Check, Save } from 'lucide-react';
import { store } from '@logic/store.js';
import { quoteSang, quoteVe } from '@logic/fx.js';
import { fmtNum } from '@logic/money.js';
import { Section } from '@/components/ui/card.jsx';
import { Segmented } from '@/components/ui/segmented.jsx';
import { Button } from '@/components/ui/button.jsx';
import { toast } from '@/lib/toast.js';
import { DealBody, amountOf, defaultsFor, useDealValues } from './deal-fields.jsx';
import { openDealForm } from './deal-dialog.jsx';

const DIRS = [
  { value: 'sang', label: 'Sang · VND → RUB' },
  { value: 've', label: 'Về · RUB → VND' },
];

let lastDir = 'sang'; // nhớ chiều đã chọn khi rời màn hình rồi quay lại

function CalcBody({ dir, params, onSaved }) {
  const { vals, setVal, parsed, result } = useDealValues(dir, defaultsFor(dir, params), {}, params);
  const start = (confirm) => {
    const q = dir === 'sang' ? quoteSang({ ...parsed.inputs, lot: params.lotSang }) : quoteVe({ ...parsed.inputs, lot: params.lotVe });
    if (!q || !amountOf(dir, parsed.inputs)) { toast('Nhập đủ giá báo và số tiền khách đưa trước.', 'error'); return; }
    openDealForm({ dir, inputs: parsed.inputs, actual: parsed.actual }, { confirm, onSaved });
  };
  return (
    <div className="grid grid-cols-1 gap-5">
      <DealBody dir={dir} vals={vals} setVal={setVal} parsed={parsed} result={result} params={params} split />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => start(false)}><Save className="size-4" />Lưu báo giá</Button>
        <Button className="flex-1 sm:flex-none" onClick={() => start(true)}><Check className="size-4" />Chốt giao dịch</Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">Khách chỉ hỏi giá thì chỉ cần phần giá báo rồi bấm “Lưu báo giá”. Sau khi đi mua / bán USDT xong, nhập giá thực để thấy lãi thực rồi bấm “Chốt giao dịch” — chỉ khi chốt, lãi mới được cộng vào thẻ.</p>
    </div>
  );
}

export function Calculator() {
  const params = store.settings().params;
  const [dir, setDir] = useState(lastDir);
  const [resetKey, setResetKey] = useState(0); // lưu xong thì làm mới máy tính cho khách kế tiếp
  return (
    <Section
      title="Máy tính báo giá"
      right={<span className="text-xs text-muted-foreground">{`Lô: ${fmtNum(params.lotSang)} ₫ · ${fmtNum(params.lotVe)} ₽`}</span>}
    >
      <div className="grid grid-cols-1 gap-5">
        <Segmented options={DIRS} value={dir} onChange={(v) => { lastDir = v; setDir(v); }} aria-label="Chiều đổi" />
        <CalcBody key={`${dir}-${resetKey}`} dir={dir} params={params} onSaved={() => setResetKey((k) => k + 1)} />
      </div>
    </Section>
  );
}
