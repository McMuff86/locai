"use client";

import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  FileCode,
  FileJson,
  FileText,
  File,
  Loader2,
  Minus,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { CanvasWindow } from '@/hooks/useFileCanvas';
import { MIN_WINDOW_SIZE } from '@/hooks/useFileCanvas';
import type { FilePreviewType } from '@/lib/filebrowser/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const syntaxTheme = oneDark as { [key: string]: CSSProperties };
const EDITABLE_TYPES: FilePreviewType[] = ['text', 'code', 'json', 'markdown'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFileIcon(extension: string) {
  if (extension === '.json') return <FileJson className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />;
  if (
    ['.ts', '.tsx', '.js', '.jsx', '.py', '.css', '.html', '.go', '.rs', '.java', '.c', '.cpp', '.rb', '.php', '.sh'].includes(
      extension,
    )
  ) {
    return <FileCode className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
  }
  if (['.md', '.txt', '.csv', '.log'].includes(extension)) {
    return <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
  }
  return <File className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
}

// ── FileContent types ─────────────────────────────────────────────────────────

interface FileContent {
  content: string;
  type: FilePreviewType;
  language: string;
  size: number;
  truncated: boolean;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileWindowProps {
  window: CanvasWindow;
  zoom: number;
  onClose: () => void;
  onBringToFront: () => void;
  onUpdatePosition: (pos: { x: number; y: number }) => void;
  onUpdateSize: (size: { w: number; h: number }) => void;
  onToggleMinimize: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FileWindow({
  window: win,
  zoom,
  onClose,
  onBringToFront,
  onUpdatePosition,
  onUpdateSize,
  onToggleMinimize,
}: FileWindowProps) {
  // ── Content loading ──────────────────────────────────────────────
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Edit state ───────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [markdownTab, setMarkdownTab] = useState<'edit' | 'preview'>('preview');

  // ── Copy state ───────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();

  // ── Drag (title bar) ─────────────────────────────────────────────
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, winX: 0, winY: 0 });

  // ── Resize (bottom-right handle) ─────────────────────────────────
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  // Stable ref to zoom so document-level handlers pick up current zoom
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Load file content ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setFileContent(null);
    setIsEditMode(false);

    const params = new URLSearchParams({
      rootId: win.rootId,
      path: win.file.relativePath,
    });

    fetch(`/api/filebrowser/read?${params}`)
      .then((r) => r.json())
      .then((data: {
        success?: boolean;
        content?: string;
        previewType?: FilePreviewType;
        language?: string;
        size?: number;
        truncated?: boolean;
        error?: string;
      }) => {
        if (cancelled) return;
        if (data.success) {
          const fc: FileContent = {
            content: data.content ?? '',
            type: data.previewType ?? 'text',
            language: data.language ?? 'text',
            size: data.size ?? 0,
            truncated: Boolean(data.truncated),
          };
          setFileContent(fc);
          setEditedContent(fc.content);
        } else {
          setLoadError(data.error ?? 'Fehler beim Laden');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Verbindungsfehler');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [win.file.relativePath, win.rootId]);

  // ── Document-level mouse events (drag + resize) ──────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const currentZoom = zoomRef.current;

      if (isDraggingRef.current) {
        const dx = (e.clientX - dragStartRef.current.mouseX) / currentZoom;
        const dy = (e.clientY - dragStartRef.current.mouseY) / currentZoom;
        onUpdatePosition({
          x: dragStartRef.current.winX + dx,
          y: dragStartRef.current.winY + dy,
        });
      }

      if (isResizingRef.current) {
        const dx = (e.clientX - resizeStartRef.current.mouseX) / currentZoom;
        const dy = (e.clientY - resizeStartRef.current.mouseY) / currentZoom;
        onUpdateSize({
          w: Math.max(MIN_WINDOW_SIZE.w, resizeStartRef.current.w + dx),
          h: Math.max(MIN_WINDOW_SIZE.h, resizeStartRef.current.h + dy),
        });
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isResizingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onUpdatePosition, onUpdateSize]);

  // ── Title bar drag start ─────────────────────────────────────────
  const handleTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onBringToFront();
      isDraggingRef.current = true;
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        winX: win.position.x,
        winY: win.position.y,
      };
    },
    [onBringToFront, win.position.x, win.position.y],
  );

  // ── Resize handle drag start ─────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        w: win.size.w,
        h: win.size.h,
      };
    },
    [win.size.w, win.size.h],
  );

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/filebrowser/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootId: win.rootId,
          path: win.file.relativePath,
          content: editedContent,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Speichern fehlgeschlagen');
      }
      setFileContent((prev) => (prev ? { ...prev, content: editedContent } : null));
      setIsEditMode(false);
      if (fileContent?.type === 'markdown') setMarkdownTab('preview');
      toast({
        title: 'Gespeichert',
        description: `"${win.file.name}" wurde gespeichert.`,
      });
    } catch (err) {
      toast({
        title: 'Speichern fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [editedContent, fileContent?.type, toast, win.file.name, win.file.relativePath, win.rootId]);

  // ── Copy ─────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    const text = isEditMode ? editedContent : (fileContent?.content ?? '');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [editedContent, fileContent?.content, isEditMode]);

  // ── Derived ───────────────────────────────────────────────────────
  const isWorkspace = win.rootId === 'workspace';
  const canEdit =
    isWorkspace &&
    fileContent !== null &&
    !fileContent.truncated &&
    EDITABLE_TYPES.includes(fileContent.type);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      data-file-window="true"
      className="absolute flex flex-col rounded-xl border border-border/60 bg-background shadow-2xl overflow-hidden"
      style={{
        left: win.position.x,
        top: win.position.y,
        width: win.size.w,
        height: win.isMinimized ? 40 : win.size.h,
        zIndex: win.zIndex,
        minWidth: MIN_WINDOW_SIZE.w,
        minHeight: win.isMinimized ? 40 : MIN_WINDOW_SIZE.h,
        // Prevent text selection on the window frame itself
        userSelect: 'none',
      }}
      onMouseDown={(e) => {
        e.stopPropagation(); // prevent canvas pan
        onBringToFront();
      }}
    >
      {/* ── Title bar ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 h-10 border-b border-border/60 bg-muted/40 flex-shrink-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleTitleMouseDown}
      >
        {getFileIcon(win.file.extension)}
        <span className="text-sm font-medium truncate flex-1 select-none">
          {win.file.name}
        </span>

        {/* macOS-style window controls */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMinimize(); }}
            className="w-3.5 h-3.5 rounded-full bg-yellow-500 hover:bg-yellow-400 flex items-center justify-center transition-colors group"
            title={win.isMinimized ? 'Wiederherstellen' : 'Minimieren'}
          >
            <Minus className="h-2 w-2 text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors group"
            title="Schließen"
          >
            <X className="h-2 w-2 text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>

      {/* ── Body (hidden when minimized) ────────────────────────── */}
      {!win.isMinimized && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* ── Toolbar ────────────────────────────────────────── */}
          {!isLoading && !loadError && fileContent && (
            <div
              className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 flex-shrink-0 bg-muted/20 flex-wrap"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ userSelect: 'none' }}
            >
              {/* Markdown edit/preview tabs */}
              {fileContent.type === 'markdown' && isEditMode && (
                <div className="flex items-center gap-0.5 mr-1">
                  <button
                    onClick={() => setMarkdownTab('edit')}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      markdownTab === 'edit'
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => setMarkdownTab('preview')}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      markdownTab === 'preview'
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    Vorschau
                  </button>
                </div>
              )}

              <div className="ml-auto flex items-center gap-1">
                {/* Edit button */}
                {canEdit && !isEditMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setEditedContent(fileContent.content);
                      setMarkdownTab('edit');
                      setIsEditMode(true);
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Bearbeiten
                  </Button>
                )}

                {/* Save / Cancel */}
                {isEditMode && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setIsEditMode(false);
                        setEditedContent(fileContent?.content ?? '');
                        if (fileContent?.type === 'markdown') setMarkdownTab('preview');
                      }}
                      disabled={isSaving}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Abbrechen
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Speichern
                    </Button>
                  </>
                )}

                {/* Copy */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={handleCopy}
                  title="Inhalt kopieren"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Content ────────────────────────────────────────── */}
          <div
            className="flex-1 min-h-0 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ userSelect: 'text' }} // Allow text selection in content
          >
            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {loadError && !isLoading && (
              <div className="flex items-center gap-2 p-4 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {loadError}
              </div>
            )}

            {fileContent && !isLoading && (
              <WindowContent
                fileContent={fileContent}
                isEditMode={isEditMode}
                editedContent={editedContent}
                onEditedContentChange={setEditedContent}
                markdownTab={markdownTab}
                isSaving={isSaving}
                rootId={win.rootId}
                relativePath={win.file.relativePath}
              />
            )}
          </div>

          {/* ── Resize handle (bottom-right corner) ─────────────── */}
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end p-1"
            onMouseDown={handleResizeMouseDown}
            onMouseUp={(e) => e.stopPropagation()}
            title="Größe anpassen"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" className="opacity-30">
              <circle cx="6" cy="2" r="1" fill="currentColor" />
              <circle cx="6" cy="6" r="1" fill="currentColor" />
              <circle cx="2" cy="6" r="1" fill="currentColor" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WindowContent ─────────────────────────────────────────────────────────────

