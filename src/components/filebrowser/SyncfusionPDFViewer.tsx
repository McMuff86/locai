"use client";

import "@/lib/syncfusion";

import "@syncfusion/ej2-base/styles/tailwind-dark.css";
import "@syncfusion/ej2-buttons/styles/tailwind-dark.css";
import "@syncfusion/ej2-dropdowns/styles/tailwind-dark.css";
import "@syncfusion/ej2-inputs/styles/tailwind-dark.css";
import "@syncfusion/ej2-navigations/styles/tailwind-dark.css";
import "@syncfusion/ej2-popups/styles/tailwind-dark.css";
import "@syncfusion/ej2-splitbuttons/styles/tailwind-dark.css";
import "@syncfusion/ej2-pdfviewer/styles/tailwind-dark.css";

import {
  PdfViewerComponent,
  Toolbar,
  Magnification,
  Navigation,
  LinkAnnotation,
  BookmarkView,
  ThumbnailView,
  Print,
  TextSelection,
  Annotation,
  TextSearch,
  FormFields,
  FormDesigner,
  Inject,
} from "@syncfusion/ej2-react-pdfviewer";

interface SyncfusionPDFViewerProps {
  pdfUrl: string;
  fileName: string;
}

export function SyncfusionPDFViewer({
  pdfUrl,
}: SyncfusionPDFViewerProps) {
  const absolutePdfUrl =
    typeof window !== "undefined"
      ? new URL(pdfUrl, window.location.origin).toString()
      : pdfUrl;

  const resourceUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/ej2-pdfviewer-lib`
      : "/ej2-pdfviewer-lib";

  return (
    <div className="h-full w-full">
      <PdfViewerComponent
        id="pdfViewer"
        documentPath={absolutePdfUrl}
        resourceUrl={resourceUrl}
        style={{ height: "100%", width: "100%" }}
      >
        <Inject
          services={[
            Toolbar,
            Magnification,
            Navigation,
            Annotation,
            LinkAnnotation,
            BookmarkView,
            ThumbnailView,
            Print,
            TextSelection,
            TextSearch,
            FormFields,
            FormDesigner,
          ]}
        />
      </PdfViewerComponent>
    </div>
  );
}
