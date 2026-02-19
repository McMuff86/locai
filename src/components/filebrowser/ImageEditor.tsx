"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
import type { ImageTool, CropRect } from '@/hooks/useImageEditor';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImageEditorProps {
  imageUrl: string;
  rootId: string;
  relativePath: string;
  fileName: string;
}

interface Point {
  x: number;
  y: number;
}

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  opacity: number;
}

const TEXT_LINE_HEIGHT = 1.2;

// ── Utility functions ─────────────────────────────────────────────────────────

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  filled: boolean,
) {
  ctx.beginPath();
  switch (shape) {
    case 'rect': {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      if (filled) ctx.fillRect(x, y, w, h);
      else ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'circle': {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (filled) ctx.fill();
      else ctx.stroke();
      break;
    }
    case 'line': {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = 12;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
  }
}

function applySharpen(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const out = output.data;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            val += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        out[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, val));
      }
      out[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
    }
  }
  return output;
}

function boxBlur(imageData: ImageData, radius: number): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const out = output.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = (ny * width + nx) * 4;
            r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; a += data[idx + 3];
            count++;
          }
        }
      }
      const idx = (y * width + x) * 4;
      out[idx] = r / count;
      out[idx + 1] = g / count;
      out[idx + 2] = b / count;
      out[idx + 3] = a / count;
    }
  }
  return output;
}

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

  // Text overlay state
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [activeTextLayerId, setActiveTextLayerId] = useState<string | null>(null);
  const isDraggingTextRef = useRef(false);
  const draggingTextIdRef = useRef<string | null>(null);
  const textDragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const textMoveChangedRef = useRef(false);

  const aspectRef = useRef(1);

  // ── Load image ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setImageLoaded(false);
    setImageLoadError(null);
    setTextLayers([]);
    setActiveTextLayerId(null);
    setTextPos(null);

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

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); editor.undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); editor.redo(); }

      if (
        activeTextLayerId &&
        editor.activeTool === 'text' &&
        (e.key === 'Delete' || e.key === 'Backspace')
      ) {
        const target = e.target as HTMLElement | null;
        const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
        if (!typing) {
          e.preventDefault();
          setTextLayers(prev => prev.filter((layer) => layer.id !== activeTextLayerId));
          setActiveTextLayerId(null);
          editor.setIsDirty(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor, activeTextLayerId]);

  // ── CSS filter string ───────────────────────────────────────────
  const getFilterString = useCallback(() => {
    const { brightness, contrast, saturation, blur, grayscale, sepia, invert } = editor.adjustSettings;
    const parts: string[] = [];
    if (brightness !== 0) parts.push(`brightness(${1 + brightness / 100})`);
    if (contrast !== 0) parts.push(`contrast(${1 + contrast / 100})`);
    if (saturation !== 100) parts.push(`saturate(${saturation / 100})`);
    if (blur > 0) parts.push(`blur(${blur}px)`);
    if (grayscale) parts.push('grayscale(1)');
    if (sepia) parts.push('sepia(1)');
    if (invert) parts.push('invert(1)');
    return parts.join(' ') || 'none';
  }, [editor.adjustSettings]);

  // ── Apply adjustments permanently ───────────────────────────────
  const applyAdjustments = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    editor.saveState();

    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tctx = temp.getContext('2d')!;
    tctx.filter = getFilterString();
    tctx.drawImage(canvas, 0, 0);

    if (editor.adjustSettings.sharpen) {
      const imgData = tctx.getImageData(0, 0, temp.width, temp.height);
      const sharpened = applySharpen(imgData);
      tctx.putImageData(sharpened, 0, 0);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0);
    editor.resetAdjustments();
    setDimensions({ w: canvas.width, h: canvas.height });
  }, [editor, getFilterString]);

  // ── Rotate ──────────────────────────────────────────────────────
  const handleRotate = useCallback((deg: number) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    editor.saveState();
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
      const textW = Math.max(1, layer.text.length * layer.fontSize * 0.58);
      const textH = layer.fontSize * TEXT_LINE_HEIGHT;

      if (normalized === 90) {
        return { ...layer, x: oldH - layer.y - textH, y: layer.x };
      }
      if (normalized === 270) {
        return { ...layer, x: layer.y, y: oldW - layer.x - textW };
      }
      if (normalized === 180) {
        return { ...layer, x: oldW - layer.x - textW, y: oldH - layer.y - textH };
      }
      return layer;
    }));

    setDimensions({ w: canvas.width, h: canvas.height });
  }, [editor]);

  // ── Flip ────────────────────────────────────────────────────────
  const handleFlip = useCallback((dir: 'h' | 'v') => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    editor.saveState();

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
      const textW = Math.max(1, layer.text.length * layer.fontSize * 0.58);
      const textH = layer.fontSize * TEXT_LINE_HEIGHT;
      if (dir === 'h') {
        return { ...layer, x: canvas.width - layer.x - textW };
      }
      return { ...layer, y: canvas.height - layer.y - textH };
    }));
  }, [editor]);

  // ── Crop ────────────────────────────────────────────────────────
  const applyCrop = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas || !cropRect) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    editor.saveState();

    const cx = Math.round(cropRect.x / zoom);
    const cy = Math.round(cropRect.y / zoom);
    const cw = Math.round(cropRect.w / zoom);
    const ch = Math.round(cropRect.h / zoom);

    const imgData = ctx.getImageData(cx, cy, cw, ch);
    canvas.width = cw;
    canvas.height = ch;
    ctx.putImageData(imgData, 0, 0);
    setTextLayers(prev => prev
      .map((layer) => ({ ...layer, x: layer.x - cx, y: layer.y - cy }))
      .filter((layer) => {
        const textW = Math.max(1, layer.text.length * layer.fontSize * 0.58);
        const textH = layer.fontSize * TEXT_LINE_HEIGHT;
        return (
          layer.x + textW > 0 &&
          layer.y + textH > 0 &&
          layer.x < cw &&
          layer.y < ch
        );
      }));
    setCropRect(null);
    setDimensions({ w: cw, h: ch });
  }, [editor, cropRect, zoom]);

  // ── Resize ──────────────────────────────────────────────────────
  const applyResize = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    editor.saveState();
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
    })));

    setDimensions({ w: resizeW, h: resizeH });
    setShowResize(false);
  }, [editor, resizeW, resizeH]);

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
      return {
        width: Math.max(1, layer.text.length * layer.fontSize * 0.58),
        height: layer.fontSize * TEXT_LINE_HEIGHT,
      };
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        width: Math.max(1, layer.text.length * layer.fontSize * 0.58),
        height: layer.fontSize * TEXT_LINE_HEIGHT,
      };
    }

    ctx.save();
    ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
    const width = Math.max(1, ctx.measureText(layer.text).width);
    ctx.restore();
    return { width, height: layer.fontSize * TEXT_LINE_HEIGHT };
  }, [editor.canvasRef]);

  const findTextLayerAtPoint = useCallback((point: Point): TextLayer | null => {
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const layer = textLayers[i];
      const { width, height } = getTextLayerMetrics(layer);
      if (
        point.x >= layer.x &&
        point.x <= layer.x + width &&
        point.y >= layer.y &&
        point.y <= layer.y + height
      ) {
        return layer;
      }
    }
    return null;
  }, [textLayers, getTextLayerMetrics]);

  const renderTextLayer = useCallback((ctx: CanvasRenderingContext2D, layer: TextLayer) => {
    ctx.save();
    ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
    ctx.fillStyle = layer.color;
    ctx.globalAlpha = clamp(layer.opacity / 100, 0.01, 1);
    ctx.textBaseline = 'top';
    ctx.fillText(layer.text, layer.x, layer.y);
    ctx.restore();
  }, [clamp]);

  const createCompositeCanvas = useCallback(() => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return null;

    const composite = document.createElement('canvas');
    composite.width = canvas.width;
    composite.height = canvas.height;
    const cctx = composite.getContext('2d');
    if (!cctx) return null;

    cctx.drawImage(canvas, 0, 0);
    for (const layer of textLayers) {
      renderTextLayer(cctx, layer);
    }
    return composite;
  }, [editor.canvasRef, textLayers, renderTextLayer]);

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

  const drawShapeOnCanvas = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = editor.drawSettings.color;
    ctx.fillStyle = editor.drawSettings.color;
    ctx.lineWidth = editor.drawSettings.strokeWidth;
    drawShape(ctx, editor.drawSettings.shapeType, start, end, editor.drawSettings.shapeFilled);
  }, [editor.canvasRef, editor.drawSettings]);

  const clearOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  const paintBrushSegment = useCallback((
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    erasing: boolean,
  ) => {
    const { brushSize, brushOpacity, brushFlow, color } = editor.drawSettings;
    const radius = Math.max(0.5, brushSize / 2);
    const spacing = Math.max(0.75, brushSize * 0.12);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    const alpha = clamp((brushOpacity / 100) * (brushFlow / 100), 0.01, 1);

    ctx.save();
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.fillStyle = erasing ? 'rgba(0,0,0,1)' : color;
    ctx.globalAlpha = alpha;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [editor.drawSettings, clamp]);

  // ── Mouse handlers ──────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const realPos = getCanvasRealPos(e);

    if (e.button !== 0) return;

    if (editor.activeTool === 'crop' || editor.activeTool === 'blurRegion') {
      isCroppingRef.current = true;
      startPosRef.current = pos;
      setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      return;
    }

    if (editor.activeTool === 'colorPicker') {
      const canvas = editor.canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pixel = ctx.getImageData(Math.round(realPos.x), Math.round(realPos.y), 1, 1).data;
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      editor.updateDrawSetting('color', hex);
      toast({ title: 'Farbe aufgenommen', description: hex });
      return;
    }

    if (editor.activeTool === 'text') {
      const hit = findTextLayerAtPoint(realPos);
      if (hit) {
        setActiveTextLayerId(hit.id);
        isDraggingTextRef.current = true;
        draggingTextIdRef.current = hit.id;
        textDragOffsetRef.current = { x: realPos.x - hit.x, y: realPos.y - hit.y };
        textMoveChangedRef.current = false;
        return;
      }

      setActiveTextLayerId(null);
      setTextPos(realPos);
      setTextInput('');
      return;
    }

    if (editor.activeTool === 'draw' || editor.activeTool === 'eraser') {
      const canvas = editor.canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      editor.saveState();
      isDrawingRef.current = true;
      lastPosRef.current = realPos;
      paintBrushSegment(ctx, realPos, realPos, editor.activeTool === 'eraser');
      return;
    }

    if (editor.activeTool === 'shapes') {
      isDrawingRef.current = true;
      startPosRef.current = realPos;
      lastPosRef.current = realPos;
      editor.saveState();
      return;
    }
  }, [editor, getCanvasPos, getCanvasRealPos, toast, findTextLayerAtPoint, paintBrushSegment]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const realPos = getCanvasRealPos(e);

    if (isDraggingTextRef.current && draggingTextIdRef.current) {
      const canvas = editor.canvasRef.current;
      if (!canvas) return;
      const dragId = draggingTextIdRef.current;
      setTextLayers(prev => prev.map((layer) => {
        if (layer.id !== dragId) return layer;
        const { width, height } = getTextLayerMetrics(layer);
        const nextX = clamp(realPos.x - textDragOffsetRef.current.x, 0, Math.max(0, canvas.width - width));
        const nextY = clamp(realPos.y - textDragOffsetRef.current.y, 0, Math.max(0, canvas.height - height));
        return { ...layer, x: nextX, y: nextY };
      }));
      textMoveChangedRef.current = true;
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
      const canvas = editor.canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      paintBrushSegment(ctx, lastPosRef.current, realPos, editor.activeTool === 'eraser');
      lastPosRef.current = realPos;
      return;
    }

    if (editor.activeTool === 'shapes' && isDrawingRef.current) {
      lastPosRef.current = realPos;
      drawShapePreview(realPos);
      return;
    }
  }, [editor, getCanvasPos, getCanvasRealPos, drawShapePreview, paintBrushSegment, getTextLayerMetrics, clamp]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const realPos = getCanvasRealPos(e);

    if (isDraggingTextRef.current) {
      isDraggingTextRef.current = false;
      draggingTextIdRef.current = null;
      if (textMoveChangedRef.current) {
        editor.setIsDirty(true);
      }
      textMoveChangedRef.current = false;
      return;
    }

    if (editor.activeTool === 'blurRegion' && isCroppingRef.current && cropRect) {
      isCroppingRef.current = false;
      const canvas = editor.canvasRef.current;
      if (!canvas || cropRect.w < 2 || cropRect.h < 2) { setCropRect(null); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { setCropRect(null); return; }

      editor.saveState();

      const rx = Math.round(cropRect.x / zoom);
      const ry = Math.round(cropRect.y / zoom);
      const rw = Math.round(cropRect.w / zoom);
      const rh = Math.round(cropRect.h / zoom);

      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const blurred = boxBlur(imgData, 8);
      ctx.putImageData(blurred, rx, ry);
      setCropRect(null);
      return;
    }

    if (editor.activeTool === 'crop' && isCroppingRef.current) {
      isCroppingRef.current = false;
      return;
    }

    if ((editor.activeTool === 'draw' || editor.activeTool === 'eraser') && isDrawingRef.current) {
      isDrawingRef.current = false;
      return;
    }

    if (editor.activeTool === 'shapes' && isDrawingRef.current) {
      isDrawingRef.current = false;
      drawShapeOnCanvas(startPosRef.current, realPos);
      clearOverlay();
      return;
    }
  }, [editor, cropRect, zoom, getCanvasRealPos, drawShapeOnCanvas, clearOverlay]);

  // ── Text finalize ───────────────────────────────────────────────
  const finalizeText = useCallback(() => {
    if (!textPos || !textInput.trim()) { setTextPos(null); return; }
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setTextLayers(prev => [
      ...prev,
      {
        id,
        text: textInput.trim(),
        x: textPos.x,
        y: textPos.y,
        fontSize: editor.drawSettings.fontSize,
        fontFamily: editor.drawSettings.fontFamily,
        color: editor.drawSettings.color,
        opacity: editor.drawSettings.brushOpacity,
      },
    ]);
    setActiveTextLayerId(id);
    editor.setIsDirty(true);
    setTextPos(null);
    setTextInput('');
  }, [editor, textInput, textPos]);

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
        body: JSON.stringify({ image: base64, prompt: aiEditPrompt, denoise: aiEditDenoise }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (data.resultImage) {
        editor.saveState();
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0);
          setDimensions({ w: img.width, h: img.height });
        };
        img.src = 'data:image/png;base64,' + data.resultImage;
      }
      toast({ title: 'AI Edit abgeschlossen' });
    } catch (err) {
      toast({ title: 'AI Fehler', description: err instanceof Error ? err.message : 'Fehler', variant: 'destructive' });
    } finally {
      setAiEditLoading(false);
    }
  }, [editor, aiEditPrompt, aiEditDenoise, toast, createCompositeCanvas]);

  // ── Tool change ─────────────────────────────────────────────────
  const handleToolChange = useCallback((tool: ImageTool) => {
    editor.setActiveTool(tool);
    setCropRect(null);
    setTextPos(null);

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
  }, [editor, handleAiDescribe]);

  const handleResetAll = useCallback(() => {
    editor.resetToOriginal();
    setTextLayers([]);
    setActiveTextLayerId(null);
    setTextPos(null);
    setTextInput('');
  }, [editor]);

  const canvasStyle: React.CSSProperties = {
    width: Math.max(1, dimensions.w * zoom),
    height: Math.max(1, dimensions.h * zoom),
    filter: getFilterString(),
    imageRendering: zoom > 2 ? 'pixelated' : 'auto',
  };

  return (
    <div className="flex flex-col h-full">
      <ImageToolbar
        activeTool={editor.activeTool}
        onToolChange={handleToolChange}
        drawSettings={editor.drawSettings}
        onDrawSettingChange={editor.updateDrawSetting}
        adjustSettings={editor.adjustSettings}
        onAdjustSettingChange={editor.updateAdjustSetting}
        onApplyAdjustments={applyAdjustments}
        onResetAdjustments={editor.resetAdjustments}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
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
          }}
        >
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
              isDraggingTextRef.current = false;
              draggingTextIdRef.current = null;
            }}
          />

          <canvas
            ref={overlayCanvasRef}
            width={dimensions.w}
            height={dimensions.h}
            style={{ ...canvasStyle, position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          />

          {textLayers.map((layer) => {
            const { width, height } = getTextLayerMetrics(layer);
            const isActive = layer.id === activeTextLayerId;
            return (
              <div
                key={layer.id}
                className={`absolute whitespace-pre select-none ${isActive && editor.activeTool === 'text' ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                style={{
                  left: layer.x * zoom,
                  top: layer.y * zoom,
                  width: Math.max(1, width * zoom),
                  minHeight: Math.max(1, height * zoom),
                  color: layer.color,
                  opacity: clamp(layer.opacity / 100, 0.01, 1),
                  fontSize: `${layer.fontSize * zoom}px`,
                  lineHeight: `${TEXT_LINE_HEIGHT}`,
                  fontFamily: layer.fontFamily,
                  border: editor.activeTool === 'text' ? '1px dashed hsl(var(--primary) / 0.7)' : 'none',
                  padding: editor.activeTool === 'text' ? '1px 2px' : 0,
                  pointerEvents: 'none',
                }}
              >
                {layer.text}
              </div>
            );
          })}

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
          {textPos && editor.activeTool === 'text' && (
            <div className="absolute" style={{ left: textPos.x * zoom, top: textPos.y * zoom }}>
              <div className="flex items-center gap-1 bg-background border border-border rounded shadow-lg p-1">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') finalizeText(); if (e.key === 'Escape') setTextPos(null); }}
                  className="bg-transparent border-none outline-none text-sm px-1 w-40"
                  placeholder="Text eingeben..."
                  autoFocus
                />
                <Button size="sm" className="h-5 px-1.5 text-xs" onClick={finalizeText}>OK</Button>
                <Button size="sm" variant="ghost" className="h-5 px-1 text-xs" onClick={() => setTextPos(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
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
