"use client";

import React, { useState, CSSProperties, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download, Loader2, Copy, Check, AlertTriangle, Bot, Files,
  Pencil, X as XIcon, Save,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { FilePreviewType } from '@/lib/filebrowser/types';
import { WaveformPlayer } from '@/components/audio/WaveformPlayer';

const syntaxTheme = oneDark as { [key: string]: CSSProperties };
const OPEN_FILE_IN_AGENT_SESSION_KEY = 'openFileInAgent';
const AGENT_PREVIEW_SNIPPET_LIMIT = 4000;

// Preview types that support in-dialog editing
const EDITABLE_TYPES: FilePreviewType[] = ['text', 'code', 'json', 'markdown', 'svg'];

interface OpenFileInAgentPayload {
  rootId: string;
  relativePath: string;
  filename: string;
  previewSnippet: string;
  previewTruncated: boolean;
}

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
  /** Called after a successful save so the parent can refresh */
  onSaved?: () => void;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  preview,
  isLoading,
  rootId,
  relativePath,
  onSaved,
}: FilePreviewDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ── Action states ──────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [isOpeningInAgent, setIsOpeningInAgent] = useState(false);
  const [isAddingToRag, setIsAddingToRag] = useState(false);

  // ── Edit mode ──────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // For markdown: switch between raw-edit and rendered-preview
  const [markdownTab, setMarkdownTab] = useState<'edit' | 'preview'>('preview');

  const isWorkspace = rootId === 'workspace';
  const canEdit =
    isWorkspace &&
    !preview?.truncated &&
    preview != null &&
    EDITABLE_TYPES.includes(preview.type);

  // Reset edit state whenever the dialog opens a new file
  useEffect(() => {
    if (open) {
      setIsEditMode(false);
      setEditedContent(preview?.content ?? '');
      setMarkdownTab('preview');
    }
  }, [open, preview?.content]);

  // ── Handlers ───────────────────────────────────────────────────

  const handleDownload = () => {
    if (!rootId || !relativePath) return;
    const params = new URLSearchParams({ rootId, path: relativePath });
    window.open(`/api/filebrowser/download?${params}`, '_blank');
  };

  const handleCopy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(
        isEditMode ? editedContent : preview.content,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenInAgent = () => {
    if (!preview || !rootId || !relativePath) return;
    setIsOpeningInAgent(true);
    try {
      const payload: OpenFileInAgentPayload = {
        rootId,
        relativePath,
        filename: preview.filename,
        previewSnippet: preview.content.slice(0, AGENT_PREVIEW_SNIPPET_LIMIT),
        previewTruncated:
          preview.truncated || preview.content.length > AGENT_PREVIEW_SNIPPET_LIMIT,
      };
      sessionStorage.setItem(OPEN_FILE_IN_AGENT_SESSION_KEY, JSON.stringify(payload));
      onOpenChange(false);
      router.push('/chat?openFileInAgent=true');
    } catch {
      toast({
        title: 'Open in Agent fehlgeschlagen',
        description: 'Dateikontext konnte nicht an den Chat übergeben werden.',
        variant: 'destructive',
      });
    } finally {
      setIsOpeningInAgent(false);
    }
  };

  const handleAddToRag = async () => {
    if (!preview || !rootId || !relativePath) return;
    setIsAddingToRag(true);
    try {
      const params = new URLSearchParams({ rootId, path: relativePath });
      const downloadRes = await fetch(`/api/filebrowser/download?${params}`);
      if (!downloadRes.ok) {
        const errorPayload = await downloadRes.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorPayload?.error || 'Datei konnte nicht gelesen werden');
      }
      const blob = await downloadRes.blob();
      const file = new File([blob], preview.filename, { type: blob.type || 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      const uploadPayload = await uploadRes.json().catch(() => ({ error: 'Upload fehlgeschlagen' })) as { success?: boolean; error?: string };
      if (!uploadRes.ok || !uploadPayload.success) {
        const message = uploadPayload.error || 'Upload fehlgeschlagen';
        if (uploadRes.status === 409) {
          toast({ title: 'Bereits als RAG-Dokument vorhanden', description: message });
          return;
        }
        throw new Error(message);
      }
      toast({ title: 'Zu RAG hinzugefügt', description: `"${preview.filename}" wird jetzt indexiert.` });
    } catch (err) {
      toast({
        title: 'Add to RAG fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    } finally {
      setIsAddingToRag(false);
    }
  };

  const handleStartEdit = () => {
    setEditedContent(preview?.content ?? '');
    setMarkdownTab('edit');
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedContent(preview?.content ?? '');
    if (preview?.type === 'markdown') setMarkdownTab('preview');
  };

  const handleSave = async () => {
    if (!rootId || !relativePath) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/filebrowser/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootId, path: relativePath, content: editedContent }),
      });
      const payload = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Speichern fehlgeschlagen');
      }
      toast({ title: 'Gespeichert', description: `"${preview?.filename}" wurde erfolgreich gespeichert.` });
      setIsEditMode(false);
      if (preview?.type === 'markdown') setMarkdownTab('preview');
      onSaved?.();
    } catch (err) {
      toast({
        title: 'Speichern fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSaving) onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* ── Header ────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 pr-8">
            {/* File info */}
            <div className="min-w-0">
              <DialogTitle className="text-base truncate">{preview?.filename ?? 'Datei'}</DialogTitle>
              <DialogDescription className="text-xs">
                {preview
                  ? `${formatFileSize(preview.size)}${preview.truncated ? ' • Vorschau gekürzt' : ''}${isEditMode ? ' • Bearbeiten' : ''}`
                  : ''}
              </DialogDescription>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
              {/* Edit / Save / Cancel */}
              {canEdit && !isEditMode && (
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Bearbeiten
                </Button>
              )}
              {isEditMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <XIcon className="h-3.5 w-3.5 mr-1.5" />
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Speichern
                  </Button>
                </>
              )}

              {/* Open in Agent */}
              {preview && rootId && relativePath && !isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInAgent}
                  disabled={isOpeningInAgent || isAddingToRag}
                >
                  {isOpeningInAgent ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Open in Agent
                </Button>
              )}

              {/* Add to RAG */}
              {preview && rootId && relativePath && !isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddToRag}
                  disabled={isAddingToRag || isOpeningInAgent}
                >
                  {isAddingToRag ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Files className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Add to RAG
                </Button>
              )}

              {/* Copy */}
              {preview && !isEditMode && (
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 mr-1.5" />Kopiert</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1.5" />Kopieren</>
                  )}
                </Button>
              )}

              {/* Download */}
              {rootId && relativePath && !isEditMode && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
              )}
            </div>
          </div>

          {/* Markdown view toggle tabs */}
          {preview?.type === 'markdown' && (isEditMode || markdownTab === 'edit') && (
            <div className="flex items-center gap-1 mt-3">
              <button
                onClick={() => setMarkdownTab('edit')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  markdownTab === 'edit'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Bearbeiten
              </button>
              <button
                onClick={() => setMarkdownTab('preview')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  markdownTab === 'preview'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Vorschau
              </button>
            </div>
          )}
        </DialogHeader>

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <div className="h-full flex flex-col">
              {preview.truncated && !isEditMode && (
                <div className="mx-6 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-xs flex items-start gap-2 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Die Vorschau wurde auf die ersten 100 KB begrenzt. Für den vollständigen Inhalt bitte herunterladen. Bearbeiten ist nur für vollständig geladene Dateien möglich.
                  </span>
                </div>
              )}

              {/* ── Edit mode: textarea ──────────────────────── */}
              {isEditMode && (preview.type !== 'markdown' || markdownTab === 'edit') && (
                <div className="flex-1 p-4 min-h-0">
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="h-full w-full font-mono text-[0.8125rem] resize-none bg-muted/30 border-border/60 focus:border-primary/50"
                    spellCheck={false}
                    disabled={isSaving}
                    autoFocus
                  />
                </div>
              )}

              {/* ── Markdown preview tab ─────────────────────── */}
              {preview.type === 'markdown' && (isEditMode ? markdownTab === 'preview' : true) && !isEditMode && (
                <ScrollArea className="flex-1 min-h-0 px-6 py-4">
                  <MarkdownRenderer content={preview.content} />
                </ScrollArea>
              )}
              {preview.type === 'markdown' && isEditMode && markdownTab === 'preview' && (
                <ScrollArea className="flex-1 min-h-0 px-6 py-4">
                  <MarkdownRenderer content={editedContent} />
                </ScrollArea>
              )}

              {/* ── Read-only preview (non-edit mode, non-markdown) ── */}
              {!isEditMode && preview.type !== 'markdown' && (
                <ScrollArea className="flex-1 min-h-0 px-6 py-3">
                  <PreviewContent
                    content={preview.content}
                    type={preview.type}
                    language={preview.language}
                    rootId={rootId}
                    relativePath={relativePath}
                  />
                </ScrollArea>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewContent({
  content,
  type,
  language,
  rootId,
  relativePath,
}: {
  content: string;
  type: FilePreviewType;
  language: string;
  rootId?: string;
  relativePath?: string;
}) {
  switch (type) {
    case 'image': {
      if (!rootId || !relativePath) {
        return (
          <p className="text-sm text-muted-foreground p-4">
            Bildvorschau nicht verfügbar (fehlende Pfadangaben).
          </p>
        );
      }
      const params = new URLSearchParams({ rootId, path: relativePath });
      const imageUrl = `/api/filebrowser/image?${params}`;
      return (
        <div className="flex items-center justify-center py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={relativePath}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      );
    }

    case 'audio': {
      if (!rootId || !relativePath) {
        return (
          <p className="text-sm text-muted-foreground p-4">
            Audiovorschau nicht verfügbar (fehlende Pfadangaben).
          </p>
        );
      }
      const audioParams = new URLSearchParams({ rootId, path: relativePath });
      const audioUrl = `/api/filebrowser/audio?${audioParams}`;
      return (
        <div className="py-4 px-2">
          <WaveformPlayer
            src={audioUrl}
            title={relativePath.split('/').pop() || 'Audio'}
            downloadable={false}
          />
        </div>
      );
    }

    case 'svg':
      return (
        <div className="flex items-center justify-center py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`}
            alt="SVG Preview"
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
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
