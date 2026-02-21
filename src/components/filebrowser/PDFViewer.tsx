"use client";

import '@syncfusion/ej2-base/styles/material.css';
import '@syncfusion/ej2-pdfviewer/styles/material.css';

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { PDFEngine } from '@mcmuff86/pdf-core';

interface PDFViewerProps {
  pdfUrl: string;
  rootId: string;
  relativePath: string;
  fileName: string;
}

export function PDFViewer({ pdfUrl, fileName }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PDFEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function initViewer() {
      try {
        // 1. Fetch license key from server
        const licenseRes = await fetch('/api/pdf/license');
        const licenseData = await licenseRes.json() as {
          success: boolean;
          licenseKey?: string;
          error?: string;
        };

        if (!licenseRes.ok || !licenseData.success) {
          setError(licenseData.error ?? 'License Key nicht verfügbar');
          setIsLoading(false);
          return;
        }

        if (destroyed || !containerRef.current) return;

        // 2. Dynamic import pdf-core (client-only, needs DOM)
        const { createPDFEngine, registerSyncfusionLicense } = await import(
          '@mcmuff86/pdf-core'
        );

        if (destroyed) return;

        // 3. Register license & create engine
        registerSyncfusionLicense(licenseData.licenseKey);
        const engine = createPDFEngine('syncfusion');
        engineRef.current = engine;

        // 4. Initialize with container
        await engine.init({
          container: containerRef.current,
          licenseKey: licenseData.licenseKey,
          showToolbar: true,
          enableAnnotations: true,
          enableTextSelection: true,
        });

        if (destroyed) {
          engine.destroy();
          engineRef.current = null;
          return;
        }

        // 5. Load document via URL
        await engine.loadDocument(pdfUrl);

        if (destroyed) {
          engine.destroy();
          engineRef.current = null;
          return;
        }

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

    initViewer();

    return () => {
      destroyed = true;
      if (engineRef.current) {
        try {
          engineRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        engineRef.current = null;
      }
    };
  }, [pdfUrl]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <div>
          <p className="font-medium">PDF-Viewer Fehler</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
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
