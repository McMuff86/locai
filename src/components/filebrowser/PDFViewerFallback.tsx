"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDFViewerFallbackProps {
  pdfUrl: string;
  fileName: string;
}

const DEFAULT_SCALE = 1.2;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.2;

export function PDFViewerFallback({ pdfUrl, fileName }: PDFViewerFallbackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  // Load document
  useEffect(() => {
    let destroyed = false;

    async function loadPdf() {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (destroyed) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setIsLoading(false);
      } catch (err) {
        if (!destroyed) {
          setError(
            err instanceof Error ? err.message : 'PDF konnte nicht geladen werden',
          );
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      destroyed = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl]);

  // Render all pages when document loaded or scale changes
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return;
    let cancelled = false;

    const pdf = pdfDocRef.current;
    setRenderedPages(new Set());

    async function renderAllPages() {
      const dpr = window.devicePixelRatio || 1;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (cancelled) return;

        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = document.getElementById(
          `pdf-page-${pageNum}`,
        ) as HTMLCanvasElement | null;

        if (!canvas) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        await page.render({ canvas, viewport }).promise;

        if (!cancelled) {
          setRenderedPages((prev) => new Set(prev).add(pageNum));
        }
      }
    }

    renderAllPages();

    return () => {
      cancelled = true;
    };
  }, [numPages, scale]);

  // Track current page on scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const scrollTop = container.scrollTop;
    const children = container.querySelectorAll('[data-page-num]');
    let closest = 1;
    let closestDist = Infinity;

    children.forEach((child) => {
      const el = child as HTMLElement;
      const pageNum = parseInt(el.dataset.pageNum ?? '1', 10);
      const dist = Math.abs(el.offsetTop - scrollTop);
      if (dist < closestDist) {
        closestDist = dist;
        closest = pageNum;
      }
    });

    setCurrentPage(closest);
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(1)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(1)));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(DEFAULT_SCALE);
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-destructive">
        <span className="font-medium">PDF-Fehler:</span>
        <span className="text-muted-foreground">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/30 bg-muted/20 flex-shrink-0">
        <span className="text-xs text-muted-foreground font-mono select-none">
          {isLoading ? '...' : `${currentPage} / ${numPages}`}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            title="Verkleinern"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[11px] text-muted-foreground font-mono w-10 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            title="Vergrößern"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={resetZoom}
            title="Zoom zurücksetzen"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Page container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-muted/30"
        onScroll={handleScroll}
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {fileName} wird geladen...
            </span>
          </div>
        )}

        {!isLoading &&
          Array.from({ length: numPages }, (_, i) => {
            const pageNum = i + 1;
            return (
              <div
                key={pageNum}
                data-page-num={pageNum}
                className="flex justify-center py-2"
              >
                <div className="relative shadow-md">
                  <canvas
                    id={`pdf-page-${pageNum}`}
                    className="block bg-white"
                  />
                  {!renderedPages.has(pageNum) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
