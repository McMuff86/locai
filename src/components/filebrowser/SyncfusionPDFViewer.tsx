"use client";

// Register license BEFORE any Syncfusion imports
import "@/lib/syncfusion";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// CSS after license registration
import "@syncfusion/ej2-base/styles/tailwind-dark.css";
import "@syncfusion/ej2-pdfviewer/styles/tailwind-dark.css";

interface SyncfusionPDFViewerProps {
  pdfUrl: string;
  fileName: string;
}

export function SyncfusionPDFViewer({
  pdfUrl,
  fileName,
}: SyncfusionPDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        if (destroyed || !containerRef.current) return;

        // 1. Build absolute URL for the PDF
        const absolutePdfUrl = new URL(pdfUrl, window.location.origin).toString();

        // 2. Dynamic import PDF viewer module
        const pdfViewerModule = await import("@syncfusion/ej2-pdfviewer");

        const {
          PdfViewer,
          Toolbar,
          Magnification,
          Navigation,
          Annotation,
          TextSelection,
          TextSearch,
          Print,
          FormFields,
          FormDesigner,
        } = pdfViewerModule;

        if (destroyed || !containerRef.current) return;

        // 3. Inject modules
        PdfViewer.Inject(
          Toolbar,
          Magnification,
          Navigation,
          Annotation,
          TextSelection,
          TextSearch,
          Print,
          FormFields,
          FormDesigner
        );

        // 4. Create viewer with document URL
        const viewer = new PdfViewer({
          documentPath: absolutePdfUrl,
          enableToolbar: true,
          enableNavigation: true,
          enableMagnification: true,
          enableAnnotation: true,
          enableTextSelection: true,
          enableTextSearch: true,
          enablePrint: true,
          enableFormFields: true,
          height: "100%",
          width: "100%",
          resourceUrl: `https://cdn.syncfusion.com/ej2/32.2.5/dist/ej2-pdfviewer-lib`,
          documentLoad: () => {
            if (!destroyed) setIsLoading(false);
          },
          documentLoadFailed: (args: {
            errorStatusCode?: number;
            errorMessage?: string;
          }) => {
            if (!destroyed) {
              setError(args.errorMessage || "PDF konnte nicht geladen werden");
              setIsLoading(false);
            }
          },
        });

        viewerRef.current = viewer;
        viewer.appendTo(containerRef.current);
      } catch (err) {
        if (!destroyed) {
          setError(
            err instanceof Error
              ? err.message
              : "Syncfusion PDF Viewer konnte nicht initialisiert werden"
          );
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      if (viewerRef.current) {
        try {
          (viewerRef.current as { destroy(): void }).destroy();
        } catch {
          // ignore
        }
        viewerRef.current = null;
      }
    };
  }, [pdfUrl]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-destructive">
        <p className="font-medium">PDF-Viewer Fehler:</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {fileName} wird geladen…
            </span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
