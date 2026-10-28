import { ChevronRight } from 'lucide-react';
import { openDialog, useDialog } from '@/lib/dialogs.jsx';
import { Modal } from '@/components/ui/modal.jsx';
import { IconBubble } from '@/components/row.jsx';
import { ROUTES, SIDE_ORDER, TAB_ORDER, routeHref } from '@/lib/nav.js';

function MoreMenu() {
  const { close } = useDialog();
  const more = SIDE_ORDER.filter((k) => !TAB_ORDER.includes(k));
  return (
    <Modal title="Khác" size="sm">
      <div className="-mx-2 grid gap-0.5">
        {more.map((k) => {
          const Icon = ROUTES[k].icon;
          return (
            <a key={k} href={routeHref(k)} onClick={() => close()} className="flex items-center gap-3 rounded-2xl px-3 py-3 outline-none transition-colors hover:bg-accent focus-visible:bg-accent active:bg-accent">
              <IconBubble tone="primary"><Icon strokeWidth={2} /></IconBubble>
              <span className="flex-1 text-[15px] font-semibold">{ROUTES[k].title}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </a>
          );
        })}
      </div>
    </Modal>
  );
}

export const openMoreMenu = () => openDialog(() => <MoreMenu />);
