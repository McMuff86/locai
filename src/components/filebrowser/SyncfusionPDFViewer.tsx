"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface SyncfusionPDFViewerProps {
  pdfUrl: string;
  fileName: string;
  licenseKey: string;
}

export function SyncfusionPDFViewer({
  pdfUrl,
  fileName,
  licenseKey,
}: SyncfusionPDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        // Dynamic imports to avoid SSR issues
        const [{ registerLicense }, { PdfViewer, Toolbar, Magnification, Navigation, Annotation, TextSelection, TextSearch, Print, FormFields, FormDesigner }] =
          await Promise.all([
            import("@syncfusion/ej2-base"),
            import("@syncfusion/ej2-pdfviewer"),
          ]);

        if (destroyed || !containerRef.current) return;

        // Register license
        registerLicense(licenseKey);

        // Inject required modules
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

        // Create viewer instance
        const viewer = new PdfViewer({
          documentPath: pdfUrl,
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
          // Use standalone mode (no server required)
          resourceUrl: `https://cdn.syncfusion.com/ej2/32.2.5/dist/ej2-pdfviewer-lib`,
          documentLoad: () => {
            if (!destroyed) setIsLoading(false);
          },
          documentLoadFailed: (args: { errorStatusCode?: number; errorMessage?: string }) => {
            if (!destroyed) {
              setError(args.errorMessage || "PDF konnte nicht geladen werden");
              setIsLoading(false);
            }
          },
        });

        viewerRef.current = viewer;

        // Append to container
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
          // ignore cleanup errors
        }
        viewerRef.current = null;
      }
    };
  }, [pdfUrl, licenseKey]);

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
