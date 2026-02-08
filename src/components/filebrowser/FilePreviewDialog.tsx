"use client";

import React from 'react';
import { Download, Loader2 } from 'lucide-react';
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
  const handleDownload = () => {
    if (!rootId || !relativePath) return;
    const params = new URLSearchParams({ rootId, path: relativePath });
    window.open(`/api/filebrowser/download?${params}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="text-base">{preview?.filename ?? 'Datei'}</DialogTitle>
              <DialogDescription>
                {preview ? formatFileSize(preview.size) : ''}
              </DialogDescription>
            </div>
            {rootId && relativePath && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <PreviewContent
              content={preview.content}
              type={preview.type}
              language={preview.language}
            />
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
            style={oneDark as any}
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
          style={oneDark as any}
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
