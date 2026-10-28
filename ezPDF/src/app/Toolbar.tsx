import { useEffect, useState, type ReactNode } from 'react';
import {
  Check,
  Download,
  FolderOpen,
  Highlighter,
  Loader2,
  MousePointer2,
  Redo2,
  RotateCw,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useZoom } from '@embedpdf/plugin-zoom/react';
import { useRotate } from '@embedpdf/plugin-rotate/react';
import { useAnnotation } from '@embedpdf/plugin-annotation/react';
import { useHistoryCapability } from '@embedpdf/plugin-history/react';
import type { ExportStatus } from './Workspace';

interface Props {
  documentId: string | null;
  fileName: string;
  dirty: boolean;
  exportStatus: ExportStatus;
  onOpen: () => void;
  onExport: () => void;
}

export function Toolbar({ documentId, fileName, dirty, exportStatus, onOpen, onExport }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-2">
      <IconButton label="Mở tệp PDF" onClick={onOpen} testId="btn-open">
        <FolderOpen />
      </IconButton>
      {documentId ? <DocumentTools documentId={documentId} /> : null}
      <div className="mx-2 min-w-0 flex-1 truncate text-sm text-zinc-600" title={fileName}>
        {fileName}
      </div>
      {documentId && <SaveState dirty={dirty} status={exportStatus} />}
      {documentId && (
        <button
          data-testid="btn-export"
          onClick={onExport}
          disabled={exportStatus.kind === 'working'}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
        >
          {exportStatus.kind === 'working' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Xuất PDF
        </button>
      )}
    </header>
  );
}

function DocumentTools({ documentId }: { documentId: string }) {
  const { state: zoom, provides: zoomApi } = useZoom(documentId);
  const { provides: rotateApi } = useRotate(documentId);
  const { state: annot, provides: annotApi } = useAnnotation(documentId);
  const { provides: history } = useHistoryCapability();
  const [, force] = useState(0);
  useEffect(() => history?.onHistoryChange(() => force((n) => n + 1)), [history]);
  const scope = history?.forDocument(documentId);
  const tool = annot.activeToolId;
  const setTool = (id: string | null) => annotApi?.setActiveTool(id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        scope?.undo();
      } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        scope?.redo();
      } else if (!mod && !e.altKey) {
        if (k === 'v') annotApi?.setActiveTool(null);
        else if (k === 't') annotApi?.setActiveTool('freeText');
        else if (k === 'h') annotApi?.setActiveTool('highlight');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scope, annotApi]);

  return (
    <>
      <Divider />
      <ToolButton label="Chọn / di chuyển (V)" active={!tool} onClick={() => setTool(null)} testId="tool-select">
        <MousePointer2 />
      </ToolButton>
      <ToolButton label="Thêm chữ (T)" active={tool === 'freeText'} onClick={() => setTool(tool === 'freeText' ? null : 'freeText')} testId="tool-text">
        <Type />
      </ToolButton>
      <ToolButton label="Tô sáng chữ (H)" active={tool === 'highlight'} onClick={() => setTool(tool === 'highlight' ? null : 'highlight')} testId="tool-highlight">
        <Highlighter />
      </ToolButton>
      <Divider />
      <IconButton label="Hoàn tác (Ctrl+Z)" onClick={() => scope?.undo()} disabled={!scope?.canUndo()} testId="btn-undo">
        <Undo2 />
      </IconButton>
      <IconButton label="Làm lại (Ctrl+Y)" onClick={() => scope?.redo()} disabled={!scope?.canRedo()} testId="btn-redo">
        <Redo2 />
      </IconButton>
      <Divider />
      <IconButton label="Thu nhỏ" onClick={() => zoomApi?.zoomOut()} testId="btn-zoom-out">
        <ZoomOut />
      </IconButton>
      <span className="w-12 text-center text-xs tabular-nums text-zinc-600" data-testid="zoom-level">
        {Math.round((zoom.currentZoomLevel ?? 1) * 100)}%
      </span>
      <IconButton label="Phóng to" onClick={() => zoomApi?.zoomIn()} testId="btn-zoom-in">
        <ZoomIn />
      </IconButton>
      <IconButton label="Xoay trang hiển thị 90°" onClick={() => rotateApi?.rotateForward()} testId="btn-rotate">
        <RotateCw />
      </IconButton>
    </>
  );
}

function SaveState({ dirty, status }: { dirty: boolean; status: ExportStatus }) {
  if (status.kind === 'error')
    return (
      <span className="mr-2 max-w-72 truncate text-xs text-red-600" title={status.message} data-testid="export-error">
        Xuất lỗi: {status.message}
      </span>
    );
  if (dirty)
    return (
      <span className="mr-2 inline-flex items-center gap-1.5 text-xs text-amber-700" data-testid="state-dirty">
        <span className="size-1.5 rounded-full bg-amber-500" /> Có thay đổi chưa xuất
      </span>
    );
  if (status.kind === 'done')
    return (
      <span
        className="mr-2 inline-flex items-center gap-1 text-xs text-emerald-700"
        title={status.warnings.join('\n') || status.fileName}
        data-testid="state-exported"
      >
        <Check className="size-3.5" /> Đã xuất {status.warnings.length ? `(${status.warnings.length} cảnh báo)` : ''}
      </span>
    );
  return null;
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-zinc-200" aria-hidden />;
}

function IconButton(props: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; testId: string }) {
  return (
    <button
      title={props.label}
      aria-label={props.label}
      data-testid={props.testId}
      onClick={props.onClick}
      disabled={props.disabled}
      className="inline-flex size-8 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4"
    >
      {props.children}
    </button>
  );
}

function ToolButton(props: { label: string; active: boolean; onClick: () => void; children: ReactNode; testId: string }) {
  return (
    <button
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      data-testid={props.testId}
      onClick={props.onClick}
      className={`inline-flex size-8 items-center justify-center rounded-md [&_svg]:size-4 ${
        props.active ? 'bg-accent-soft text-accent ring-1 ring-accent/40' : 'text-zinc-700 hover:bg-zinc-100'
      }`}
    >
      {props.children}
    </button>
  );
}
