import { useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { EmbedPDF, type PluginBatchRegistrations } from '@embedpdf/core/react';
import { createPluginRegistration } from '@embedpdf/core';
import { usePdfiumEngine } from '@embedpdf/engines/react';
import { DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager/react';
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport/react';
import { ScrollPluginPackage, ScrollStrategy } from '@embedpdf/plugin-scroll/react';
import { InteractionManagerPluginPackage } from '@embedpdf/plugin-interaction-manager/react';
import { ZoomMode, ZoomPluginPackage } from '@embedpdf/plugin-zoom/react';
import { RotatePluginPackage } from '@embedpdf/plugin-rotate/react';
import { RenderPluginPackage } from '@embedpdf/plugin-render/react';
import { TilingPluginPackage } from '@embedpdf/plugin-tiling/react';
import { SelectionPluginPackage } from '@embedpdf/plugin-selection/react';
import { HistoryPluginPackage } from '@embedpdf/plugin-history/react';
import { AnnotationPluginPackage } from '@embedpdf/plugin-annotation/react';
import { ExportPluginPackage } from '@embedpdf/plugin-export/react';
import { FONT_FALLBACK, PDFIUM_WASM_URL } from '../engine/config';
import { EZ_MARK } from '../engine/vn-freetext-export';
import { Workspace } from './Workspace';

export function App() {
  const { engine, isLoading, error } = usePdfiumEngine({
    wasmUrl: PDFIUM_WASM_URL,
    worker: true,
    fontFallback: FONT_FALLBACK,
  });

  const plugins: PluginBatchRegistrations = useMemo(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage, {}),
      createPluginRegistration(ViewportPluginPackage, { viewportGap: 16 }),
      createPluginRegistration(ScrollPluginPackage, { defaultStrategy: ScrollStrategy.Vertical }),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(ZoomPluginPackage, { defaultZoomLevel: ZoomMode.FitWidth }),
      createPluginRegistration(RotatePluginPackage),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(TilingPluginPackage, { tileSize: 768, overlapPx: 2.5, extraRings: 0 }),
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(HistoryPluginPackage),
      createPluginRegistration(AnnotationPluginPackage, {
        selectAfterCreate: true,
        tools: [
          {
            id: 'freeText',
            defaults: { contents: 'Nhập chữ', fontSize: 14, fontColor: '#1d2433', custom: { [EZ_MARK]: 1 } },
            clickBehavior: { enabled: true, defaultSize: { width: 160, height: 22 }, defaultContent: 'Nhập chữ' },
            behavior: { deactivateToolAfterCreate: true },
          },
          { id: 'highlight', defaults: { strokeColor: '#ffd43b', opacity: 0.55, custom: { [EZ_MARK]: 1 } } },
        ],
      }),
      createPluginRegistration(ExportPluginPackage),
    ],
    [],
  );

  if (error) {
    return (
      <FullScreenMessage tone="error" title="Không khởi động được bộ xử lý PDF">
        {error.message}
      </FullScreenMessage>
    );
  }
  if (isLoading || !engine) {
    return <FullScreenMessage tone="loading" title="Đang khởi động bộ xử lý PDF…" />;
  }
  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {({ pluginsReady, activeDocumentId }) =>
        pluginsReady ? (
          <Workspace documentId={activeDocumentId} />
        ) : (
          <FullScreenMessage tone="loading" title="Đang chuẩn bị…" />
        )
      }
    </EmbedPDF>
  );
}

export function FullScreenMessage({
  tone,
  title,
  children,
}: {
  tone: 'loading' | 'error';
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6" data-testid={`state-${tone}`}>
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        {tone === 'loading' ? (
          <Loader2 className="size-6 animate-spin text-zinc-400" aria-hidden />
        ) : (
          <AlertTriangle className="size-6 text-red-600" aria-hidden />
        )}
        <p className="text-sm font-medium text-zinc-800">{title}</p>
        {children && <p className="text-sm text-zinc-500">{children}</p>}
      </div>
    </div>
  );
}
