import { Viewport } from '@embedpdf/plugin-viewport/react';
import { Scroller } from '@embedpdf/plugin-scroll/react';
import { GlobalPointerProvider, PagePointerProvider } from '@embedpdf/plugin-interaction-manager/react';
import { Rotate } from '@embedpdf/plugin-rotate/react';
import { RenderLayer } from '@embedpdf/plugin-render/react';
import { TilingLayer } from '@embedpdf/plugin-tiling/react';
import { SelectionLayer } from '@embedpdf/plugin-selection/react';
import { AnnotationLayer } from '@embedpdf/plugin-annotation/react';

/**
 * Pages are virtualised by the scroll plugin; each visible page gets a
 * low-res base render plus tiles at the current zoom. Annotations live in
 * page space (PDF points, unrotated), the Rotate wrapper turns the view.
 */
export function Viewer({ documentId }: { documentId: string }) {
  return (
    <div className="ez-viewer absolute inset-0" data-testid="viewer">
      <GlobalPointerProvider documentId={documentId}>
        <Viewport documentId={documentId} className="h-full w-full bg-zinc-100">
          <Scroller
            documentId={documentId}
            renderPage={({ pageIndex }) => (
              <Rotate documentId={documentId} pageIndex={pageIndex} style={{ backgroundColor: '#fff' }}>
                <div data-testid={`page-${pageIndex}`} className="shadow-[0_1px_3px_rgba(0,0,0,0.12)]" style={{ position: 'absolute', inset: 0 }} />
                <PagePointerProvider documentId={documentId} pageIndex={pageIndex}>
                  <RenderLayer documentId={documentId} pageIndex={pageIndex} scale={1} style={{ pointerEvents: 'none' }} />
                  <TilingLayer documentId={documentId} pageIndex={pageIndex} style={{ pointerEvents: 'none' }} />
                  <SelectionLayer documentId={documentId} pageIndex={pageIndex} />
                  <AnnotationLayer documentId={documentId} pageIndex={pageIndex} />
                </PagePointerProvider>
              </Rotate>
            )}
          />
        </Viewport>
      </GlobalPointerProvider>
    </div>
  );
}
