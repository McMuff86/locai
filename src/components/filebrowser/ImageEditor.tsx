"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  History,
  Layers,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useImageEditor } from '@/hooks/useImageEditor';
import { ImageToolbar } from './ImageToolbar';
import type { ImageTool, CropRect, AdjustSettings } from '@/hooks/useImageEditor';
import type {
  ImageEditorProps,
  Point,
  TextLayer,
  ShapeLayer,
  AdjustmentLayer,
  AdjustmentType,
  SceneLayer,
  HistoryEntry,
  TransformBounds,
} from './image-editor/types';
import { TEXT_LINE_HEIGHT } from './image-editor/types';
import {
  uid,
  toDataUrlSafe,
  cloneTextLayers,
  cloneShapeLayers,
  cloneAdjustmentLayers,
  drawShape,
  drawTextLineWithTracking,
  getTextMetricsForLayer,
  getShapeBounds,
  drawShapeLayer,
  drawTextLayer,
  applyAdjustmentLayerToCanvas,
  applySharpen,
  boxBlur,
  createSelectionMask,
  extractSelectionEdges,
  renderCachedMarchingAnts,
  floodFillSelection,
  healBrushDab,
  cloneStampDab,
  spotRemoveDab,
} from './image-editor/utils';
import type { EdgeSegment } from './image-editor/utils';

// ── Component ─────────────────────────────────────────────────────────────────

