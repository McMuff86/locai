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
  WrapText,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { CanvasWindow } from '@/hooks/useFileCanvas';
import { MIN_WINDOW_SIZE } from '@/hooks/useFileCanvas';
import dynamic from 'next/dynamic';
import type { FilePreviewType } from '@/lib/filebrowser/types';
import { ImageEditor } from './ImageEditor';

const PDFViewer = dynamic(
  () => import('./PDFViewer').then(mod => ({ default: mod.PDFViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

// ── Constants ─────────────────────────────────────────────────────────────────

const syntaxTheme = oneDark as { [key: string]: CSSProperties };
const EDITABLE_TYPES: FilePreviewType[] = ['text', 'code', 'json', 'markdown'];
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 24;

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
  if (extension === '.pdf') return <FileText className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
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

  // ── Editor feature state ─────────────────────────────────────────
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  // ── Image editor state ────────────────────────────────────────────
  const [imageEditMode, setImageEditMode] = useState(false);

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

  const hasUnsavedChanges = isEditMode && editedContent !== (fileContent?.content ?? '');

  // ── Font size helpers ─────────────────────────────────────────────
  const increaseFontSize = useCallback(() => {
    setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 1));
  }, []);
  const decreaseFontSize = useCallback(() => {
    setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 1));
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      data-file-window="true"
      className="absolute flex flex-col rounded-xl border border-border/40 bg-background/95 backdrop-blur-sm shadow-2xl overflow-hidden ring-1 ring-black/[0.03] dark:ring-white/[0.03]"
      style={{
        left: win.position.x,
        top: win.position.y,
        width: win.size.w,
        height: win.isMinimized ? 38 : win.size.h,
        zIndex: win.zIndex,
        minWidth: MIN_WINDOW_SIZE.w,
        minHeight: win.isMinimized ? 38 : MIN_WINDOW_SIZE.h,
        userSelect: 'none',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onBringToFront();
      }}
    >
      {/* ── Title bar ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 h-[38px] border-b border-border/40 bg-muted/30 flex-shrink-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleTitleMouseDown}
      >
        {getFileIcon(win.file.extension)}
        <span className="text-xs font-medium truncate flex-1 select-none">
          {win.file.name}
        </span>

        {/* Unsaved indicator (amber dot) */}
        {hasUnsavedChanges && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 animate-pulse"
            title="Ungespeicherte Änderungen"
          />
        )}

        {/* macOS-style window controls */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMinimize(); }}
            className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 flex items-center justify-center transition-colors group"
            title={win.isMinimized ? 'Wiederherstellen' : 'Minimieren'}
          >
            <Minus className="h-1.5 w-1.5 text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors group"
            title="Schließen"
          >
            <X className="h-1.5 w-1.5 text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>

      {/* ── Body (hidden when minimized) ────────────────────────── */}
      {!win.isMinimized && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* ── Toolbar ────────────────────────────────────────── */}
          {!isLoading && !loadError && fileContent && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 border-b border-border/30 flex-shrink-0 bg-muted/15 flex-wrap"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ userSelect: 'none' }}
            >
              {/* Markdown edit/preview tabs */}
              {fileContent.type === 'markdown' && isEditMode && (
                <div className="flex items-center gap-0.5 mr-1 rounded-md bg-muted/40 p-0.5">
                  <button
                    onClick={() => setMarkdownTab('edit')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      markdownTab === 'edit'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => setMarkdownTab('preview')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      markdownTab === 'preview'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Vorschau
                  </button>
                </div>
              )}

              {/* ── Editor feature controls (edit mode only) ─────── */}
              {isEditMode && (
                <div className="flex items-center gap-0.5">
                  <Button
                    variant={wordWrap ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 px-1.5 text-[11px] rounded-md"
                    onClick={() => setWordWrap((w) => !w)}
                    title={wordWrap ? 'Zeilenumbruch AUS' : 'Zeilenumbruch AN'}
                  >
                    <WrapText className="h-3 w-3" />
                  </Button>

                  <div className="flex items-center gap-0 ml-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-md"
                      onClick={decreaseFontSize}
                      disabled={fontSize <= MIN_FONT_SIZE}
                      title="Schrift kleiner"
                    >
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground/70 font-mono w-5 text-center select-none">
                      {fontSize}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-md"
                      onClick={increaseFontSize}
                      disabled={fontSize >= MAX_FONT_SIZE}
                      title="Schrift größer"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="ml-auto flex items-center gap-0.5">
                {fileContent.type === 'image' && (
                  <Button
                    variant={imageEditMode ? 'default' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-[11px] rounded-md"
                    onClick={() => setImageEditMode(!imageEditMode)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    {imageEditMode ? 'Ansicht' : 'Bearbeiten'}
                  </Button>
                )}

                {canEdit && !isEditMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] rounded-md"
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

                {isEditMode && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] rounded-md"
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
                      className="h-6 px-2 text-[11px] rounded-md"
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

                <div className="w-px h-4 bg-border/30 mx-0.5" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] rounded-md"
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
            style={{ userSelect: 'text' }}
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
                fileName={win.file.name}
                wordWrap={wordWrap}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
                imageEditMode={imageEditMode}
              />
            )}
          </div>

          {/* ── Resize handle (bottom-right corner) ─────────────── */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 flex items-end justify-end p-0.5 opacity-20 hover:opacity-50 transition-opacity"
            onMouseDown={handleResizeMouseDown}
            onMouseUp={(e) => e.stopPropagation()}
            title="Größe anpassen"
          >
            <svg width="7" height="7" viewBox="0 0 7 7">
              <path d="M5.5 1L1 5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <path d="M5.5 3.5L3.5 5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
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
  fileName: string;
  wordWrap: boolean;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  imageEditMode: boolean;
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
  fileName,
  wordWrap,
  fontSize,
  onFontSizeChange,
  imageEditMode,
}: WindowContentProps) {
  const { content, type, language, truncated } = fileContent;

  // ── Refs for editor (line numbers + textarea scroll sync) ─────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // ── Computed text stats (for status bar) ──────────────────────────
  const lineCount = editedContent ? editedContent.split('\n').length : 1;
  const charCount = editedContent.length;
  const wordCount = editedContent.trim() === '' ? 0 : editedContent.trim().split(/\s+/).length;
  const wsCount = (editedContent.match(/\s/g) ?? []).length;

  // ── Dynamic line number column width ──────────────────────────────
  const lineNumWidth =
    lineCount >= 10000 ? '4rem' :
    lineCount >= 1000  ? '3.25rem' :
    lineCount >= 100   ? '2.75rem' : '2.25rem';

  // ── Scroll sync: textarea scroll → line numbers ───────────────────
  const syncScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // ── Keyboard handler for the editor textarea ──────────────────────
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = textareaRef.current;

      // ── Font size zoom: Ctrl+Plus / Ctrl+Minus ──────────────────
      if (e.ctrlKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          onFontSizeChange(Math.min(MAX_FONT_SIZE, fontSize + 1));
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          onFontSizeChange(Math.max(MIN_FONT_SIZE, fontSize - 1));
          return;
        }
      }

      // ── Tab / Shift+Tab: indent / unindent ───────────────────────
      if (e.key === 'Tab' && ta) {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;

        if (e.shiftKey) {
          // Shift+Tab: remove up to 2 spaces from the start of the current line
          const lineStart = editedContent.lastIndexOf('\n', start - 1) + 1;
          const linePrefix = editedContent.slice(lineStart, start);
          const spacesToRemove = linePrefix.match(/^ {1,2}/)?.[0].length ?? 0;
          if (spacesToRemove > 0) {
            const newContent =
              editedContent.slice(0, lineStart) +
              editedContent.slice(lineStart + spacesToRemove);
            onEditedContentChange(newContent);
            requestAnimationFrame(() => {
              if (ta) {
                const newPos = Math.max(lineStart, start - spacesToRemove);
                ta.selectionStart = newPos;
                ta.selectionEnd = newPos;
              }
            });
          }
        } else {
          // Tab: insert 2 spaces at cursor (replace selection)
          const newContent =
            editedContent.slice(0, start) + '  ' + editedContent.slice(end);
          onEditedContentChange(newContent);
          requestAnimationFrame(() => {
            if (ta) {
              ta.selectionStart = start + 2;
              ta.selectionEnd = start + 2;
            }
          });
        }
      }
    },
    [editedContent, fontSize, onEditedContentChange, onFontSizeChange],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Truncation warning */}
      {truncated && !isEditMode && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs flex items-start gap-2 flex-shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>Vorschau auf 100 KB begrenzt. Bearbeiten nur für vollständig geladene Dateien.</span>
        </div>
      )}

      {/* ── Edit Mode: line numbers + textarea + status bar ──────── */}
      {isEditMode && (type !== 'markdown' || markdownTab === 'edit') && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Line numbers + Textarea row */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Line numbers column */}
            <div
              ref={lineNumbersRef}
              aria-hidden
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: `${fontSize}px`,
                lineHeight: '1.5rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                paddingRight: '0.5rem',
                paddingLeft: '0.375rem',
                width: lineNumWidth,
                flexShrink: 0,
                overflowY: 'hidden',
                overflowX: 'hidden',
                textAlign: 'right',
                userSelect: 'none',
                color: 'hsl(var(--muted-foreground))',
                backgroundColor: 'hsl(var(--muted) / 0.25)',
                borderRight: '1px solid hsl(var(--border) / 0.4)',
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1} style={{ lineHeight: '1.5rem' }}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => onEditedContentChange(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              onScroll={syncScroll}
              className="flex-1 font-mono bg-muted/30 text-foreground border-0 outline-none focus:outline-none resize-none"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: `${fontSize}px`,
                lineHeight: '1.5rem',
                padding: '0.5rem 0.75rem',
                overflowX: wordWrap ? 'hidden' : 'auto',
                overflowY: 'auto',
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                wordWrap: wordWrap ? 'break-word' : 'normal',
                minHeight: 0,
                height: '100%',
              }}
              spellCheck={false}
              disabled={isSaving}
              autoFocus
            />
          </div>

          {/* Status bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-0.5 border-t border-border/30 bg-muted/20">
            <span className="text-xs text-muted-foreground font-mono">
              {'Zeichen:\u00a0'}{charCount}{'\u00a0|\u00a0'}
              {'W\u00f6rter:\u00a0'}{wordCount}{'\u00a0|\u00a0'}
              {'Zeilen:\u00a0'}{lineCount}{'\u00a0|\u00a0'}
              {'Whitespace:\u00a0'}{wsCount}
            </span>
            {!wordWrap && (
              <span className="text-[10px] text-muted-foreground/60 select-none">
                Kein Umbruch
              </span>
            )}
          </div>
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

      {/* ── Image preview / editor ────────────────────────────── */}
      {type === 'image' && !isEditMode && !imageEditMode && (
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

      {type === 'image' && imageEditMode && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ImageEditor
            imageUrl={`/api/filebrowser/image?${new URLSearchParams({ rootId, path: relativePath })}`}
            rootId={rootId}
            relativePath={relativePath}
            fileName={fileName}
          />
        </div>
      )}

      {/* ── PDF viewer ────────────────────────────────────────── */}
      {type === 'pdf' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <PDFViewer
            pdfUrl={`/api/filebrowser/pdf?${new URLSearchParams({ rootId, path: relativePath })}`}
            rootId={rootId}
            relativePath={relativePath}
            fileName={fileName}
          />
        </div>
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
