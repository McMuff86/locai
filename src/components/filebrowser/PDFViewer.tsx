"use client";

import { useEffect, useState } from "react";
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

export function PDFViewer({ pdfUrl, fileName }: PDFViewerProps) {
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function checkLicense() {
      try {
        const res = await fetch("/api/pdf/license");
        const data = (await res.json()) as {
          success: boolean;
          licenseKey?: string;
        };
        if (res.ok && data.success && data.licenseKey) {
          setLicenseKey(data.licenseKey);
        }
      } catch {
        // No license → fallback
      }
      setChecked(true);
    }
    checkLicense();
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (licenseKey) {
    return (
      <SyncfusionPDFViewer
        pdfUrl={pdfUrl}
        fileName={fileName}
        licenseKey={licenseKey}
      />
    );
  }

  return <PDFViewerFallback pdfUrl={pdfUrl} fileName={fileName} />;
}
