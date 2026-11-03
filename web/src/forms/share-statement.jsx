import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Share2 } from 'lucide-react';
import { store } from '@/lib/store-hooks.js';
import { todayStr } from '@logic/dates.js';
import { fmtMoney } from '@logic/money.js';
import { buildStatement, summarize, encodeStatement, statementLink, shareBase } from '@logic/statement.js';
import { openDialog, useDialog } from '@/lib/dialogs.jsx';
import { toast } from '@/lib/toast.js';
import { lsGet, lsSet } from '@/lib/storage.js';
import { Modal } from '@/components/ui/modal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input, Textarea } from '@/components/ui/input.jsx';

const OWNER_KEY = 'qltc:statementOwner';
const LONG_LINK = 3000; // dài hơn mức này, một số ứng dụng chat có thể cắt link

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* thử cách cũ */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

function lineOf(name, s) {
  const v = fmtMoney(Math.abs(s.balance), s.cur);
  const what = Math.abs(s.balance) < 1e-9 ? 'đã tất toán' : s.balance > 0 ? `nợ mình ${v}` : `mình đang nợ ${v}`;
  return `${name} ${what} · ${s.count} dòng${Math.abs(s.open) > 1e-9 ? ' (+ số dư đầu kỳ)' : ''}`;
}

function ShareStatement({ partyId }) {
  const { close } = useDialog();
  const party = store.byId('parties', partyId);
  const name = party ? party.name : '';
  const [owner, setOwner] = useState(() => lsGet(OWNER_KEY, ''));
  const [from, setFrom] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');

  const st = useMemo(
    () => buildStatement({ txs: store.all('txs'), partyId, owner, party: name, note, from, asOf: todayStr() }),
    [partyId, name, owner, from, note],
  );
  const sums = summarize(st);
  const empty = !st.c.length;

  useEffect(() => {
    let alive = true;
    encodeStatement(st).then((tok) => { if (alive) setLink(statementLink(shareBase(), tok)); });
    return () => { alive = false; };
  }, [st]);

  const remember = () => lsSet(OWNER_KEY, owner.trim());
  const onCopy = async () => {
    remember();
    toast(await copyText(link) ? 'Đã sao chép link — dán vào tin nhắn gửi cho họ.' : 'Không sao chép được — bấm vào ô link rồi chép tay.', 'ok');
  };
  const onShare = async () => {
    remember();
    try { await navigator.share({ title: 'Bảng công nợ', text: `Bảng công nợ của ${name}`, url: link }); } catch { /* đóng bảng chia sẻ thì thôi */ }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const footer = (
    <>
      <Button variant="ghost" onClick={close}>Đóng</Button>
      {canShare ? <Button variant="outline" onClick={onShare} disabled={empty || !link}><Share2 />Gửi…</Button> : null}
      <Button onClick={onCopy} disabled={empty || !link} data-testid="share-copy"><Copy />Sao chép link</Button>
    </>
  );

  return (
    <Modal title={`Gửi bảng nợ cho ${name}`} description="Tạo link để họ tự xem bảng công nợ — không cần cài app hay đăng nhập." footer={footer}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Field label="Tên của bạn (hiện ở đầu bảng)">
          <Input value={owner} maxLength={60} placeholder="Ví dụ: Quân" onChange={(e) => setOwner(e.target.value)} />
        </Field>
        <Field label="Liệt kê từ ngày" hint="Bỏ trống = liệt kê từ đầu. Chọn một mốc để bảng ngắn lại; phần trước mốc gộp thành “số dư đầu kỳ”.">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Ghi chú gửi kèm (không bắt buộc)" hint="Hiện trong khung vàng ngay dưới số dư — ví dụ số tài khoản để họ chuyển khoản.">
          <Textarea rows={2} maxLength={400} value={note} placeholder="Ví dụ: Chuyển khoản MB 0123456789 — NGUYEN VAN A" onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="grid gap-1.5 rounded-xl bg-muted/60 p-3 text-sm" data-testid="share-preview">
          <span className="text-xs font-semibold text-muted-foreground">Người nhận sẽ thấy</span>
          {empty ? <p>Chưa có giao dịch Vay nợ nào với {name}{from ? ' từ mốc này' : ''}.</p> : sums.map((s) => <p key={s.cur} className="tnum">{lineOf(name, s)}</p>)}
        </div>

        <Field label="Link" hint="Dữ liệu nằm ngay trong link: ai có link thì xem được, nên chỉ gửi cho đúng người. Link là ảnh chụp lúc này — sau này có giao dịch mới thì tạo link mới.">
          <Input readOnly value={empty ? '' : link} data-testid="share-link" onFocus={(e) => e.target.select()} placeholder="Đang tạo link…" />
        </Field>
        {!empty && link.length > LONG_LINK ? (
          <p className="-mt-2 text-xs font-medium text-warning">Link khá dài ({link.length} ký tự). Nếu ứng dụng chat cắt mất link, hãy chọn “Liệt kê từ ngày” để rút ngắn.</p>
        ) : null}
        {!empty && link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="-mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            <ExternalLink className="size-4" />Xem thử trang người nhận sẽ thấy
          </a>
        ) : null}
      </div>
    </Modal>
  );
}

/** Mở hộp thoại tạo link bảng công nợ của một người trong Vay nợ. */
export function openShareStatement(partyId) {
  if (!store.byId('parties', partyId)) return null;
  return openDialog(() => <ShareStatement partyId={partyId} />);
}