interface WindowContentProps {
  fileContent: FileContent;
  isEditMode: boolean;
  editedContent: string;
  onEditedContentChange: (value: string) => void;
  markdownTab: 'edit' | 'preview';
  isSaving: boolean;
  rootId: string;
  relativePath: string;
}

function WindowContent({
  fileContent,
  isEditMode,
  editedContent,
  onEditedContentChange,
  markdownTab,
  isSaving,
  rootId,
  relativePath,
}: WindowContentProps) {
  const { content, type, language, truncated } = fileContent;

  return (
    <div className="h-full flex flex-col">
      {/* Truncation warning */}
      {truncated && !isEditMode && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs flex items-start gap-2 flex-shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>Vorschau auf 100 KB begrenzt. Bearbeiten nur für vollständig geladene Dateien.</span>
        </div>
      )}

      {/* ── Textarea (edit mode) ──────────────────────────────── */}
      {isEditMode && (type !== 'markdown' || markdownTab === 'edit') && (
        <div className="flex-1 p-3 min-h-0">
          <Textarea
            value={editedContent}
            onChange={(e) => onEditedContentChange(e.target.value)}
            className="h-full w-full font-mono text-[0.8125rem] resize-none bg-muted/30 border-border/60 focus:border-primary/50"
            spellCheck={false}
            disabled={isSaving}
            autoFocus
          />
        </div>
      )}

      {/* ── Markdown view-only ─────────────────────────────────── */}
      {type === 'markdown' && !isEditMode && (
        <ScrollArea className="flex-1 min-h-0 px-4 py-3">
          <MarkdownRenderer content={content} />
        </ScrollArea>
      )}

      {/* ── Markdown preview tab (during edit) ────────────────── */}
      {type === 'markdown' && isEditMode && markdownTab === 'preview' && (
        <ScrollArea className="flex-1 min-h-0 px-4 py-3">
          <MarkdownRenderer content={editedContent} />
        </ScrollArea>
      )}

      {/* ── Image preview ─────────────────────────────────────── */}
      {type === 'image' && !isEditMode && (
        <ScrollArea className="flex-1 min-h-0 p-3">
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/filebrowser/image?${new URLSearchParams({ rootId, path: relativePath })}`}
              alt={relativePath}
              className="max-w-full object-contain rounded-lg"
            />
          </div>
        </ScrollArea>
      )}

      {/* ── JSON (read-only) ──────────────────────────────────── */}
      {type === 'json' && !isEditMode && (
        <ScrollArea className="flex-1 min-h-0 p-3">
          <JsonContent content={content} />
        </ScrollArea>
      )}

      {/* ── Code (read-only) ──────────────────────────────────── */}
      {type === 'code' && !isEditMode && (
        <ScrollArea className="flex-1 min-h-0 p-3">
          <SyntaxHighlighter
            style={syntaxTheme}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '0.75rem',
              fontSize: '0.75rem',
              borderRadius: '0.5rem',
              background: 'hsl(var(--muted) / 0.5)',
            }}
          >
            {content}
          </SyntaxHighlighter>
        </ScrollArea>
      )}

      {/* ── Plain text (read-only) ─────────────────────────────── */}
      {type === 'text' && !isEditMode && (
        <ScrollArea className="flex-1 min-h-0 p-3">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 rounded-lg p-3">
            {content}
          </pre>
        </ScrollArea>
      )}

      {/* ── Binary fallback ───────────────────────────────────── */}
      {type === 'binary' && (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          Binärdatei – keine Vorschau verfügbar.
        </div>
      )}
    </div>
  );
}

function JsonContent({ content }: { content: string }) {
  try {
    const formatted = JSON.stringify(JSON.parse(content), null, 2);
    return (
      <SyntaxHighlighter
        style={syntaxTheme}
        language="json"
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '0.75rem',
          fontSize: '0.75rem',
          borderRadius: '0.5rem',
          background: 'hsl(var(--muted) / 0.5)',
        }}
      >
        {formatted}
      </SyntaxHighlighter>
    );
  } catch {
    return (
      <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
        {content}
      </pre>
    );
  }
}
