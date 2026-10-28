import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { PdfErrorCode, type Task } from '@embedpdf/models';
import { useDocumentManagerCapability, DocumentContent } from '@embedpdf/plugin-document-manager/react';
import { useExportCapability } from '@embedpdf/plugin-export/react';
import { useAnnotationCapability } from '@embedpdf/plugin-annotation/react';
import { useHistoryCapability } from '@embedpdf/plugin-history/react';
import { finalizePdf } from '../engine/export-client';
import { Toolbar } from './Toolbar';
import { Viewer } from './Viewer';
import { FullScreenMessage } from './App';

const asPromise = <T,>(task: Task<T, any>) =>
  new Promise<T>((resolve, reject) =>
    task.wait(resolve, (e: any) => reject(new Error(e?.reason?.message ?? e?.message ?? 'Thao tác thất bại'))),
  );

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; fileName: string; warnings: string[] }
  | { kind: 'error'; message: string };

export function Workspace({ documentId }: { documentId: string | null }) {
  const { provides: docs } = useDocumentManagerCapability();
  const { provides: exporter } = useExportCapability();
  const { provides: annotations } = useAnnotationCapability();
  const { provides: history } = useHistoryCapability();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [openError, setOpenError] = useState<string | null>(null);
  const [changes, setChanges] = useState({ seq: 0, exportedSeq: 0 });
  const [exportStatus, setExportStatus] = useState<ExportStatus>({ kind: 'idle' });
  const [confirmDiscard, setConfirmDiscard] = useState<File | null>(null);
  const dirty = changes.seq !== changes.exportedSeq;

  // Every undoable action (create/move/edit/delete, undo, redo) changes the document.
  useEffect(() => {
    if (!history) return;
    return history.onHistoryChange(() => setChanges((c) => ({ ...c, seq: c.seq + 1 })));
  }, [history]);

  // Read-only probe for automated acceptance tests (dev server or ?e2e only).
  useEffect(() => {
    if (!import.meta.env.DEV && !new URLSearchParams(location.search).has('e2e')) return;
    (window as any).__ezpdf = {
      documentId,
      annotations: () => {
        if (!documentId || !annotations) return [];
        const st = annotations.forDocument(documentId).getState();
        return Object.values(st.byUid).map((t) => ({ ...t.object, commitState: t.commitState }));
      },
    };
  }, [documentId, annotations]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const openFile = useCallback(
    async (file: File, force = false) => {
      if (!docs) return;
      if (dirty && !force) {
        setConfirmDiscard(file);
        return;
      }
      setConfirmDiscard(null);
      setOpenError(null);
      setExportStatus({ kind: 'idle' });
      if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setOpenError(`"${file.name}" không phải tệp PDF.`);
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        await asPromise(docs.closeAllDocuments());
        setFileName(file.name);
        setChanges({ seq: 0, exportedSeq: 0 });
        await asPromise(docs.openDocumentBuffer({ buffer, name: file.name, autoActivate: true }));
      } catch (e) {
        setOpenError(e instanceof Error ? e.message : String(e));
      }
    },
    [docs, dirty],
  );

  const exportPdf = useCallback(async () => {
    if (!documentId || !exporter || !annotations) return;
    setExportStatus({ kind: 'working' });
    try {
      await asPromise(annotations.forDocument(documentId).commit());
      const raw = await asPromise(exporter.forDocument(documentId).saveAsCopy());
      const out = await finalizePdf(raw);
      const base = fileName.replace(/\.pdf$/i, '') || 'tai-lieu';
      const name = `${base} (ezPDF).pdf`;
      const url = URL.createObjectURL(new Blob([out.bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      const warnings = [...out.report.warnings];
      if (out.report.missingGlyphs.length) warnings.push(`Phông chưa có ký tự: ${out.report.missingGlyphs.join(' ')}`);
      setChanges((c) => ({ ...c, exportedSeq: c.seq }));
      setExportStatus({ kind: 'done', fileName: name, warnings });
    } catch (e) {
      setExportStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [documentId, exporter, annotations, fileName]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void openFile(f);
  };

  return (
    <div className="flex h-full flex-col" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void openFile(f);
        }}
      />
      <Toolbar
        documentId={documentId}
        fileName={fileName}
        dirty={dirty}
        exportStatus={exportStatus}
        onOpen={() => fileInput.current?.click()}
        onExport={exportPdf}
      />
      {confirmDiscard && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>Thay đổi chưa xuất sẽ mất nếu mở “{confirmDiscard.name}”.</span>
          <button className="rounded px-2 py-1 font-medium hover:bg-amber-100" onClick={() => openFile(confirmDiscard, true)}>
            Vẫn mở
          </button>
          <button className="rounded px-2 py-1 hover:bg-amber-100" onClick={() => setConfirmDiscard(null)}>
            Hủy
          </button>
        </div>
      )}
      <main className="relative min-h-0 flex-1">
        {openError ? (
          <FullScreenMessage tone="error" title="Không mở được tệp">
            {openError}
          </FullScreenMessage>
        ) : !documentId ? (
          <EmptyState onOpen={() => fileInput.current?.click()} />
        ) : (
          <DocumentContent documentId={documentId}>
            {({ documentState, isLoading, isError, isLoaded }) => (
              <>
                {isLoading && <FullScreenMessage tone="loading" title="Đang mở tài liệu…" />}
                {isError && (
                  <FullScreenMessage tone="error" title="Không mở được tài liệu">
                    {describeOpenError(documentState)}
                  </FullScreenMessage>
                )}
                {isLoaded && <Viewer documentId={documentId} />}
              </>
            )}
          </DocumentContent>
        )}
      </main>
    </div>
  );
}

function describeOpenError(state: { error: string | null; errorCode?: PdfErrorCode }): string {
  if (state.errorCode === PdfErrorCode.Password) return 'Tài liệu có mật khẩu. Bản thử này chưa hỗ trợ nhập mật khẩu.';
  return state.error || 'Tệp có thể bị hỏng hoặc không phải PDF hợp lệ.';
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6" data-testid="state-empty">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-white px-10 py-12 text-center">
        <FileText className="size-8 text-zinc-400" aria-hidden />
        <div>
          <p className="font-medium text-zinc-800">Mở một tệp PDF trên máy</p>
          <p className="mt-1 text-sm text-zinc-500">Kéo thả vào đây hoặc chọn tệp. Tài liệu chỉ xử lý trên thiết bị này.</p>
        </div>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          <FolderOpen className="size-4" aria-hidden /> Chọn tệp PDF
        </button>
      </div>
    </div>
  );
}
