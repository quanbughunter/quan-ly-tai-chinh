import { money } from '@/lib/format.js';
import { Badge } from '@/components/ui/badge.jsx';

/** Các huy hiệu "tiền theo từng loại tiền tệ", ví dụ { VND: 5e6, RUB: 1200 }. */
export function CurrencyChips({ values, signed = false, className }) {
  const entries = Object.entries(values || {}).filter(([, v]) => Math.abs(v) > 1e-9);
  if (!entries.length) return <Badge variant="muted" className={className}>0</Badge>;
  return entries.map(([cur, v]) => <Badge key={cur} variant={v < 0 ? 'danger' : 'neutral'} className={className}>{money(v, cur, { sign: signed })}</Badge>);
}
