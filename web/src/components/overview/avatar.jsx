import { IconBubble } from '@/components/row.jsx';

/** Ô tròn chữ cái đầu của tên (người vay, khách…). */
export function Avatar({ name, tone = 'primary' }) {
  const ch = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return <IconBubble tone={tone} className="text-[15px] font-extrabold"><span aria-hidden>{ch}</span></IconBubble>;
}
