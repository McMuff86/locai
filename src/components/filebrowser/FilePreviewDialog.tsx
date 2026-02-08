"use client";

import React, { useState, CSSProperties } from 'react';
import { Download, Loader2, Copy, Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { FilePreviewType } from '@/lib/filebrowser/types';

const syntaxTheme = oneDark as { [key: string]: CSSProperties };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: {
    content: string;
    filename: string;
    type: FilePreviewType;
    language: string;
    size: number;
    truncated: boolean;
  } | null;
  isLoading: boolean;
  rootId?: string;
  relativePath?: string;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  preview,
  isLoading,
  rootId,
  relativePath,
}: FilePreviewDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    if (!rootId || !relativePath) return;
    const params = new URLSearchParams({ rootId, path: relativePath });
    window.open(`/api/filebrowser/download?${params}`, '_blank');
  };

  const handleCopy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8 gap-2">
            <div>
              <DialogTitle className="text-base">{preview?.filename ?? 'Datei'}</DialogTitle>
              <DialogDescription>
                {preview
                  ? `${formatFileSize(preview.size)}${preview.truncated ? ' • Vorschau gekürzt' : ''}`
                  : ''}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {preview && (
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Kopiert
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Kopieren
                    </>
                  )}
                </Button>
              )}
              {rootId && relativePath && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <div className="space-y-3">
              {preview.truncated && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Die Vorschau wurde auf die ersten 100KB begrenzt. Für den vollständigen Inhalt bitte herunterladen.</span>
                </div>
              )}
              <PreviewContent
                content={preview.content}
                type={preview.type}
                language={preview.language}
              />
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function PreviewContent({
  content,
  type,
  language,
}: {
  content: string;
  type: FilePreviewType;
  language: string;
}) {
  switch (type) {
    case 'markdown':
      return (
        <div className="py-2">
          <MarkdownRenderer content={content} />
        </div>
      );

    case 'json':
      try {
        const formatted = JSON.stringify(JSON.parse(content), null, 2);
        return (
          <SyntaxHighlighter
            style={syntaxTheme}
            language="json"
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.8125rem',
              borderRadius: '0.5rem',
              background: 'hsl(var(--muted) / 0.5)',
            }}
          >
            {formatted}
          </SyntaxHighlighter>
        );
      } catch {
        return <pre className="text-sm font-mono whitespace-pre-wrap p-4 bg-muted/50 rounded-lg">{content}</pre>;
      }

    case 'code':
      return (
        <SyntaxHighlighter
          style={syntaxTheme}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.8125rem',
            borderRadius: '0.5rem',
            background: 'hsl(var(--muted) / 0.5)',
          }}
        >
          {content}
        </SyntaxHighlighter>
      );

    case 'text':
    default:
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap p-4 bg-muted/50 rounded-lg break-all">
          {content}
        </pre>
      );
  }
}
