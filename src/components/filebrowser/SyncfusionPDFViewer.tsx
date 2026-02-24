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

import React, { useRef, useCallback } from "react";
import { Download, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

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
  rootId?: string;
  relativePath?: string;
}

export function SyncfusionPDFViewer({
  pdfUrl,
  fileName,
  rootId,
  relativePath,
}: SyncfusionPDFViewerProps) {
  const pdfViewerRef = useRef<PdfViewerComponent>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const { toast } = useToast();

  const absolutePdfUrl =
    typeof window !== "undefined"
      ? new URL(pdfUrl, window.location.origin).toString()
      : pdfUrl;

  const resourceUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/ej2-pdfviewer-lib`
      : "/ej2-pdfviewer-lib";

  const saveToWorkspace = useCallback(async () => {
    if (!pdfViewerRef.current || !rootId || !relativePath) {
      toast({
        title: "Fehler",
        description: "PDF Viewer nicht verfügbar oder fehlende Parameter.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
      const newFileName = `${fileNameWithoutExt}_annotated.pdf`;

      await new Promise<void>((resolve, reject) => {
        pdfViewerRef.current?.saveAsBlob().then((blob: Blob) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64 = reader.result as string;
              const base64Data = base64.split(',')[1];
              const newPath = relativePath.replace(/\/[^\/]+$/, `/${newFileName}`);

              const response = await fetch('/api/filebrowser/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  rootId,
                  path: newPath,
                  content: base64Data,
                  encoding: 'base64',
                }),
              });

              const result = await response.json();
              if (!response.ok || !result.success) {
                throw new Error(result.error ?? 'Speichern fehlgeschlagen');
              }

              toast({
                title: "Erfolgreich gespeichert",
                description: `Annotierte PDF wurde als "${newFileName}" gespeichert.`,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error('Fehler beim Lesen der PDF'));
          reader.readAsDataURL(blob);
        }).catch(reject);
      });
    } catch (error) {
      console.error('Save to workspace error:', error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [pdfViewerRef, rootId, relativePath, fileName, toast]);

  const downloadAnnotated = useCallback(async () => {
    if (!pdfViewerRef.current) {
      toast({
        title: "Fehler",
        description: "PDF Viewer nicht verfügbar.",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    try {
      await pdfViewerRef.current.download();

      toast({
        title: "Download gestartet",
        description: "Die annotierte PDF wird heruntergeladen.",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Fehler beim Download",
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [pdfViewerRef, toast]);

  const canSaveToWorkspace = rootId === 'workspace' && relativePath;

  return (
    <div className="h-full w-full flex flex-col">
      {/* Annotation Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/15 flex-shrink-0">
        <span className="text-xs text-muted-foreground font-medium mr-2">
          PDF Annotationen:
        </span>

        {canSaveToWorkspace && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={saveToWorkspace}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            In Workspace speichern
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={downloadAnnotated}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Download className="h-3 w-3 mr-1" />
          )}
          Herunterladen
        </Button>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 min-h-0">
        <PdfViewerComponent
          ref={pdfViewerRef}
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
    </div>
  );
}