export function ImageEditor({ imageUrl, rootId, relativePath, fileName }: ImageEditorProps) {
  const editor = useImageEditor();
  const { toast } = useToast();

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [comfyAvailable, setComfyAvailable] = useState(false);

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });

  // Crop state
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const isCroppingRef = useRef(false);

  // Dialogs
  const [showResize, setShowResize] = useState(false);
  const [resizeW, setResizeW] = useState(0);
  const [resizeH, setResizeH] = useState(0);
  const [resizeLock, setResizeLock] = useState(true);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [exportQuality, setExportQuality] = useState(92);

  // AI panels
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [aiEditDenoise, setAiEditDenoise] = useState(0.6);
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditWorkflows, setAiEditWorkflows] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  // Text overlay state
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const lastClickTimeRef = useRef(0);
  const lastClickLayerRef = useRef<string | null>(null);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [shapeLayers, setShapeLayers] = useState<ShapeLayer[]>([]);
  const [adjustmentLayers, setAdjustmentLayers] = useState<AdjustmentLayer[]>([]);
  const [layerOrder, setLayerOrder] = useState<string[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [activePanelTab, setActivePanelTab] = useState('layers');
  const [panelPos, setPanelPos] = useState<Record<string, number>>({ right: 8, top: 8 });
  const [panelDocked, setPanelDocked] = useState<'right' | 'left' | null>('right');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelDragging = useRef(false);
  const panelDragOffset = useRef({ x: 0, y: 0 });
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [pixelSnap, setPixelSnap] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  const [guides, setGuides] = useState<Array<{ id: string; axis: 'x' | 'y'; value: number }>>([]);
  const [smartGuide, setSmartGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [maskMode, setMaskMode] = useState(false);
  const maskCanvasesRef = useRef<Record<string, HTMLCanvasElement>>({});

  const isDraggingLayerRef = useRef(false);
  const draggingLayerIdRef = useRef<string | null>(null);
  const layerDragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const layerMoveChangedRef = useRef(false);

  const transformModeRef = useRef<null | 'nw' | 'ne' | 'sw' | 'se' | 'rotate'>(null);
  const transformLayerIdRef = useRef<string | null>(null);
  const transformStartRef = useRef<Point>({ x: 0, y: 0 });
  const transformInitialBoundsRef = useRef<TransformBounds | null>(null);
  const transformInitialLayerRef = useRef<TextLayer | ShapeLayer | null>(null);

  const isSpaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panScrollRef = useRef<Point>({ x: 0, y: 0 });

  const aspectRef = useRef(1);

  // Selection state
  const selectionMaskRef = useRef<ImageData | null>(null);
  const selectionBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const marchingAntsOffsetRef = useRef(0);
  const marchingAntsAnimRef = useRef<number | null>(null);
  const selectionEdgesRef = useRef<EdgeSegment[]>([]);
  const lassoPointsRef = useRef<Point[]>([]);
  const marqueeStartRef = useRef<Point | null>(null);
  const clipboardCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Source-point state (healing / clone stamp)
  const sourcePointRef = useRef<Point | null>(null);
  const sourceOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const hasSourceRef = useRef(false);

  // ── Load image ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setImageLoaded(false);
    setImageLoadError(null);
    setTextLayers([]);
    setShapeLayers([]);
    setAdjustmentLayers([]);
    setLayerOrder([]);
    setActiveLayerId(null);
    setTextPos(null);
    setGuides([]);
    setSmartGuide({ x: null, y: null });
    setHistoryEntries([]);
    setHistoryIndex(-1);
    maskCanvasesRef.current = {};

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        setDimensions({ w: img.width, h: img.height });
        setResizeW(img.width);
        setResizeH(img.height);
        aspectRef.current = img.width / img.height;

        try {
          editor.setOriginal(canvas.toDataURL('image/png'));
        } catch (err) {
          console.warn('[ImageEditor] Could not store original image snapshot:', err);
        }

        if (containerRef.current) {
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          const z = Math.min(1, cw / img.width, ch / img.height);
          setZoom(z);
        }

        const initialEntry: HistoryEntry = {
          id: uid('history'),
          label: 'Initialzustand',
          createdAt: Date.now(),
          bitmapDataUrl: toDataUrlSafe(canvas),
          textLayers: [],
          shapeLayers: [],
          adjustmentLayers: [],
          layerOrder: [],
        };
        setHistoryEntries([initialEntry]);
        setHistoryIndex(0);

        setImageLoaded(true);
      } catch (err) {
        console.error('[ImageEditor] Failed to draw loaded image:', err);
        setImageLoadError('Bild konnte nicht im Editor gerendert werden.');
      }
    };
    img.onerror = () => {
      setImageLoadError('Bild konnte nicht geladen werden.');
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // ── Check ComfyUI ───────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/comfyui/status')
      .then(r => r.json())
      .then(d => setComfyAvailable(d.running === true))
      .catch(() => setComfyAvailable(false));
  }, []);

  const getLayerNamePrefix = useCallback((kind: SceneLayer['kind']) => {
    if (kind === 'text') return 'Text';
    if (kind === 'shape') return 'Shape';
    return 'Adjust';
  }, []);

  const pushHistory = useCallback((label: string) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;

    const entry: HistoryEntry = {
      id: uid('history'),
      label,
      createdAt: Date.now(),
      bitmapDataUrl: toDataUrlSafe(canvas),
      textLayers: cloneTextLayers(textLayers),
      shapeLayers: cloneShapeLayers(shapeLayers),
      adjustmentLayers: cloneAdjustmentLayers(adjustmentLayers),
      layerOrder: [...layerOrder],
    };

    setHistoryEntries((prev) => {
      const trimmed = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : prev;
      const next = [...trimmed, entry];
      if (next.length > 60) {
        return next.slice(next.length - 60);
      }
      return next;
    });
    setHistoryIndex((prev) => {
      if (prev < 0) return 0;
      return Math.min(prev + 1, 59);
    });
    editor.setIsDirty(true);
  }, [editor, textLayers, shapeLayers, adjustmentLayers, layerOrder, historyIndex]);

  const restoreHistoryEntry = useCallback((entry: HistoryEntry) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setDimensions({ w: img.width, h: img.height });
      setResizeW(img.width);
      setResizeH(img.height);
      setTextLayers(cloneTextLayers(entry.textLayers));
      setShapeLayers(cloneShapeLayers(entry.shapeLayers));
      setAdjustmentLayers(cloneAdjustmentLayers(entry.adjustmentLayers));
      setLayerOrder([...entry.layerOrder]);
      setActiveLayerId(null);
      setTextPos(null);
      setSmartGuide({ x: null, y: null });
      editor.setIsDirty(true);
    };
    img.src = entry.bitmapDataUrl;
  }, [editor]);

  const jumpToHistory = useCallback((index: number) => {
    if (index < 0 || index >= historyEntries.length) return;
    const entry = historyEntries[index];
    restoreHistoryEntry(entry);
    setHistoryIndex(index);
  }, [historyEntries, restoreHistoryEntry]);

  const undoFromHistory = useCallback(() => {
    if (historyIndex <= 0) return;
    jumpToHistory(historyIndex - 1);
  }, [historyIndex, jumpToHistory]);

  const redoFromHistory = useCallback(() => {
    if (historyIndex < 0 || historyIndex >= historyEntries.length - 1) return;
    jumpToHistory(historyIndex + 1);
  }, [historyEntries.length, historyIndex, jumpToHistory]);

  const getFilterString = useCallback(() => {
    const ordered = [...adjustmentLayers].filter((layer) => layer.enabled && layer.visible);
    const parts: string[] = [];
    for (const layer of ordered) {
      if (layer.adjustmentType === 'brightness') parts.push(`brightness(${1 + layer.value / 100})`);
      if (layer.adjustmentType === 'contrast') parts.push(`contrast(${1 + layer.value / 100})`);
      if (layer.adjustmentType === 'saturation') parts.push(`saturate(${layer.value / 100})`);
      if (layer.adjustmentType === 'blur' && layer.value > 0) parts.push(`blur(${layer.value}px)`);
      if (layer.adjustmentType === 'grayscale' && layer.value > 0) parts.push('grayscale(1)');
      if (layer.adjustmentType === 'sepia' && layer.value > 0) parts.push('sepia(1)');
      if (layer.adjustmentType === 'invert' && layer.value > 0) parts.push('invert(1)');
    }
    return parts.join(' ') || 'none';
  }, [adjustmentLayers]);

  const addAdjustmentLayer = useCallback((adjustmentType: AdjustmentType) => {
    const defaults: Record<AdjustmentType, number> = {
      brightness: 0,
      contrast: 0,
      saturation: 100,
      blur: 0,
      sharpen: 0,
      grayscale: 100,
      sepia: 100,
      invert: 100,
    };
    const layer: AdjustmentLayer = {
      id: uid('adj'),
      kind: 'adjustment',
      name: `${getLayerNamePrefix('adjustment')} ${adjustmentLayers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      adjustmentType,
      enabled: true,
      value: defaults[adjustmentType],
    };
    setAdjustmentLayers((prev) => [...prev, layer]);
    setLayerOrder((prev) => [...prev, layer.id]);
    setActiveLayerId(layer.id);
    pushHistory(`Adjustment: ${adjustmentType}`);
  }, [adjustmentLayers.length, getLayerNamePrefix, pushHistory]);

  // ── Apply adjustments permanently ───────────────────────────────
  const applyAdjustments = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tctx = temp.getContext('2d');
    if (!tctx) return;

    tctx.drawImage(canvas, 0, 0);
    for (const layer of adjustmentLayers) {
      applyAdjustmentLayerToCanvas(temp, layer);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0);

    setAdjustmentLayers([]);
    editor.resetAdjustments();
    pushHistory('Adjustments angewendet');
    setDimensions({ w: canvas.width, h: canvas.height });
  }, [adjustmentLayers, editor, pushHistory]);

  // ── Rotate ──────────────────────────────────────────────────────
  const handleRotate = useCallback((deg: number) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const historyCtx = canvas.getContext('2d');
    if (!historyCtx) return;
    const oldW = canvas.width;
    const oldH = canvas.height;

    const temp = document.createElement('canvas');
    const tctx = temp.getContext('2d')!;
    const rad = (deg * Math.PI) / 180;
    const absDeg = Math.abs(deg % 360);

    if (absDeg === 90 || absDeg === 270) {
      temp.width = canvas.height;
      temp.height = canvas.width;
    } else {
      temp.width = canvas.width;
      temp.height = canvas.height;
    }

    tctx.translate(temp.width / 2, temp.height / 2);
    tctx.rotate(rad);
    tctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    canvas.width = temp.width;
    canvas.height = temp.height;
    ctx.drawImage(temp, 0, 0);

    const normalized = ((deg % 360) + 360) % 360;
    setTextLayers(prev => prev.map((layer) => {
      const bounds = getTextMetricsForLayer(historyCtx, layer);

      if (normalized === 90) {
        return { ...layer, x: oldH - bounds.y - bounds.height, y: bounds.x, rotation: layer.rotation + 90 };
      }
      if (normalized === 270) {
        return { ...layer, x: bounds.y, y: oldW - bounds.x - bounds.width, rotation: layer.rotation - 90 };
      }
      if (normalized === 180) {
        return {
          ...layer,
          x: oldW - bounds.x - bounds.width,
          y: oldH - bounds.y - bounds.height,
          rotation: layer.rotation + 180,
        };
      }
      return layer;
    }));

    setShapeLayers(prev => prev.map((layer) => {
      const bounds = getShapeBounds(layer);
      if (normalized === 90) {
        return {
          ...layer,
          x: oldH - bounds.y - bounds.height,
          y: bounds.x,
          rotation: layer.rotation + 90,
        };
      }
      if (normalized === 270) {
        return {
          ...layer,
          x: bounds.y,
          y: oldW - bounds.x - bounds.width,
          rotation: layer.rotation - 90,
        };
      }
      if (normalized === 180) {
        return {
          ...layer,
          x: oldW - bounds.x - bounds.width,
          y: oldH - bounds.y - bounds.height,
          rotation: layer.rotation + 180,
        };
      }
      return layer;
    }));

    setDimensions({ w: canvas.width, h: canvas.height });
    pushHistory(`Rotation ${deg}°`);
  }, [editor, pushHistory]);

  // ── Flip ────────────────────────────────────────────────────────
  const handleFlip = useCallback((dir: 'h' | 'v') => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const metricsCtx = canvas.getContext('2d');
    if (!metricsCtx) return;

    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tctx = temp.getContext('2d')!;
    tctx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (dir === 'h') {
      ctx.scale(-1, 1);
      ctx.drawImage(temp, -canvas.width, 0);
    } else {
      ctx.scale(1, -1);
      ctx.drawImage(temp, 0, -canvas.height);
    }
    ctx.restore();

    setTextLayers(prev => prev.map((layer) => {
      const bounds = getTextMetricsForLayer(metricsCtx, layer);
      if (dir === 'h') {
        return { ...layer, x: canvas.width - bounds.x - bounds.width };
      }
      return { ...layer, y: canvas.height - bounds.y - bounds.height };
    }));

    setShapeLayers(prev => prev.map((layer) => {
      const bounds = getShapeBounds(layer);
      if (dir === 'h') {
        return { ...layer, x: canvas.width - bounds.x - bounds.width };
      }
      return { ...layer, y: canvas.height - bounds.y - bounds.height };
    }));

    pushHistory(`Spiegeln ${dir === 'h' ? 'horizontal' : 'vertikal'}`);
  }, [editor, pushHistory]);

  // ── Crop ────────────────────────────────────────────────────────
  const applyCrop = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas || !cropRect) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = Math.round(cropRect.x / zoom);
    const cy = Math.round(cropRect.y / zoom);
    const cw = Math.round(cropRect.w / zoom);
    const ch = Math.round(cropRect.h / zoom);

    const imgData = ctx.getImageData(cx, cy, cw, ch);
    canvas.width = cw;
    canvas.height = ch;
    ctx.putImageData(imgData, 0, 0);

    const cropCtx = canvas.getContext('2d');
    if (!cropCtx) return;

    setTextLayers(prev => prev
      .map((layer) => ({ ...layer, x: layer.x - cx, y: layer.y - cy }))
      .filter((layer) => {
        const b = getTextMetricsForLayer(cropCtx, layer);
        return (
          b.x + b.width > 0 &&
          b.y + b.height > 0 &&
          b.x < cw &&
          b.y < ch
        );
      }),
    );

    setShapeLayers(prev => prev
      .map((layer) => ({ ...layer, x: layer.x - cx, y: layer.y - cy }))
      .filter((layer) => {
        const b = getShapeBounds(layer);
        return (
          b.x + b.width > 0 &&
          b.y + b.height > 0 &&
          b.x < cw &&
          b.y < ch
        );
      }),
    );

    setCropRect(null);
    setDimensions({ w: cw, h: ch });
    pushHistory('Crop angewendet');
  }, [editor, cropRect, zoom, pushHistory]);

  // ── Resize ──────────────────────────────────────────────────────
  const applyResize = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const oldW = canvas.width;
    const oldH = canvas.height;

    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tctx = temp.getContext('2d')!;
    tctx.drawImage(canvas, 0, 0);

    canvas.width = resizeW;
    canvas.height = resizeH;
    ctx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, resizeW, resizeH);

    const scaleX = oldW > 0 ? resizeW / oldW : 1;
    const scaleY = oldH > 0 ? resizeH / oldH : 1;
    const fontScale = (scaleX + scaleY) / 2;
    setTextLayers(prev => prev.map((layer) => ({
      ...layer,
      x: layer.x * scaleX,
      y: layer.y * scaleY,
      fontSize: Math.max(8, layer.fontSize * fontScale),
      width: layer.width * scaleX,
      height: layer.height * scaleY,
    })));

    setShapeLayers(prev => prev.map((layer) => ({
      ...layer,
      x: layer.x * scaleX,
      y: layer.y * scaleY,
      width: layer.width * scaleX,
      height: layer.height * scaleY,
    })));

    setDimensions({ w: resizeW, h: resizeH });
    setShowResize(false);
    pushHistory(`Resize ${resizeW}×${resizeH}`);
  }, [editor, resizeW, resizeH, pushHistory]);

  // ── Canvas coordinate helpers ───────────────────────────────────
  const clamp = useCallback((value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
  }, []);

  const getCanvasPointFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return { x: 0, y: 0, displayX: 0, displayY: 0 };

    const rect = canvas.getBoundingClientRect();
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

    return {
      x: displayX * scaleX,
      y: displayY * scaleY,
      displayX,
      displayY,
    };
  }, [editor.canvasRef]);

  const getCanvasPos = useCallback((e: React.MouseEvent) => {
    const p = getCanvasPointFromClient(e.clientX, e.clientY);
    return { x: p.displayX, y: p.displayY };
  }, [getCanvasPointFromClient]);

  const getCanvasRealPos = useCallback((e: React.MouseEvent) => {
    const p = getCanvasPointFromClient(e.clientX, e.clientY);
    return { x: p.x, y: p.y };
  }, [getCanvasPointFromClient]);

  const getTextLayerMetrics = useCallback((layer: TextLayer) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) {
      const fallback = Math.max(1, layer.text.length * layer.fontSize * 0.58);
      return { x: layer.x, y: layer.y, width: fallback, height: layer.fontSize * layer.lineHeight };
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = Math.max(1, layer.text.length * layer.fontSize * 0.58);
      return { x: layer.x, y: layer.y, width: fallback, height: layer.fontSize * layer.lineHeight };
    }
    return getTextMetricsForLayer(ctx, layer);
  }, [editor.canvasRef]);

  const findTextLayerById = useCallback((id: string) => {
    return textLayers.find((layer) => layer.id === id) || null;
  }, [textLayers]);

  const findShapeLayerById = useCallback((id: string) => {
    return shapeLayers.find((layer) => layer.id === id) || null;
  }, [shapeLayers]);

  const getLayerBounds = useCallback((layerId: string): TransformBounds | null => {
    const text = findTextLayerById(layerId);
    if (text) return getTextLayerMetrics(text);
    const shape = findShapeLayerById(layerId);
    if (shape) return getShapeBounds(shape);
    return null;
  }, [findShapeLayerById, findTextLayerById, getTextLayerMetrics]);

  const getObjectLayerAtPoint = useCallback((point: Point): TextLayer | ShapeLayer | null => {
    const order = layerOrder.filter((id) => findTextLayerById(id) || findShapeLayerById(id));
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const text = findTextLayerById(id);
      if (text && text.visible) {
        const b = getTextLayerMetrics(text);
        if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) {
          return text;
        }
      }
      const shape = findShapeLayerById(id);
      if (shape && shape.visible) {
        const b = getShapeBounds(shape);
        if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) {
          return shape;
        }
      }
    }
    return null;
  }, [findShapeLayerById, findTextLayerById, getTextLayerMetrics, layerOrder]);

  const createCompositeCanvas = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return null;

    const composite = document.createElement('canvas');
    composite.width = canvas.width;
    composite.height = canvas.height;
    const cctx = composite.getContext('2d');
    if (!cctx) return null;

    cctx.drawImage(canvas, 0, 0);
    for (const layerId of layerOrder) {
      const text = textLayers.find((layer) => layer.id === layerId);
      if (text && text.visible) {
        const mask = maskCanvasesRef.current[text.id];
        if (mask) {
          const layerCanvas = document.createElement('canvas');
          layerCanvas.width = composite.width;
          layerCanvas.height = composite.height;
          const lctx = layerCanvas.getContext('2d');
          if (lctx) {
            drawTextLayer(lctx, text);
            lctx.globalCompositeOperation = 'destination-in';
            lctx.drawImage(mask, 0, 0);
            cctx.drawImage(layerCanvas, 0, 0);
          }
        } else {
          drawTextLayer(cctx, text);
        }
        continue;
      }
      const shape = shapeLayers.find((layer) => layer.id === layerId);
      if (shape && shape.visible) {
        const mask = maskCanvasesRef.current[shape.id];
        if (mask) {
          const layerCanvas = document.createElement('canvas');
          layerCanvas.width = composite.width;
          layerCanvas.height = composite.height;
          const lctx = layerCanvas.getContext('2d');
          if (lctx) {
            drawShapeLayer(lctx, shape);
            lctx.globalCompositeOperation = 'destination-in';
            lctx.drawImage(mask, 0, 0);
            cctx.drawImage(layerCanvas, 0, 0);
          }
        } else {
          drawShapeLayer(cctx, shape);
        }
        continue;
      }
      const adjustment = adjustmentLayers.find((layer) => layer.id === layerId);
      if (adjustment) {
        applyAdjustmentLayerToCanvas(composite, adjustment);
      }
    }
    return composite;
  }, [editor.canvasRef, layerOrder, textLayers, shapeLayers, adjustmentLayers]);

  // ── Shape preview on overlay ────────────────────────────────────
  const drawShapePreview = useCallback((endPos: { x: number; y: number }) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.strokeStyle = editor.drawSettings.color;
    ctx.fillStyle = editor.drawSettings.color;
    ctx.lineWidth = editor.drawSettings.strokeWidth;

    drawShape(ctx, editor.drawSettings.shapeType, startPosRef.current, endPos, editor.drawSettings.shapeFilled);
  }, [editor.drawSettings]);

  const clearOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  // ── Selection helpers ─────────────────────────────────────────
  const clearSelection = useCallback(() => {
    selectionMaskRef.current = null;
    selectionBoundsRef.current = null;
    selectionEdgesRef.current = [];
    setHasSelection(false);
    if (marchingAntsAnimRef.current) {
      cancelAnimationFrame(marchingAntsAnimRef.current);
      marchingAntsAnimRef.current = null;
    }
    clearOverlay();
  }, [clearOverlay]);

  // Source crosshair drawing helper
  const drawSourceCrosshairOnOverlay = useCallback((ctx: CanvasRenderingContext2D) => {
    const sp = sourcePointRef.current;
    if (!sp) return;
    ctx.save();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1.5;
    const r = editor.drawSettings.brushSize / 2;
    ctx.beginPath();
    ctx.moveTo(sp.x - r - 4, sp.y);
    ctx.lineTo(sp.x + r + 4, sp.y);
    ctx.moveTo(sp.x, sp.y - r - 4);
    ctx.lineTo(sp.x, sp.y + r + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [editor.drawSettings.brushSize]);

  const startMarchingAnts = useCallback(() => {
    if (marchingAntsAnimRef.current) cancelAnimationFrame(marchingAntsAnimRef.current);
    const animate = () => {
      marchingAntsOffsetRef.current = (marchingAntsOffsetRef.current + 0.5) % 16;
      const overlay = overlayCanvasRef.current;
      const edges = selectionEdgesRef.current;
      if (overlay && edges.length > 0) {
        const ctx = overlay.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          renderCachedMarchingAnts(ctx, edges, marchingAntsOffsetRef.current, zoomRef.current);
          if (hasSourceRef.current && sourcePointRef.current) {
            drawSourceCrosshairOnOverlay(ctx);
          }
        }
      }
      marchingAntsAnimRef.current = requestAnimationFrame(animate);
    };
    marchingAntsAnimRef.current = requestAnimationFrame(animate);
  }, [drawSourceCrosshairOnOverlay]);

  const setSelectionFromMask = useCallback((mask: ImageData) => {
    selectionMaskRef.current = mask;
    const { width, height, data } = mask;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4] >= 128) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    if (found) {
      selectionBoundsRef.current = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      selectionEdgesRef.current = extractSelectionEdges(mask);
      setHasSelection(true);
      startMarchingAnts();
    } else {
      clearSelection();
    }
  }, [clearSelection, startMarchingAnts]);

  const selectAll = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const mask = createSelectionMask(canvas.width, canvas.height);
    const d = mask.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
    }
    setSelectionFromMask(mask);
  }, [editor.canvasRef, setSelectionFromMask]);

  // Keep zoomRef in sync with zoom state
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Cleanup marching ants on unmount
  useEffect(() => {
    return () => {
      if (marchingAntsAnimRef.current) cancelAnimationFrame(marchingAntsAnimRef.current);
    };
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if (e.key === ' ' && !typing) {
        e.preventDefault();
        isSpaceDownRef.current = true;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoFromHistory();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoFromHistory();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        const canvas = editor.canvasRef.current;
        const container = containerRef.current;
        if (canvas && container) {
          const fit = Math.min(1, container.clientWidth / canvas.width, container.clientHeight / canvas.height);
          setZoom(fit);
        }
      }

      // Ctrl+A = select all, Ctrl+D = deselect
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !typing) {
        e.preventDefault();
        selectAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !typing) {
        e.preventDefault();
        clearSelection();
      }

      // Ctrl+C/X = copy/cut selection
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x') && !typing && hasSelection && selectionMaskRef.current) {
        e.preventDefault();
        const canvas = editor.canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const mask = selectionMaskRef.current;
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const clipCanvas = document.createElement('canvas');
            clipCanvas.width = canvas.width;
            clipCanvas.height = canvas.height;
            const clipCtx = clipCanvas.getContext('2d')!;
            const clipData = clipCtx.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < mask.data.length; i += 4) {
              if (mask.data[i] >= 128) {
                clipData.data[i] = imgData.data[i];
                clipData.data[i + 1] = imgData.data[i + 1];
                clipData.data[i + 2] = imgData.data[i + 2];
                clipData.data[i + 3] = imgData.data[i + 3];
              }
            }
            clipCtx.putImageData(clipData, 0, 0);
            clipboardCanvasRef.current = clipCanvas;
            if (e.key === 'x') {
              for (let i = 0; i < mask.data.length; i += 4) {
                if (mask.data[i] >= 128) {
                  imgData.data[i + 3] = 0;
                }
              }
              ctx.putImageData(imgData, 0, 0);
              pushHistory('Ausschneiden');
            }
          }
        }
      }

      // Ctrl+V = paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !typing && clipboardCanvasRef.current) {
        e.preventDefault();
        const canvas = editor.canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(clipboardCanvasRef.current, 0, 0);
            pushHistory('Einfügen');
          }
        }
      }

      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'b') editor.setActiveTool('draw');
        if (key === 'e') editor.setActiveTool('eraser');
        if (key === 't') editor.setActiveTool('text');
        if (key === 'v') editor.setActiveTool('select');
        if (key === 'm') editor.setActiveTool('marquee');
        if (key === 'l') editor.setActiveTool('lasso');
        if (key === 'w') editor.setActiveTool('magicWand');
        if (key === 'j') editor.setActiveTool('healing');
        if (key === 's') editor.setActiveTool('cloneStamp');
        if (key === '[') {
          e.preventDefault();
          editor.updateDrawSetting('brushSize', Math.max(1, editor.drawSettings.brushSize - 1));
        }
        if (key === ']') {
          e.preventDefault();
          editor.updateDrawSetting('brushSize', Math.min(200, editor.drawSettings.brushSize + 1));
        }
      }

      if (activeLayerId && !typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        const removedText = textLayers.some((layer) => layer.id === activeLayerId);
        const removedShape = shapeLayers.some((layer) => layer.id === activeLayerId);
        if (removedText) {
          setTextLayers((prev) => prev.filter((layer) => layer.id !== activeLayerId));
          setActiveLayerId(null);
          pushHistory('Text-Layer gelöscht');
        } else if (removedShape) {
          setShapeLayers((prev) => prev.filter((layer) => layer.id !== activeLayerId));
          setActiveLayerId(null);
          pushHistory('Shape-Layer gelöscht');
        }
      }
    };

    const upHandler = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        isSpaceDownRef.current = false;
        isPanningRef.current = false;
      }
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [activeLayerId, clearSelection, editor, hasSelection, pushHistory, redoFromHistory, selectAll, shapeLayers, textLayers, undoFromHistory]);

  const ensureLayerMaskCanvas = useCallback((layerId: string) => {
    const existing = maskCanvasesRef.current[layerId];
    if (existing) return existing;
    const canvas = editor.canvasRef.current;
    if (!canvas) return null;

    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const mctx = mask.getContext('2d');
    if (!mctx) return null;
    mctx.fillStyle = '#ffffff';
    mctx.fillRect(0, 0, mask.width, mask.height);
    maskCanvasesRef.current[layerId] = mask;
    return mask;
  }, [editor.canvasRef]);

  const paintBrushSegment = useCallback((
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    erasing: boolean,
  ) => {
    const {
      brushSize,
      brushOpacity,
      brushFlow,
      brushSpacing,
      brushJitter,
      brushSmoothing,
      brushPreset,
      brushHardness,
      color,
    } = editor.drawSettings;
    const radius = Math.max(0.5, brushSize / 2);
    const spacing = Math.max(0.5, brushSize * (brushSpacing / 100));
    const smoothFactor = 1 - clamp(brushSmoothing / 100, 0, 0.92);
    const smoothedTo = {
      x: from.x + (to.x - from.x) * smoothFactor,
      y: from.y + (to.y - from.y) * smoothFactor,
    };
    const dx = smoothedTo.x - from.x;
    const dy = smoothedTo.y - from.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    const alpha = clamp((brushOpacity / 100) * (brushFlow / 100), 0.01, 1);
    const jitterPx = brushSize * (brushJitter / 100);

    ctx.save();
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.globalAlpha = alpha;

    // Clip to selection mask if active
    if (selectionMaskRef.current) {
      const mask = selectionMaskRef.current;
      const cw = mask.width;
      const ch = mask.height;
      const md = mask.data;
      // Build a clip region from the selection
      const region = new Path2D();
      for (let sy = 0; sy < ch; sy++) {
        let runStart = -1;
        for (let sx = 0; sx <= cw; sx++) {
          const selected = sx < cw && md[(sy * cw + sx) * 4] >= 128;
          if (selected && runStart < 0) {
            runStart = sx;
          } else if (!selected && runStart >= 0) {
            region.rect(runStart, sy, sx - runStart, 1);
            runStart = -1;
          }
        }
      }
      ctx.clip(region);
    }

    const drawDab = (x: number, y: number, angle: number) => {
      const jx = jitterPx > 0 ? (Math.random() - 0.5) * jitterPx : 0;
      const jy = jitterPx > 0 ? (Math.random() - 0.5) * jitterPx : 0;
      const px = x + jx;
      const py = y + jy;

      if (brushPreset === 'softRound') {
        const gradient = ctx.createRadialGradient(
          px,
          py,
          radius * Math.max(0.1, brushHardness / 100),
          px,
          py,
          radius,
        );
        gradient.addColorStop(0, erasing ? 'rgba(0,0,0,1)' : color);
        gradient.addColorStop(1, erasing ? 'rgba(0,0,0,0)' : `${color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (brushPreset === 'marker') {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.scale(1.8, 0.6);
        ctx.fillStyle = erasing ? 'rgba(0,0,0,1)' : color;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.fillStyle = erasing ? 'rgba(0,0,0,1)' : color;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const angle = Math.atan2(dy, dx);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      drawDab(x, y, angle);
    }

    ctx.restore();
  }, [editor.drawSettings, clamp]);

  const applySnap = useCallback((next: TransformBounds) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return { x: next.x, y: next.y };
    let x = next.x;
    let y = next.y;
    let guideX: number | null = null;
    let guideY: number | null = null;
    if (snapToGuides) {
      const threshold = 6;
      const xCandidates = [
        canvas.width / 2 - next.width / 2,
        0,
        canvas.width - next.width,
        ...guides.filter((guide) => guide.axis === 'x').map((guide) => guide.value),
      ];
      for (const candidate of xCandidates) {
        if (Math.abs(x - candidate) <= threshold) {
          x = candidate;
          guideX = candidate;
          break;
        }
      }
      const yCandidates = [
        canvas.height / 2 - next.height / 2,
        0,
        canvas.height - next.height,
        ...guides.filter((guide) => guide.axis === 'y').map((guide) => guide.value),
      ];
      for (const candidate of yCandidates) {
        if (Math.abs(y - candidate) <= threshold) {
          y = candidate;
          guideY = candidate;
          break;
        }
      }
    }
    if (pixelSnap) {
      x = Math.round(x);
      y = Math.round(y);
    }
    setSmartGuide({ x: guideX, y: guideY });
    return { x, y };
  }, [editor.canvasRef, guides, pixelSnap, snapToGuides]);

  const beginLayerTransform = useCallback((mode: 'nw' | 'ne' | 'sw' | 'se' | 'rotate', layerId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const point = getCanvasPointFromClient(e.clientX, e.clientY);
    const bounds = getLayerBounds(layerId);
    if (!bounds) return;

    transformModeRef.current = mode;
    transformLayerIdRef.current = layerId;
    transformStartRef.current = { x: point.x, y: point.y };
    transformInitialBoundsRef.current = bounds;
    transformInitialLayerRef.current = findTextLayerById(layerId) || findShapeLayerById(layerId);
  }, [findShapeLayerById, findTextLayerById, getCanvasPointFromClient, getLayerBounds]);

  // ── Mouse handlers ──────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const realPos = getCanvasRealPos(e);
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    if (e.button !== 0) return;

    if (isSpaceDownRef.current && containerRef.current) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panScrollRef.current = { x: containerRef.current.scrollLeft, y: containerRef.current.scrollTop };
      return;
    }

    if (editor.activeTool === 'crop' || editor.activeTool === 'blurRegion') {
      isCroppingRef.current = true;
      startPosRef.current = pos;
      setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      return;
    }

    if (editor.activeTool === 'colorPicker') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pixel = ctx.getImageData(Math.round(realPos.x), Math.round(realPos.y), 1, 1).data;
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      editor.updateDrawSetting('color', hex);
      toast({ title: 'Farbe aufgenommen', description: hex });
      return;
    }

    if (editor.activeTool === 'select' || editor.activeTool === 'text') {
      const hit = getObjectLayerAtPoint(realPos);
      if (hit && !hit.locked) {
        const now = Date.now();
        const isDoubleClick = lastClickLayerRef.current === hit.id && now - lastClickTimeRef.current < 400;
        lastClickTimeRef.current = now;
        lastClickLayerRef.current = hit.id;

        if (isDoubleClick && hit.kind === 'text') {
          const textLayer = textLayers.find((l) => l.id === hit.id);
          if (textLayer) {
            setEditingLayerId(textLayer.id);
            setTextInput(textLayer.text);
            setTextPos({ x: textLayer.x, y: textLayer.y });
            setActiveLayerId(textLayer.id);
            return;
          }
        }

        setActiveLayerId(hit.id);
        isDraggingLayerRef.current = true;
        draggingLayerIdRef.current = hit.id;
        const bounds = getLayerBounds(hit.id);
        if (bounds) layerDragOffsetRef.current = { x: realPos.x - bounds.x, y: realPos.y - bounds.y };
        layerMoveChangedRef.current = false;
        return;
      }
      lastClickLayerRef.current = null;
      setActiveLayerId(null);
      if (editor.activeTool === 'text') {
        setEditingLayerId(null);
        setTextPos(realPos);
        setTextInput('');
      }
      return;
    }

    if (editor.activeTool === 'draw' || editor.activeTool === 'eraser') {
      const targetCtx = (() => {
        if (maskMode && activeLayerId) {
          const mask = ensureLayerMaskCanvas(activeLayerId);
          return mask?.getContext('2d') ?? null;
        }
        return canvas.getContext('2d');
      })();
      if (!targetCtx) return;

      isDrawingRef.current = true;
      lastPosRef.current = realPos;
      paintBrushSegment(targetCtx, realPos, realPos, editor.activeTool === 'eraser');
      return;
    }

    if (editor.activeTool === 'shapes') {
      isDrawingRef.current = true;
      startPosRef.current = realPos;
      lastPosRef.current = realPos;
      return;
    }

    // ── Marquee ──
    if (editor.activeTool === 'marquee') {
      marqueeStartRef.current = realPos;
      isDrawingRef.current = true;
      return;
    }

    // ── Lasso ──
    if (editor.activeTool === 'lasso') {
      lassoPointsRef.current = [realPos];
      isDrawingRef.current = true;
      return;
    }

    // ── Magic Wand ──
    if (editor.activeTool === 'magicWand') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = floodFillSelection(
        imgData,
        realPos.x,
        realPos.y,
        editor.drawSettings.magicWandTolerance,
        editor.drawSettings.magicWandContiguous,
      );
      setSelectionFromMask(mask);
      return;
    }

    // ── Healing Brush ──
    if (editor.activeTool === 'healing') {
      if (e.altKey) {
        sourcePointRef.current = { x: realPos.x, y: realPos.y };
        hasSourceRef.current = true;
        // Show crosshair on overlay
        const overlay = overlayCanvasRef.current;
        if (overlay) {
          const octx = overlay.getContext('2d');
          if (octx) {
            octx.clearRect(0, 0, overlay.width, overlay.height);
            drawSourceCrosshairOnOverlay(octx);
          }
        }
        toast({ title: 'Quelle gesetzt', description: `(${Math.round(realPos.x)}, ${Math.round(realPos.y)})` });
        return;
      }
      if (!hasSourceRef.current || !sourcePointRef.current) {
        toast({ title: 'Alt+Klick', description: 'Zuerst Quellpunkt mit Alt+Klick setzen.' });
        return;
      }
      sourceOffsetRef.current = {
        x: sourcePointRef.current.x - realPos.x,
        y: sourcePointRef.current.y - realPos.y,
      };
      isDrawingRef.current = true;
      lastPosRef.current = realPos;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        healBrushDab(ctx, realPos.x, realPos.y,
          realPos.x + sourceOffsetRef.current.x,
          realPos.y + sourceOffsetRef.current.y,
          editor.drawSettings.brushSize,
          editor.drawSettings.brushHardness,
          editor.drawSettings.brushOpacity);
      }
      return;
    }

    // ── Clone Stamp ──
    if (editor.activeTool === 'cloneStamp') {
      if (e.altKey) {
        sourcePointRef.current = { x: realPos.x, y: realPos.y };
        hasSourceRef.current = true;
        const overlay = overlayCanvasRef.current;
        if (overlay) {
          const octx = overlay.getContext('2d');
          if (octx) {
            octx.clearRect(0, 0, overlay.width, overlay.height);
            drawSourceCrosshairOnOverlay(octx);
          }
        }
        toast({ title: 'Quelle gesetzt', description: `(${Math.round(realPos.x)}, ${Math.round(realPos.y)})` });
        return;
      }
      if (!hasSourceRef.current || !sourcePointRef.current) {
        toast({ title: 'Alt+Klick', description: 'Zuerst Quellpunkt mit Alt+Klick setzen.' });
        return;
      }
      sourceOffsetRef.current = {
        x: sourcePointRef.current.x - realPos.x,
        y: sourcePointRef.current.y - realPos.y,
      };
      isDrawingRef.current = true;
      lastPosRef.current = realPos;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        cloneStampDab(ctx, realPos.x, realPos.y,
          realPos.x + sourceOffsetRef.current.x,
          realPos.y + sourceOffsetRef.current.y,
          editor.drawSettings.brushSize,
          editor.drawSettings.brushHardness,
          editor.drawSettings.brushOpacity,
          editor.drawSettings.brushFlow);
      }
      return;
    }

    // ── Spot Remove ──
    if (editor.activeTool === 'spotRemove') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      spotRemoveDab(ctx, realPos.x, realPos.y, editor.drawSettings.brushSize);
      pushHistory('Spot Remove');
      return;
    }
  }, [
    activeLayerId,
    clearSelection,
    drawSourceCrosshairOnOverlay,
    editor,
    ensureLayerMaskCanvas,
    getCanvasPos,
    getCanvasRealPos,
    getLayerBounds,
    getObjectLayerAtPoint,
    maskMode,
    paintBrushSegment,
    pushHistory,
    setSelectionFromMask,
    toast,
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const realPos = getCanvasRealPos(e);
    const canvas = editor.canvasRef.current;
    if (!canvas) return;

    if (isPanningRef.current && containerRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      containerRef.current.scrollLeft = panScrollRef.current.x - dx;
      containerRef.current.scrollTop = panScrollRef.current.y - dy;
      return;
    }

    if (
      transformModeRef.current &&
      transformLayerIdRef.current &&
      transformInitialBoundsRef.current &&
      transformInitialLayerRef.current
    ) {
      const mode = transformModeRef.current;
      const id = transformLayerIdRef.current;
      const initialBounds = transformInitialBoundsRef.current;
      const initialLayer = transformInitialLayerRef.current;
      const dx = realPos.x - transformStartRef.current.x;
      const dy = realPos.y - transformStartRef.current.y;

      if (mode === 'rotate') {
        const cx = initialBounds.x + initialBounds.width / 2;
        const cy = initialBounds.y + initialBounds.height / 2;
        const a0 = Math.atan2(transformStartRef.current.y - cy, transformStartRef.current.x - cx);
        const a1 = Math.atan2(realPos.y - cy, realPos.x - cx);
        const delta = ((a1 - a0) * 180) / Math.PI;
        const nextRotation = initialLayer.rotation + delta;

        setTextLayers((prev) => prev.map((layer) => layer.id === id ? { ...layer, rotation: nextRotation } : layer));
        setShapeLayers((prev) => prev.map((layer) => layer.id === id ? { ...layer, rotation: nextRotation } : layer));
        layerMoveChangedRef.current = true;
        return;
      }

      let x = initialBounds.x;
      let y = initialBounds.y;
      let width = initialBounds.width;
      let height = initialBounds.height;
      if (mode === 'se') { width += dx; height += dy; }
      if (mode === 'sw') { x += dx; width -= dx; height += dy; }
      if (mode === 'ne') { y += dy; width += dx; height -= dy; }
      if (mode === 'nw') { x += dx; y += dy; width -= dx; height -= dy; }
      width = Math.max(8, width);
      height = Math.max(8, height);
      const snapped = applySnap({ x, y, width, height });

      setShapeLayers((prev) => prev.map((layer) => layer.id === id ? { ...layer, x: snapped.x, y: snapped.y, width, height } : layer));
      setTextLayers((prev) => prev.map((layer) => {
        if (layer.id !== id) return layer;
        const source = transformInitialLayerRef.current;
        if (!source || source.kind !== 'text') return layer;
        const factor = initialBounds.height > 0 ? height / initialBounds.height : 1;
        return {
          ...layer,
          x: snapped.x,
          y: snapped.y,
          fontSize: Math.max(8, source.fontSize * factor),
        };
      }));
      layerMoveChangedRef.current = true;
      return;
    }

    if (isDraggingLayerRef.current && draggingLayerIdRef.current) {
      const dragId = draggingLayerIdRef.current;
      const bounds = getLayerBounds(dragId);
      if (!bounds) return;
      const next = {
        x: realPos.x - layerDragOffsetRef.current.x,
        y: realPos.y - layerDragOffsetRef.current.y,
        width: bounds.width,
        height: bounds.height,
      };
      const snapped = applySnap(next);
      const x = clamp(snapped.x, 0, Math.max(0, canvas.width - bounds.width));
      const y = clamp(snapped.y, 0, Math.max(0, canvas.height - bounds.height));
      setTextLayers((prev) => prev.map((layer) => layer.id === dragId ? { ...layer, x, y } : layer));
      setShapeLayers((prev) => prev.map((layer) => layer.id === dragId ? { ...layer, x, y } : layer));
      layerMoveChangedRef.current = true;
      return;
    }

    if ((editor.activeTool === 'crop' || editor.activeTool === 'blurRegion') && isCroppingRef.current) {
      const x = Math.min(startPosRef.current.x, pos.x);
      const y = Math.min(startPosRef.current.y, pos.y);
      const w = Math.abs(pos.x - startPosRef.current.x);
      const h = Math.abs(pos.y - startPosRef.current.y);
      setCropRect({ x, y, w, h });
      return;
    }

    if ((editor.activeTool === 'draw' || editor.activeTool === 'eraser') && isDrawingRef.current) {
      const targetCtx = (() => {
        if (maskMode && activeLayerId) {
          const mask = ensureLayerMaskCanvas(activeLayerId);
          return mask?.getContext('2d') ?? null;
        }
        return canvas.getContext('2d');
      })();
      if (!targetCtx) return;
      paintBrushSegment(targetCtx, lastPosRef.current, realPos, editor.activeTool === 'eraser');
      lastPosRef.current = realPos;
      return;
    }

    if (editor.activeTool === 'shapes' && isDrawingRef.current) {
      lastPosRef.current = realPos;
      drawShapePreview(realPos);
      return;
    }

    // ── Marquee move ──
    if (editor.activeTool === 'marquee' && isDrawingRef.current && marqueeStartRef.current) {
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          const x = Math.min(marqueeStartRef.current.x, realPos.x);
          const y = Math.min(marqueeStartRef.current.y, realPos.y);
          const w = Math.abs(realPos.x - marqueeStartRef.current.x);
          const h = Math.abs(realPos.y - marqueeStartRef.current.y);
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
          ctx.strokeStyle = '#000000';
          ctx.lineDashOffset = 5;
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);
        }
      }
      return;
    }

    // ── Lasso move ──
    if (editor.activeTool === 'lasso' && isDrawingRef.current) {
      lassoPointsRef.current.push(realPos);
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          const pts = lassoPointsRef.current;
          if (pts.length > 1) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
      return;
    }

    // ── Healing move ──
    if (editor.activeTool === 'healing' && isDrawingRef.current) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        healBrushDab(ctx, realPos.x, realPos.y,
          realPos.x + sourceOffsetRef.current.x,
          realPos.y + sourceOffsetRef.current.y,
          editor.drawSettings.brushSize,
          editor.drawSettings.brushHardness,
          editor.drawSettings.brushOpacity);
      }
      // Update source crosshair on overlay
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        if (octx) {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          // Show current source position
          const sp = {
            x: realPos.x + sourceOffsetRef.current.x,
            y: realPos.y + sourceOffsetRef.current.y,
          };
          sourcePointRef.current = sp;
          drawSourceCrosshairOnOverlay(octx);
        }
      }
      lastPosRef.current = realPos;
      return;
    }

    // ── Clone stamp move ──
    if (editor.activeTool === 'cloneStamp' && isDrawingRef.current) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        cloneStampDab(ctx, realPos.x, realPos.y,
          realPos.x + sourceOffsetRef.current.x,
          realPos.y + sourceOffsetRef.current.y,
          editor.drawSettings.brushSize,
          editor.drawSettings.brushHardness,
          editor.drawSettings.brushOpacity,
          editor.drawSettings.brushFlow);
      }
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        if (octx) {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          const sp = {
            x: realPos.x + sourceOffsetRef.current.x,
            y: realPos.y + sourceOffsetRef.current.y,
          };
          sourcePointRef.current = sp;
          drawSourceCrosshairOnOverlay(octx);
        }
      }
      lastPosRef.current = realPos;
      return;
    }
  }, [
    activeLayerId,
    applySnap,
    clamp,
    drawShapePreview,
    drawSourceCrosshairOnOverlay,
    editor,
    ensureLayerMaskCanvas,
    getCanvasPos,
    getCanvasRealPos,
    getLayerBounds,
    maskMode,
    paintBrushSegment,
  ]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const realPos = getCanvasRealPos(e);
    const canvas = editor.canvasRef.current;
    if (!canvas) return;

    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (transformModeRef.current) {
      transformModeRef.current = null;
      transformLayerIdRef.current = null;
      transformInitialBoundsRef.current = null;
      transformInitialLayerRef.current = null;
      setSmartGuide({ x: null, y: null });
      if (layerMoveChangedRef.current) {
        pushHistory('Layer transformiert');
      }
      layerMoveChangedRef.current = false;
      return;
    }

    if (isDraggingLayerRef.current) {
      isDraggingLayerRef.current = false;
      draggingLayerIdRef.current = null;
      setSmartGuide({ x: null, y: null });
      if (layerMoveChangedRef.current) pushHistory('Layer verschoben');
      layerMoveChangedRef.current = false;
      return;
    }

    if (editor.activeTool === 'blurRegion' && isCroppingRef.current && cropRect) {
      isCroppingRef.current = false;
      if (cropRect.w < 2 || cropRect.h < 2) { setCropRect(null); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { setCropRect(null); return; }
      const rx = Math.round(cropRect.x / zoom);
      const ry = Math.round(cropRect.y / zoom);
      const rw = Math.round(cropRect.w / zoom);
      const rh = Math.round(cropRect.h / zoom);
      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const blurred = boxBlur(imgData, 8);
      ctx.putImageData(blurred, rx, ry);
      setCropRect(null);
      pushHistory('Blur Region');
      return;
    }

    if (editor.activeTool === 'crop' && isCroppingRef.current) {
      isCroppingRef.current = false;
      return;
    }

    if ((editor.activeTool === 'draw' || editor.activeTool === 'eraser') && isDrawingRef.current) {
      isDrawingRef.current = false;
      pushHistory(maskMode && activeLayerId ? 'Layer-Maske' : editor.activeTool === 'eraser' ? 'Radierer' : 'Brush');
      return;
    }

    if (editor.activeTool === 'shapes' && isDrawingRef.current) {
      isDrawingRef.current = false;
      const x = Math.min(startPosRef.current.x, realPos.x);
      const y = Math.min(startPosRef.current.y, realPos.y);
      const width = Math.abs(realPos.x - startPosRef.current.x);
      const height = Math.abs(realPos.y - startPosRef.current.y);
      clearOverlay();
      if (width < 2 || height < 2) return;

      const shapeLayer: ShapeLayer = {
        id: uid('shape'),
        kind: 'shape',
        name: `${getLayerNamePrefix('shape')} ${shapeLayers.length + 1}`,
        visible: true,
        locked: false,
        opacity: editor.drawSettings.brushOpacity,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        shapeType: editor.drawSettings.shapeType,
        x,
        y,
        width,
        height,
        color: editor.drawSettings.color,
        filled: editor.drawSettings.shapeFilled,
        strokeWidth: editor.drawSettings.strokeWidth,
      };
      setShapeLayers((prev) => [...prev, shapeLayer]);
      setLayerOrder((prev) => [...prev, shapeLayer.id]);
      setActiveLayerId(shapeLayer.id);
      pushHistory('Shape hinzugefügt');
    }

    // ── Marquee up ──
    if (editor.activeTool === 'marquee' && isDrawingRef.current && marqueeStartRef.current) {
      isDrawingRef.current = false;
      clearOverlay();
      const x = Math.min(marqueeStartRef.current.x, realPos.x);
      const y = Math.min(marqueeStartRef.current.y, realPos.y);
      const w = Math.abs(realPos.x - marqueeStartRef.current.x);
      const h = Math.abs(realPos.y - marqueeStartRef.current.y);
      marqueeStartRef.current = null;
      if (w < 2 || h < 2) { clearSelection(); return; }

      const mask = createSelectionMask(canvas.width, canvas.height);
      const d = mask.data;
      const rx = Math.round(x);
      const ry = Math.round(y);
      const rw = Math.round(w);
      const rh = Math.round(h);
      for (let py = ry; py < ry + rh && py < canvas.height; py++) {
        for (let px = rx; px < rx + rw && px < canvas.width; px++) {
          if (px >= 0 && py >= 0) {
            const idx = (py * canvas.width + px) * 4;
            d[idx] = 255; d[idx + 1] = 255; d[idx + 2] = 255; d[idx + 3] = 255;
          }
        }
      }
      setSelectionFromMask(mask);
      return;
    }

    // ── Lasso up ──
    if (editor.activeTool === 'lasso' && isDrawingRef.current) {
      isDrawingRef.current = false;
      clearOverlay();
      const pts = lassoPointsRef.current;
      if (pts.length < 3) { lassoPointsRef.current = []; clearSelection(); return; }

      // Draw filled polygon on temp canvas to create mask
      const temp = document.createElement('canvas');
      temp.width = canvas.width;
      temp.height = canvas.height;
      const tctx = temp.getContext('2d');
      if (tctx) {
        tctx.fillStyle = '#ffffff';
        tctx.beginPath();
        tctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) tctx.lineTo(pts[i].x, pts[i].y);
        tctx.closePath();
        tctx.fill();
        const maskData = tctx.getImageData(0, 0, canvas.width, canvas.height);
        // Convert: any non-zero alpha pixel = selected
        const mask = createSelectionMask(canvas.width, canvas.height);
        const md = mask.data;
        for (let i = 0; i < maskData.data.length; i += 4) {
          if (maskData.data[i + 3] > 0) {
            md[i] = 255; md[i + 1] = 255; md[i + 2] = 255; md[i + 3] = 255;
          }
        }
        setSelectionFromMask(mask);
      }
      lassoPointsRef.current = [];
      return;
    }

    // ── Healing up ──
    if (editor.activeTool === 'healing' && isDrawingRef.current) {
      isDrawingRef.current = false;
      clearOverlay();
      pushHistory('Healing Brush');
      return;
    }

    // ── Clone stamp up ──
    if (editor.activeTool === 'cloneStamp' && isDrawingRef.current) {
      isDrawingRef.current = false;
      clearOverlay();
      pushHistory('Clone Stamp');
      return;
    }
  }, [
    activeLayerId,
    clearOverlay,
    clearSelection,
    cropRect,
    editor,
    getCanvasRealPos,
    getLayerNamePrefix,
    maskMode,
    pushHistory,
    setSelectionFromMask,
    shapeLayers.length,
    zoom,
  ]);

  // ── Text finalize ───────────────────────────────────────────────
  const finalizeText = useCallback(() => {
    if (!textPos || !textInput.trim()) {
      setTextPos(null);
      setEditingLayerId(null);
      return;
    }

    // Editing existing text layer
    if (editingLayerId) {
      const lineCount = Math.max(1, textInput.split('\n').length);
      setTextLayers((prev) => prev.map((layer) => {
        if (layer.id !== editingLayerId) return layer;
        return {
          ...layer,
          text: textInput,
          width: Math.max(1, textInput.length * layer.fontSize * 0.58),
          height: Math.max(1, lineCount * layer.fontSize * layer.lineHeight),
        };
      }));
      setActiveLayerId(editingLayerId);
      setTextPos(null);
      setTextInput('');
      setEditingLayerId(null);
      pushHistory('Text bearbeitet');
      return;
    }

    // Creating new text layer
    const id = uid('text');
    const lineCount = Math.max(1, textInput.split('\n').length);

    const layer: TextLayer = {
      id,
      kind: 'text',
      name: `${getLayerNamePrefix('text')} ${textLayers.length + 1}`,
      visible: true,
      locked: false,
      opacity: editor.drawSettings.brushOpacity,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      text: textInput,
      x: textPos.x,
      y: textPos.y,
      width: Math.max(1, textInput.length * editor.drawSettings.fontSize * 0.58),
      height: Math.max(1, lineCount * editor.drawSettings.fontSize * TEXT_LINE_HEIGHT),
      fontSize: editor.drawSettings.fontSize,
      fontFamily: editor.drawSettings.fontFamily,
      color: editor.drawSettings.color,
      lineHeight: TEXT_LINE_HEIGHT,
      tracking: 0,
      kerning: 0,
      align: 'left',
      backgroundEnabled: false,
      backgroundColor: 'rgba(0,0,0,0.35)',
      backgroundPadding: 4,
      strokeEnabled: false,
      strokeColor: '#000000',
      strokeWidth: 1,
      shadowEnabled: false,
      shadowColor: 'rgba(0,0,0,0.55)',
      shadowBlur: 4,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
    };

    setTextLayers((prev) => [...prev, layer]);
    setLayerOrder((prev) => [...prev, layer.id]);
    setActiveLayerId(id);
    setTextPos(null);
    setTextInput('');
    pushHistory('Text hinzugefügt');
  }, [editingLayerId, editor.drawSettings, getLayerNamePrefix, pushHistory, textInput, textLayers.length, textPos]);

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const composite = createCompositeCanvas();
    if (!composite) return;
    const dataUrl = composite.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    try {
      const res = await fetch('/api/filebrowser/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootId, path: relativePath, content: base64, encoding: 'base64' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      editor.setIsDirty(false);
      toast({ title: 'Gespeichert', description: fileName });
    } catch (err) {
      toast({ title: 'Fehler', description: err instanceof Error ? err.message : 'Speichern fehlgeschlagen', variant: 'destructive' });
    }
  }, [editor, rootId, relativePath, fileName, toast, createCompositeCanvas]);

  const handleSaveAs = useCallback(async () => {
    if (!saveAsName.trim()) return;
    const composite = createCompositeCanvas();
    if (!composite) return;
    const dataUrl = composite.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const dir = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/') + 1) : '';
    const newPath = dir + saveAsName;

    try {
      const res = await fetch('/api/filebrowser/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootId, path: newPath, content: base64, encoding: 'base64' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: 'Gespeichert', description: newPath });
      setShowSaveAs(false);
    } catch (err) {
      toast({ title: 'Fehler', description: err instanceof Error ? err.message : 'Fehler', variant: 'destructive' });
    }
  }, [saveAsName, rootId, relativePath, toast, createCompositeCanvas]);

  const handleExport = useCallback(() => {
    const composite = createCompositeCanvas();
    if (!composite) return;
    const mime = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    const q = exportFormat === 'jpeg' ? exportQuality / 100 : undefined;
    const dataUrl = composite.toDataURL(mime, q);

    const a = document.createElement('a');
    a.href = dataUrl;
    const ext = exportFormat === 'jpeg' ? '.jpg' : '.png';
    a.download = fileName.replace(/\.[^.]+$/, '') + '_edited' + ext;
    a.click();
    setShowExport(false);
  }, [createCompositeCanvas, exportFormat, exportQuality, fileName]);

  // ── AI Describe ─────────────────────────────────────────────────
  const handleAiDescribe = useCallback(async () => {
    const composite = createCompositeCanvas();
    if (!composite) return;

    setAiLoading(true);
    setAiDescription('');

    try {
      const dataUrl = composite.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      const res = await fetch('/api/image-editor/ai-describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAiDescription(data.description);
    } catch (err) {
      toast({ title: 'AI Fehler', description: err instanceof Error ? err.message : 'Fehler', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }, [toast, createCompositeCanvas]);

  // ── AI Edit ─────────────────────────────────────────────────────
  const handleAiEdit = useCallback(async () => {
    if (!aiEditPrompt.trim()) return;
    const canvas = editor.canvasRef.current;
    const composite = createCompositeCanvas();
    if (!canvas || !composite) return;

    setAiEditLoading(true);
    try {
      const dataUrl = composite.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      const res = await fetch('/api/image-editor/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          prompt: aiEditPrompt,
          denoise: aiEditDenoise,
          ...(selectedWorkflowId ? { workflowId: selectedWorkflowId } : {}),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (data.resultImage) {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0);
          setDimensions({ w: img.width, h: img.height });
          pushHistory('AI Edit');
        };
        img.src = 'data:image/png;base64,' + data.resultImage;
      }
      toast({ title: 'AI Edit abgeschlossen' });
    } catch (err) {
      toast({ title: 'AI Fehler', description: err instanceof Error ? err.message : 'Fehler', variant: 'destructive' });
    } finally {
      setAiEditLoading(false);
    }
  }, [editor, aiEditPrompt, aiEditDenoise, selectedWorkflowId, toast, createCompositeCanvas, pushHistory]);

  // ── Tool change ─────────────────────────────────────────────────
  const handleToolChange = useCallback((tool: ImageTool) => {
    editor.setActiveTool(tool);
    setCropRect(null);
    setTextPos(null);
    setEditingLayerId(null);
    setSmartGuide({ x: null, y: null });

    if (tool === 'resize') {
      const canvas = editor.canvasRef.current;
      if (canvas) {
        setResizeW(canvas.width);
        setResizeH(canvas.height);
        aspectRef.current = canvas.width / canvas.height;
      }
      setShowResize(true);
    }
    if (tool === 'aiDescribe') handleAiDescribe();
    if (tool === 'aiEdit') {
      fetch('/api/comfyui/templates')
        .then((r) => r.json())
        .then((data: { success?: boolean; templates?: Array<{ id: string; name: string }> }) => {
          if (data.success && data.templates) {
            setAiEditWorkflows(data.templates);
            if (!selectedWorkflowId && data.templates.length > 0) {
              setSelectedWorkflowId(data.templates[0].id);
            }
          }
        })
        .catch(() => { /* ignore */ });
    }
  }, [editor, handleAiDescribe, selectedWorkflowId]);

  const handleResetAll = useCallback(() => {
    editor.resetToOriginal();
    setTextLayers([]);
    setShapeLayers([]);
    setAdjustmentLayers([]);
    setLayerOrder([]);
    setActiveLayerId(null);
    setTextPos(null);
    setTextInput('');
    setSmartGuide({ x: null, y: null });
    pushHistory('Reset');
  }, [editor, pushHistory]);

  const isSelectionTool = editor.activeTool === 'marquee' || editor.activeTool === 'lasso' || editor.activeTool === 'magicWand';

  const getCursorStyle = (): string => {
    if (isSpaceDownRef.current) return 'grab';
    if (isSelectionTool) return 'crosshair';
    if (editor.activeTool === 'spotRemove') return 'crosshair';
    if ((editor.activeTool === 'healing' || editor.activeTool === 'cloneStamp') && !hasSourceRef.current) return 'copy';
    if (editor.activeTool === 'healing' || editor.activeTool === 'cloneStamp') return 'crosshair';
    return 'default';
  };

  const canvasStyle: React.CSSProperties = {
    width: Math.max(1, dimensions.w * zoom),
    height: Math.max(1, dimensions.h * zoom),
    imageRendering: zoom > 2 ? 'pixelated' : 'auto',
    cursor: getCursorStyle(),
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < historyEntries.length - 1;

  useEffect(() => {
    setLayerOrder((prev) => {
      const knownIds = [
        ...textLayers.map((layer) => layer.id),
        ...shapeLayers.map((layer) => layer.id),
        ...adjustmentLayers.map((layer) => layer.id),
      ];
      const filtered = prev.filter((id) => knownIds.includes(id));
      const missing = knownIds.filter((id) => !filtered.includes(id));
      if (missing.length === 0 && filtered.length === prev.length) {
        return prev;
      }
      return [...filtered, ...missing];
    });
  }, [textLayers, shapeLayers, adjustmentLayers]);

  useEffect(() => {
    const applyPreset = (spacing: number, jitter: number, smoothing: number, hardness: number) => {
      if (editor.drawSettings.brushSpacing !== spacing) editor.updateDrawSetting('brushSpacing', spacing);
      if (editor.drawSettings.brushJitter !== jitter) editor.updateDrawSetting('brushJitter', jitter);
      if (editor.drawSettings.brushSmoothing !== smoothing) editor.updateDrawSetting('brushSmoothing', smoothing);
      if (editor.drawSettings.brushHardness !== hardness) editor.updateDrawSetting('brushHardness', hardness);
    };

    if (editor.drawSettings.brushPreset === 'hardRound') applyPreset(12, 0, 20, 95);
    if (editor.drawSettings.brushPreset === 'softRound') applyPreset(10, 5, 35, 45);
    if (editor.drawSettings.brushPreset === 'marker') applyPreset(22, 8, 55, 85);
  }, [
    editor,
    editor.drawSettings.brushHardness,
    editor.drawSettings.brushJitter,
    editor.drawSettings.brushPreset,
    editor.drawSettings.brushSmoothing,
    editor.drawSettings.brushSpacing,
    editor.updateDrawSetting,
  ]);

  const layerMap = new Map<string, SceneLayer>();
  for (const layer of textLayers) layerMap.set(layer.id, layer);
  for (const layer of shapeLayers) layerMap.set(layer.id, layer);
  for (const layer of adjustmentLayers) layerMap.set(layer.id, layer);

  const orderedLayers = layerOrder
    .map((id) => layerMap.get(id))
    .filter((layer): layer is SceneLayer => Boolean(layer));

  const activeTextLayer = activeLayerId ? textLayers.find((layer) => layer.id === activeLayerId) || null : null;
  const activeLayerBounds = activeLayerId ? getLayerBounds(activeLayerId) : null;

  const updateLayerVisibility = (layerId: string, visible: boolean) => {
    setTextLayers((prev) => prev.map((layer) => layer.id === layerId ? { ...layer, visible } : layer));
    setShapeLayers((prev) => prev.map((layer) => layer.id === layerId ? { ...layer, visible } : layer));
    setAdjustmentLayers((prev) => prev.map((layer) => layer.id === layerId ? { ...layer, visible } : layer));
    pushHistory(`Layer ${visible ? 'sichtbar' : 'versteckt'}`);
  };

  const updateLayerLock = (layerId: string, locked: boolean) => {
    setTextLayers((prev) => prev.map((layer) => layer.id === layerId ? { ...layer, locked } : layer));
    setShapeLayers((prev) => prev.map((layer) => layer.id === layerId ? { ...layer, locked } : layer));
    setAdjustmentLayers((prev) => prev.map((layer) => layer.id === layerId ? { ...layer, locked } : layer));
  };

  const moveLayer = (layerId: string, direction: -1 | 1) => {
    setLayerOrder((prev) => {
      const index = prev.indexOf(layerId);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    pushHistory('Layer-Reihenfolge');
  };

  const removeLayer = (layerId: string) => {
    setTextLayers((prev) => prev.filter((layer) => layer.id !== layerId));
    setShapeLayers((prev) => prev.filter((layer) => layer.id !== layerId));
    setAdjustmentLayers((prev) => prev.filter((layer) => layer.id !== layerId));
    setLayerOrder((prev) => prev.filter((id) => id !== layerId));
    if (activeLayerId === layerId) setActiveLayerId(null);
    pushHistory('Layer gelöscht');
  };

  const updateTextLayer = <K extends keyof TextLayer>(key: K, value: TextLayer[K]) => {
    if (!activeTextLayer) return;
    setTextLayers((prev) => prev.map((layer) => layer.id === activeTextLayer.id ? { ...layer, [key]: value } : layer));
  };

  const upsertAdjustmentLayer = (adjustmentType: AdjustmentType, value: number) => {
    let createdId: string | null = null;
    setAdjustmentLayers((prev) => {
      const index = prev.findIndex((layer) => layer.adjustmentType === adjustmentType);
      if (index >= 0) {
        return prev.map((layer) => layer.adjustmentType === adjustmentType ? { ...layer, value, enabled: true, visible: true } : layer);
      }
      createdId = uid('adj');
      return [
        ...prev,
        {
          id: createdId,
          kind: 'adjustment',
          name: `${getLayerNamePrefix('adjustment')} ${prev.length + 1}`,
          visible: true,
          locked: false,
          opacity: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          adjustmentType,
          enabled: true,
          value,
        },
      ];
    });
    if (createdId) {
      setLayerOrder((prev) => [...prev, createdId!]);
    }
  };

  const handleAdjustSettingChange = <K extends keyof AdjustSettings>(key: K, value: AdjustSettings[K]) => {
    editor.updateAdjustSetting(key, value);
    if (key === 'brightness' || key === 'contrast' || key === 'saturation' || key === 'blur') {
      upsertAdjustmentLayer(key, Number(value));
    }
    if (key === 'sharpen' || key === 'grayscale' || key === 'sepia' || key === 'invert') {
      upsertAdjustmentLayer(key, value ? 100 : 0);
    }
  };

  const resetAdjustmentsLayered = () => {
    const idsToRemove = adjustmentLayers.map((layer) => layer.id);
    editor.resetAdjustments();
    setAdjustmentLayers([]);
    setLayerOrder((prev) => prev.filter((id) => !idsToRemove.includes(id)));
    pushHistory('Adjustments reset');
  };

  const exportSession = () => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      width: canvas.width,
      height: canvas.height,
      bitmap: toDataUrlSafe(canvas),
      textLayers,
      shapeLayers,
      adjustmentLayers,
      layerOrder,
      guides,
      zoom,
    };
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^.]+$/, '')}.locai-session.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSessionFromFile = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as {
      bitmap: string;
      textLayers: TextLayer[];
      shapeLayers: ShapeLayer[];
      adjustmentLayers: AdjustmentLayer[];
      layerOrder: string[];
      guides?: Array<{ id: string; axis: 'x' | 'y'; value: number }>;
      zoom?: number;
    };
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setDimensions({ w: img.width, h: img.height });
      setTextLayers(cloneTextLayers(parsed.textLayers || []));
      setShapeLayers(cloneShapeLayers(parsed.shapeLayers || []));
      setAdjustmentLayers(cloneAdjustmentLayers(parsed.adjustmentLayers || []));
      setLayerOrder([...(parsed.layerOrder || [])]);
      setGuides(parsed.guides || []);
      if (typeof parsed.zoom === 'number') setZoom(parsed.zoom);
      pushHistory('Session importiert');
    };
    img.src = parsed.bitmap;
  };

  const handlePanelPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[data-panel-grip]')) return;
    e.preventDefault();
    e.stopPropagation();
    panelDragging.current = true;
    setPanelDocked(null);

    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      panelDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!panelDragging.current) return;
      const parent = containerRef.current;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const elW = panelRef.current?.offsetWidth ?? 288;
      const elH = panelRef.current?.offsetHeight ?? 400;
      const newLeft = moveEvent.clientX - parentRect.left - panelDragOffset.current.x;
      const newTop = moveEvent.clientY - parentRect.top - panelDragOffset.current.y;
      setPanelPos({
        left: Math.max(0, Math.min(parentRect.width - elW, newLeft)),
        top: Math.max(0, Math.min(parentRect.height - elH, newTop)),
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      panelDragging.current = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      const parent = containerRef.current;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const elW = panelRef.current?.offsetWidth ?? 288;
      const elH = panelRef.current?.offsetHeight ?? 400;
      const finalLeft = upEvent.clientX - parentRect.left - panelDragOffset.current.x;
      const finalTop = upEvent.clientY - parentRect.top - panelDragOffset.current.y;
      const clampedTop = Math.max(8, Math.min(parentRect.height - elH - 8, finalTop));

      const snapThreshold = 30;
      if (finalLeft + elW >= parentRect.width - snapThreshold) {
        setPanelPos({ right: 8, top: clampedTop });
        setPanelDocked('right');
        return;
      }
      if (finalLeft <= snapThreshold) {
        setPanelPos({ left: 8, top: clampedTop });
        setPanelDocked('left');
        return;
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <ImageToolbar
        activeTool={editor.activeTool}
        onToolChange={handleToolChange}
        drawSettings={editor.drawSettings}
        onDrawSettingChange={editor.updateDrawSetting}
        adjustSettings={editor.adjustSettings}
        onAdjustSettingChange={handleAdjustSettingChange}
        onApplyAdjustments={applyAdjustments}
        onResetAdjustments={resetAdjustmentsLayered}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undoFromHistory}
        onRedo={redoFromHistory}
        onReset={handleResetAll}
        onSave={handleSave}
        onSaveAs={() => { setSaveAsName(fileName); setShowSaveAs(true); }}
        onExport={() => setShowExport(true)}
        onRotate={handleRotate}
        onFlip={handleFlip}
        onApplyCrop={applyCrop}
        cropActive={cropRect !== null && cropRect.w > 2}
        compareMode={editor.compareMode}
        onToggleCompare={() => editor.setCompareMode(!editor.compareMode)}
        isDirty={editor.isDirty}
        comfyAvailable={comfyAvailable}
        rotation={editor.rotation}
        onRotationChange={(deg) => editor.setRotation(deg)}
        hasSelection={hasSelection}
        onClearSelection={clearSelection}
      />

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] flex items-center justify-center relative"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="relative inline-block"
          style={{
            width: imageLoaded ? Math.max(1, dimensions.w * zoom) : 320,
            height: imageLoaded ? Math.max(1, dimensions.h * zoom) : 220,
            filter: getFilterString(),
          }}
        >
          {showRulers && (
            <>
              <div className="absolute -top-6 left-0 right-0 h-6 bg-background/90 border border-border/60 pointer-events-none" />
              <div className="absolute top-0 -left-6 bottom-0 w-6 bg-background/90 border border-border/60 pointer-events-none" />
            </>
          )}

          <canvas
            ref={editor.canvasRef}
            style={canvasStyle}
            className="block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              isDrawingRef.current = false;
              isCroppingRef.current = false;
              isDraggingLayerRef.current = false;
              draggingLayerIdRef.current = null;
              isPanningRef.current = false;
              transformModeRef.current = null;
              transformLayerIdRef.current = null;
              transformInitialBoundsRef.current = null;
              transformInitialLayerRef.current = null;
              marqueeStartRef.current = null;
            }}
          />

          <canvas
            ref={overlayCanvasRef}
            width={dimensions.w}
            height={dimensions.h}
            style={{ ...canvasStyle, position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          />

          {orderedLayers.map((layer) => {
            if (!layer.visible) return null;
            if (layer.kind === 'text') {
              const bounds = getTextLayerMetrics(layer);
              const maskData = maskCanvasesRef.current[layer.id]?.toDataURL('image/png');
              return (
                <div
                  key={layer.id}
                  className="absolute whitespace-pre-wrap select-none pointer-events-none"
                  style={{
                    left: bounds.x * zoom,
                    top: bounds.y * zoom,
                    width: Math.max(1, bounds.width * zoom),
                    minHeight: Math.max(1, bounds.height * zoom),
                    color: layer.color,
                    opacity: clamp(layer.opacity / 100, 0.01, 1),
                    fontSize: `${layer.fontSize * zoom}px`,
                    lineHeight: `${layer.lineHeight}`,
                    fontFamily: layer.fontFamily,
                    letterSpacing: `${layer.tracking * zoom}px`,
                    textAlign: layer.align,
                    background: layer.backgroundEnabled ? layer.backgroundColor : 'transparent',
                    padding: `${layer.backgroundEnabled ? layer.backgroundPadding * zoom : 0}px`,
                    transform: `rotate(${layer.rotation}deg)`,
                    transformOrigin: 'center',
                    WebkitTextStroke: layer.strokeEnabled ? `${Math.max(1, layer.strokeWidth * zoom)}px ${layer.strokeColor}` : undefined,
                    textShadow: layer.shadowEnabled
                      ? `${layer.shadowOffsetX * zoom}px ${layer.shadowOffsetY * zoom}px ${layer.shadowBlur * zoom}px ${layer.shadowColor}`
                      : undefined,
                    WebkitMaskImage: maskData ? `url(${maskData})` : undefined,
                  }}
                >
                  {layer.text}
                </div>
              );
            }
            if (layer.kind === 'shape') {
              const bounds = getShapeBounds(layer);
              const maskData = maskCanvasesRef.current[layer.id]?.toDataURL('image/png');
              const stroke = layer.color;
              const fill = layer.filled ? layer.color : 'transparent';
              return (
                <svg
                  key={layer.id}
                  className="absolute pointer-events-none overflow-visible"
                  style={{
                    left: bounds.x * zoom,
                    top: bounds.y * zoom,
                    width: Math.max(1, bounds.width * zoom),
                    height: Math.max(1, bounds.height * zoom),
                    opacity: clamp(layer.opacity / 100, 0.01, 1),
                    transform: `rotate(${layer.rotation}deg)`,
                    transformOrigin: 'center',
                    WebkitMaskImage: maskData ? `url(${maskData})` : undefined,
                  }}
                  viewBox={`0 0 ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`}
                >
                  {layer.shapeType === 'rect' && (
                    <rect x={0} y={0} width={Math.max(1, bounds.width)} height={Math.max(1, bounds.height)} fill={fill} stroke={stroke} strokeWidth={layer.strokeWidth} />
                  )}
                  {layer.shapeType === 'circle' && (
                    <ellipse
                      cx={Math.max(1, bounds.width) / 2}
                      cy={Math.max(1, bounds.height) / 2}
                      rx={Math.max(1, bounds.width) / 2}
                      ry={Math.max(1, bounds.height) / 2}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={layer.strokeWidth}
                    />
                  )}
                  {layer.shapeType === 'line' && (
                    <line x1={0} y1={0} x2={Math.max(1, bounds.width)} y2={Math.max(1, bounds.height)} stroke={stroke} strokeWidth={layer.strokeWidth} />
                  )}
                  {layer.shapeType === 'arrow' && (
                    <>
                      <line x1={0} y1={0} x2={Math.max(1, bounds.width)} y2={Math.max(1, bounds.height)} stroke={stroke} strokeWidth={layer.strokeWidth} />
                      <polygon
                        points={`${Math.max(1, bounds.width)},${Math.max(1, bounds.height)} ${Math.max(1, bounds.width) - 10},${Math.max(1, bounds.height) - 4} ${Math.max(1, bounds.width) - 4},${Math.max(1, bounds.height) - 10}`}
                        fill={stroke}
                      />
                    </>
                  )}
                </svg>
              );
            }
            return null;
          })}

          {activeLayerId && activeLayerBounds && (editor.activeTool === 'select' || editor.activeTool === 'text') && (
            <div
              className="absolute border border-primary border-dashed pointer-events-none"
              style={{
                left: activeLayerBounds.x * zoom,
                top: activeLayerBounds.y * zoom,
                width: activeLayerBounds.width * zoom,
                height: activeLayerBounds.height * zoom,
              }}
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                const handleStyle: Record<typeof handle, React.CSSProperties> = {
                  nw: { left: -6, top: -6, cursor: 'nwse-resize' },
                  ne: { right: -6, top: -6, cursor: 'nesw-resize' },
                  sw: { left: -6, bottom: -6, cursor: 'nesw-resize' },
                  se: { right: -6, bottom: -6, cursor: 'nwse-resize' },
                };
                return (
                  <button
                    key={handle}
                    type="button"
                    className="absolute w-3 h-3 rounded-sm bg-primary border border-background pointer-events-auto"
                    style={handleStyle[handle]}
                    onMouseDown={(e) => activeLayerId && beginLayerTransform(handle, activeLayerId, e)}
                  />
                );
              })}
              <button
                type="button"
                className="absolute left-1/2 -translate-x-1/2 -top-5 w-3 h-3 rounded-full bg-primary border border-background pointer-events-auto cursor-grab"
                onMouseDown={(e) => activeLayerId && beginLayerTransform('rotate', activeLayerId, e)}
              />
            </div>
          )}

          {guides.map((guide) => (
            <div
              key={guide.id}
              className="absolute pointer-events-none bg-cyan-500/70"
              style={guide.axis === 'x'
                ? { left: guide.value * zoom, top: 0, bottom: 0, width: 1 }
                : { top: guide.value * zoom, left: 0, right: 0, height: 1 }}
            />
          ))}
          {smartGuide.x !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-fuchsia-500/80 pointer-events-none" style={{ left: smartGuide.x * zoom }} />
          )}
          {smartGuide.y !== null && (
            <div className="absolute left-0 right-0 h-px bg-fuchsia-500/80 pointer-events-none" style={{ top: smartGuide.y * zoom }} />
          )}

          {/* Crop overlay */}
          {cropRect && editor.activeTool === 'crop' && (
            <div
              className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
              style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
            />
          )}

          {/* Blur region overlay */}
          {cropRect && editor.activeTool === 'blurRegion' && (
            <div
              className="absolute border-2 border-dashed border-yellow-500 bg-yellow-500/10 pointer-events-none"
              style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
            />
          )}

          {/* Compare slider */}
          {editor.compareMode && editor.originalDataRef.current && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editor.originalDataRef.current}
                alt="Original"
                className="absolute top-0 left-0 h-full object-cover"
                style={{
                  width: dimensions.w * zoom,
                  clipPath: `inset(0 ${100 - editor.comparePosition}% 0 0)`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary cursor-ew-resize pointer-events-auto"
                style={{ left: `${editor.comparePosition}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const container = containerRef.current;
                  if (!container) return;
                  const handleMove = (ev: MouseEvent) => {
                    const rect = container.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
                    editor.setComparePosition(pct);
                  };
                  const handleUp = () => {
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleUp);
                  };
                  document.addEventListener('mousemove', handleMove);
                  document.addEventListener('mouseup', handleUp);
                }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary border-2 border-primary-foreground flex items-center justify-center">
                  <span className="text-[8px] text-primary-foreground font-bold">⇔</span>
                </div>
              </div>
            </div>
          )}

          {/* Text input overlay */}
          {textPos && (editor.activeTool === 'text' || editingLayerId) && (
            <div className="absolute" style={{ left: textPos.x * zoom, top: textPos.y * zoom }}>
              <div className="flex flex-col gap-1 bg-background border border-border rounded shadow-lg p-1.5">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="bg-transparent border border-border/40 rounded outline-none text-xs px-1.5 py-1 w-52 min-h-16"
                  placeholder="Mehrzeiligen Text eingeben..."
                  autoFocus
                />
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" className="h-5 px-1.5 text-xs" onClick={finalizeText}>
                    {editingLayerId ? 'Übernehmen' : 'Einfügen'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 px-1 text-xs" onClick={() => { setTextPos(null); setEditingLayerId(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Layer panel - outside the filtered div so CSS filters don't affect it */}
        <div
          ref={panelRef}
          onPointerDown={handlePanelPointerDown}
          className={`absolute z-10 w-72 max-h-[calc(100%-1rem)] rounded-lg overflow-hidden transition-shadow duration-200
            border border-border/50 bg-background/95 backdrop-blur-md shadow-xl
            ${panelDocked ? 'ring-1 ring-primary/20' : ''}
          `}
          style={panelPos}
        >
          {/* Grip handle */}
          <div
            data-panel-grip
            className={`flex cursor-grab items-center justify-center gap-1.5 border-b py-1.5 active:cursor-grabbing transition-colors
              ${panelDocked ? 'border-primary/20 bg-primary/5' : 'border-border/40 bg-muted/30'}
            `}
          >
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          </div>

          <Tabs value={activePanelTab} onValueChange={setActivePanelTab} className="h-full">
            <TabsList className="w-full rounded-none border-b border-border/40 bg-muted/10 p-1 h-auto gap-0.5">
              <TabsTrigger value="layers" className="text-[11px] px-2 py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Layers className="h-3 w-3 mr-1" />Ebenen</TabsTrigger>
              <TabsTrigger value="history" className="text-[11px] px-2 py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"><History className="h-3 w-3 mr-1" />History</TabsTrigger>
              <TabsTrigger value="text" className="text-[11px] px-2 py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">Text</TabsTrigger>
              <TabsTrigger value="guides" className="text-[11px] px-2 py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">Guides</TabsTrigger>
              <TabsTrigger value="session" className="text-[11px] px-2 py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">Session</TabsTrigger>
            </TabsList>

            <TabsContent value="layers" className="h-[22rem]">
              <ScrollArea className="h-full">
                <div className="p-2.5 space-y-2.5">
                  {/* Quick-add adjustment buttons */}
                  <div className="grid grid-cols-4 gap-1">
                    {(['brightness', 'contrast', 'saturation', 'blur', 'grayscale', 'sepia', 'invert', 'sharpen'] as AdjustmentType[]).map((type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant="outline"
                        className="h-7 px-1.5 text-[10px] font-medium hover:bg-primary/10 hover:border-primary/30 transition-colors"
                        onClick={() => addAdjustmentLayer(type)}
                      >
                        +{type.slice(0, 3)}
                      </Button>
                    ))}
                  </div>

                  {/* Layer list */}
                  {orderedLayers.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-3">Keine Ebenen vorhanden</p>
                  )}
                  {orderedLayers.slice().reverse().map((layer) => (
                    <div
                      key={layer.id}
                      className={`border rounded-md px-2.5 py-1.5 transition-colors cursor-pointer
                        ${activeLayerId === layer.id
                          ? 'border-primary/60 bg-primary/8 shadow-sm'
                          : 'border-border/40 hover:border-border/70 hover:bg-muted/30'
                        }`}
                      onClick={() => setActiveLayerId(layer.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <button type="button" className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); updateLayerVisibility(layer.id, !layer.visible); }}>
                          {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); updateLayerLock(layer.id, !layer.locked); }}>
                          {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                        </button>
                        <span className="text-[11px] truncate text-left flex-1 font-medium">{layer.name}</span>
                        <button type="button" className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1); }}><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1); }}><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" className="p-0.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="h-[22rem]">
              <ScrollArea className="h-full">
                <div className="p-2.5 space-y-1">
                  {historyEntries.map((entry, idx) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors
                        ${historyIndex === idx ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted/50'}`}
                      onClick={() => jumpToHistory(idx)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="text" className="h-[22rem]">
              <ScrollArea className="h-full">
                <div className="p-2.5 space-y-3 text-xs">
                  {!activeTextLayer ? (
                    <p className="text-muted-foreground text-center py-3">Kein Text-Layer ausgewählt.</p>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Schriftgrösse</label>
                        <div className="flex items-center gap-2">
                          <Slider value={[activeTextLayer.fontSize]} onValueChange={([v]) => updateTextLayer('fontSize', v)} min={8} max={200} step={1} />
                          <span className="text-[11px] font-mono w-7 text-right">{activeTextLayer.fontSize}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Schriftfarbe</label>
                        <input type="color" value={activeTextLayer.color} onChange={(e) => updateTextLayer('color', e.target.value)} className="h-7 w-full rounded border border-border cursor-pointer" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Schriftart</label>
                        <select value={activeTextLayer.fontFamily} onChange={(e) => updateTextLayer('fontFamily', e.target.value)} className="w-full h-7 rounded border border-border bg-background text-xs px-1.5">
                          <option value="sans-serif">Sans-Serif</option>
                          <option value="serif">Serif</option>
                          <option value="monospace">Monospace</option>
                          <option value="Arial">Arial</option>
                          <option value="Helvetica">Helvetica</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Courier New">Courier New</option>
                          <option value="Verdana">Verdana</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Deckkraft</label>
                        <div className="flex items-center gap-2">
                          <Slider value={[Math.round(activeTextLayer.opacity * 100)]} onValueChange={([v]) => updateTextLayer('opacity', v / 100)} min={0} max={100} step={1} />
                          <span className="text-[11px] font-mono w-7 text-right">{Math.round(activeTextLayer.opacity * 100)}%</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Zeilenhöhe</label>
                        <div className="flex items-center gap-2">
                          <Slider value={[activeTextLayer.lineHeight]} onValueChange={([v]) => updateTextLayer('lineHeight', v)} min={0.8} max={3} step={0.1} />
                          <span className="text-[11px] font-mono w-7 text-right">{activeTextLayer.lineHeight.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Tracking</label>
                        <Slider value={[activeTextLayer.tracking]} onValueChange={([v]) => updateTextLayer('tracking', v)} min={-2} max={20} step={0.5} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Kerning</label>
                        <Slider value={[activeTextLayer.kerning]} onValueChange={([v]) => updateTextLayer('kerning', v)} min={-10} max={10} step={0.5} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant={activeTextLayer.align === 'left' ? 'default' : 'outline'} className="h-7 text-[11px] flex-1" onClick={() => updateTextLayer('align', 'left')}>L</Button>
                        <Button size="sm" variant={activeTextLayer.align === 'center' ? 'default' : 'outline'} className="h-7 text-[11px] flex-1" onClick={() => updateTextLayer('align', 'center')}>C</Button>
                        <Button size="sm" variant={activeTextLayer.align === 'right' ? 'default' : 'outline'} className="h-7 text-[11px] flex-1" onClick={() => updateTextLayer('align', 'right')}>R</Button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <label className="flex items-center gap-2"><input type="checkbox" className="rounded" checked={activeTextLayer.backgroundEnabled} onChange={(e) => updateTextLayer('backgroundEnabled', e.target.checked)} />Hintergrundbox</label>
                        <label className="flex items-center gap-2"><input type="checkbox" className="rounded" checked={activeTextLayer.strokeEnabled} onChange={(e) => updateTextLayer('strokeEnabled', e.target.checked)} />Stroke</label>
                        <label className="flex items-center gap-2"><input type="checkbox" className="rounded" checked={activeTextLayer.shadowEnabled} onChange={(e) => updateTextLayer('shadowEnabled', e.target.checked)} />Shadow</label>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="guides" className="h-[22rem]">
              <div className="p-2.5 space-y-2.5 text-xs">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2"><input type="checkbox" className="rounded" checked={showRulers} onChange={(e) => setShowRulers(e.target.checked)} />Lineale</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="rounded" checked={snapToGuides} onChange={(e) => setSnapToGuides(e.target.checked)} />Smart Guides</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="rounded" checked={pixelSnap} onChange={(e) => setPixelSnap(e.target.checked)} />Pixel Snap</label>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button size="sm" className="h-7 text-[11px] flex-1" onClick={() => setGuides((prev) => [...prev, { id: uid('guide'), axis: 'x', value: dimensions.w / 2 }])}><Plus className="h-3 w-3 mr-1" />V</Button>
                  <Button size="sm" className="h-7 text-[11px] flex-1" onClick={() => setGuides((prev) => [...prev, { id: uid('guide'), axis: 'y', value: dimensions.h / 2 }])}><Plus className="h-3 w-3 mr-1" />H</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setGuides([])}>Clear</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="session" className="h-[22rem]">
              <div className="p-2.5 space-y-2.5 text-xs">
                <Button size="sm" className="h-8 text-xs w-full" onClick={exportSession}>Session exportieren</Button>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground font-medium">Session importieren</span>
                  <input
                    type="file"
                    accept=".json,.locai-session.json"
                    className="mt-1.5 block w-full text-[11px]"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void importSessionFromFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" className="rounded" checked={maskMode} onChange={(e) => setMaskMode(e.target.checked)} />Layer-Mask-Modus</label>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {!imageLoaded && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
            {imageLoadError ? (
              <p className="text-xs text-destructive px-4 text-center max-w-xs">{imageLoadError}</p>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground flex-shrink-0">
        <span>{dimensions.w} × {dimensions.h} px</span>
        <div className="flex items-center gap-2">
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <Slider
            value={[zoom * 100]}
            onValueChange={([v]) => setZoom(v / 100)}
            min={10}
            max={400}
            step={5}
            className="w-24"
          />
        </div>
        {editor.isDirty && <span className="text-amber-500">● Ungespeichert</span>}
      </div>

      {/* AI Describe panel */}
      {editor.activeTool === 'aiDescribe' && (
        <div className="border-t border-border/40 bg-muted/30 p-3 max-h-40 overflow-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">AI Bildbeschreibung</span>
            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => editor.setActiveTool('select')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Analysiere Bild...
            </div>
          ) : (
            <p className="text-xs whitespace-pre-wrap">{aiDescription || 'Keine Beschreibung verfügbar.'}</p>
          )}
        </div>
      )}

      {/* AI Edit panel */}
      {editor.activeTool === 'aiEdit' && (
        <div className="border-t border-border/40 bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">AI Bild bearbeiten (img2img)</span>
            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => editor.setActiveTool('select')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          {!comfyAvailable ? (
            <p className="text-xs text-muted-foreground">ComfyUI ist nicht gestartet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {aiEditWorkflows.length > 1 && (
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 text-xs outline-none"
                >
                  {aiEditWorkflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={aiEditPrompt}
                onChange={(e) => setAiEditPrompt(e.target.value)}
                placeholder="Beschreibe die gewünschte Änderung..."
                className="bg-background border border-border rounded px-2 py-1 text-xs outline-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Denoise</span>
                <Slider
                  value={[aiEditDenoise * 100]}
                  onValueChange={([v]) => setAiEditDenoise(v / 100)}
                  min={30}
                  max={90}
                  step={5}
                  className="w-32"
                />
                <span className="text-xs font-mono">{aiEditDenoise.toFixed(2)}</span>
                <Button size="sm" className="h-6 text-xs ml-auto" onClick={handleAiEdit} disabled={aiEditLoading || !aiEditPrompt.trim()}>
                  {aiEditLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Generieren
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resize dialog */}
      <Dialog open={showResize} onOpenChange={setShowResize}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Grösse ändern</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm w-14">Breite</label>
              <input
                type="number"
                value={resizeW}
                onChange={(e) => {
                  const w = parseInt(e.target.value) || 1;
                  setResizeW(w);
                  if (resizeLock) setResizeH(Math.round(w / aspectRef.current));
                }}
                className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm w-14">Höhe</label>
              <input
                type="number"
                value={resizeH}
                onChange={(e) => {
                  const h = parseInt(e.target.value) || 1;
                  setResizeH(h);
                  if (resizeLock) setResizeW(Math.round(h * aspectRef.current));
                }}
                className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={resizeLock} onChange={(e) => setResizeLock(e.target.checked)} />
              Seitenverhältnis beibehalten
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowResize(false)}>Abbrechen</Button>
            <Button onClick={applyResize}>Anwenden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save As dialog */}
      <Dialog open={showSaveAs} onOpenChange={setShowSaveAs}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Speichern unter</DialogTitle></DialogHeader>
          <input
            type="text"
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
            placeholder="dateiname.png"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveAs(false)}>Abbrechen</Button>
            <Button onClick={handleSaveAs}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Exportieren</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm w-14">Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg')}
                className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
            </div>
            {exportFormat === 'jpeg' && (
              <div className="flex items-center gap-2">
                <label className="text-sm w-14">Qualität</label>
                <Slider
                  value={[exportQuality]}
                  onValueChange={([v]) => setExportQuality(v)}
                  min={10}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-8">{exportQuality}%</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExport(false)}>Abbrechen</Button>
            <Button onClick={handleExport}>Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
