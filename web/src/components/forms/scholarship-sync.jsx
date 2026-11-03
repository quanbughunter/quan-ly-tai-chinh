// Ô «Ghi vào mục Học bổng MIIGAiK» hiện ra khi một khoản thu được chọn danh mục «Học bổng»
// (dùng chung cho form Thêm giao dịch và Nhập nhanh). Hỏi ngày học bổng «có», ngày thực nhận, tháng, thẻ ₽.
import { GraduationCap } from 'lucide-react';
import { fmtDate, monthLabel } from '@logic/dates.js';
import {
  SCHOLARSHIP_CURRENCY, SCHOLARSHIP_NAME, isReceived, isReceivingAccount, resolveScholarshipInput, scholarshipByMonth,
} from '@logic/scholarship.js';
import { store } from '@/lib/store-hooks.js';
import { accountOptions } from '@/lib/options.js';
import { cn } from '@/lib/cn.js';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { CheckRow } from '@/components/ui/checkbox.jsx';

/** Một câu cho biết lưu xong sẽ xảy ra gì với mục Học bổng MIIGAiK. */
function whatHappens(r, existing) {
  const label = r.month ? monthLabel(r.month) : 'Tháng này';
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  if (!existing) return `Sẽ tạo ${lower} mới ở mục ${SCHOLARSHIP_NAME} và ghi khoản thu ₽ vào thẻ.`;
  if (isReceived(existing)) return `${label} đã có ở mục ${SCHOLARSHIP_NAME} (nhận ${fmtDate(existing.receivedDate)}) — lưu sẽ cập nhật tháng đó, không cộng thêm lần nữa.`;
  const keep = existing.availableDate && !r.availableDate ? `, giữ ngày có ${fmtDate(existing.availableDate)}` : '';
  return `${label} đang chờ ở mục ${SCHOLARSHIP_NAME}${keep} — lưu sẽ đánh dấu đã nhận.`;
}

/**
 * sch: { on, month, availableDate, receivedDate, accountId } · onChange(partial)
 * receivedDate: ngày thực nhận đang có hiệu lực (ô «Ngày» của form); showReceived: cho sửa riêng; showCard: cho chọn thẻ ₽ riêng.
 * problem: lỗi đang chặn việc lưu (nếu có).
 */
export function ScholarshipSync({ sch, onChange, receivedDate, showReceived = false, showCard = false, problem = '' }) {
  const r = resolveScholarshipInput(sch, sch.receivedDate || receivedDate);
  const existing = scholarshipByMonth(r.month, store.all('scholarships'));
  const cardOptions = accountOptions({ none: '— Chọn thẻ ₽ —', only: (a) => isReceivingAccount(a) || (a.id === sch.accountId && a.currency === SCHOLARSHIP_CURRENCY) });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3" data-testid="sch-sync">
      <CheckRow checked={sch.on} onChange={(v) => onChange({ on: v })} className="text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5"><GraduationCap className="size-4 text-primary" />Ghi vào mục {SCHOLARSHIP_NAME}</span>
      </CheckRow>
      {sch.on ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            <Field label="Ngày học bổng “có”">
              <Input type="date" value={sch.availableDate} onChange={(e) => onChange({ availableDate: e.target.value })} data-testid="sch-available" />
            </Field>
            {showReceived ? (
              <Field label="Ngày thực nhận">
                <Input type="date" value={r.receivedDate} onChange={(e) => onChange({ receivedDate: e.target.value })} data-testid="sch-received" />
              </Field>
            ) : null}
            <Field label="Tháng học bổng">
              <Input type="month" value={r.month} onChange={(e) => onChange({ month: e.target.value })} data-testid="sch-month" />
            </Field>
            {showCard ? (
              <Field label="Cộng vào thẻ ₽">
                <Select options={cardOptions} value={sch.accountId} onChange={(v) => onChange({ accountId: v })} />
              </Field>
            ) : null}
          </div>
          <p className={cn('text-xs leading-relaxed', problem ? 'font-medium text-destructive' : 'text-muted-foreground')} data-testid="sch-info">{problem || whatHappens(r, existing)}</p>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">Chỉ ghi một khoản thu thường — mục {SCHOLARSHIP_NAME} sẽ không có tháng này.</p>
      )}
    </div>
  );
}
