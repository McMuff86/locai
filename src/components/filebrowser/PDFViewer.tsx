"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

const PDFViewerFallback = dynamic(
  () =>
    import("./PDFViewerFallback").then((mod) => ({
      default: mod.PDFViewerFallback,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const SyncfusionPDFViewer = dynamic(
  () =>
    import("./SyncfusionPDFViewer").then((mod) => ({
      default: mod.SyncfusionPDFViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface PDFViewerProps {
  pdfUrl: string;
  rootId: string;
  relativePath: string;
  fileName: string;
}

export function PDFViewer({ pdfUrl, rootId, relativePath, fileName }: PDFViewerProps) {
  // Check if Syncfusion license key is available (client-side env var)
  const hasSyncfusion = !!process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;

  if (hasSyncfusion) {
    return (
      <SyncfusionPDFViewer 
        pdfUrl={pdfUrl} 
        fileName={fileName}
        rootId={rootId}
        relativePath={relativePath}
      />
    );
  }

  return <PDFViewerFallback pdfUrl={pdfUrl} fileName={fileName} />;
}
