// ============================================================================
// Image Editor — Utility Functions
// ============================================================================

import type {
  TextLayer,
  ShapeLayer,
  AdjustmentLayer,
  TransformBounds,
} from './types';

// ---------------------------------------------------------------------------
// UID
// ---------------------------------------------------------------------------

export function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Canvas Helpers
// ---------------------------------------------------------------------------

export function toDataUrlSafe(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Layer Cloning
// ---------------------------------------------------------------------------

export function cloneTextLayers(layers: TextLayer[]): TextLayer[] {
  return layers.map((layer) => ({ ...layer }));
}

export function cloneShapeLayers(layers: ShapeLayer[]): ShapeLayer[] {
  return layers.map((layer) => ({ ...layer }));
}

export function cloneAdjustmentLayers(layers: AdjustmentLayer[]): AdjustmentLayer[] {
  return layers.map((layer) => ({ ...layer }));
}

// ---------------------------------------------------------------------------
// Image Processing
// ---------------------------------------------------------------------------

export function applySharpen(imageData: ImageData): ImageData {
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

export function boxBlur(imageData: ImageData, radius: number): ImageData {
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

// ---------------------------------------------------------------------------
// Drawing Functions
// ---------------------------------------------------------------------------

export function drawShape(
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

export function drawTextLineWithTracking(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  tracking: number,
) {
  if (tracking === 0 || line.length <= 1) {
    ctx.fillText(line, x, y);
    return;
  }
  let cursor = x;
  for (const ch of line) {
    ctx.fillText(ch, cursor, y);
    const w = ctx.measureText(ch).width;
    cursor += w + tracking;
  }
}

// ---------------------------------------------------------------------------
// Layer Geometry
// ---------------------------------------------------------------------------

export function getTextMetricsForLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
): TransformBounds {
  ctx.save();
  ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;

  const lines = layer.text.split('\n');
  const lineHeightPx = layer.fontSize * layer.lineHeight;
  const widths = lines.map((line) => {
    if (line.length <= 1) {
      return Math.max(1, ctx.measureText(line).width);
    }
    const base = ctx.measureText(line).width;
    const trackingExtra = Math.max(0, line.length - 1) * layer.tracking;
    return Math.max(1, base + trackingExtra);
  });

  const contentWidth = Math.max(1, ...widths);
  const contentHeight = Math.max(lineHeightPx, lines.length * lineHeightPx);
  const padding = layer.backgroundEnabled ? layer.backgroundPadding : 0;

  ctx.restore();

  return {
    x: layer.x,
    y: layer.y,
    width: contentWidth + padding * 2,
    height: contentHeight + padding * 2,
  };
}

export function getShapeBounds(layer: ShapeLayer): TransformBounds {
  const w = Math.max(1, layer.width * layer.scaleX);
  const h = Math.max(1, layer.height * layer.scaleY);
  return { x: layer.x, y: layer.y, width: w, height: h };
}

// ---------------------------------------------------------------------------
// Layer Rendering
// ---------------------------------------------------------------------------

export function drawShapeLayer(ctx: CanvasRenderingContext2D, layer: ShapeLayer) {
  const bounds = getShapeBounds(layer);
  const x2 = bounds.x + bounds.width;
  const y2 = bounds.y + bounds.height;

  ctx.save();
  ctx.globalAlpha = Math.max(0.01, Math.min(1, layer.opacity / 100));
  ctx.strokeStyle = layer.color;
  ctx.fillStyle = layer.color;
  ctx.lineWidth = layer.strokeWidth;

  if (layer.rotation !== 0) {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  drawShape(ctx, layer.shapeType, { x: bounds.x, y: bounds.y }, { x: x2, y: y2 }, layer.filled);
  ctx.restore();
}

export function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  const bounds = getTextMetricsForLayer(ctx, layer);
  const padding = layer.backgroundEnabled ? layer.backgroundPadding : 0;
  const contentX = bounds.x + padding;
  const contentY = bounds.y + padding;
  const lineHeightPx = layer.fontSize * layer.lineHeight;
  const lines = layer.text.split('\n');

  ctx.save();
  ctx.globalAlpha = Math.max(0.01, Math.min(1, layer.opacity / 100));
  ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = layer.color;

  if (layer.rotation !== 0) {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (layer.backgroundEnabled) {
    ctx.fillStyle = layer.backgroundColor;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.fillStyle = layer.color;
  }

  if (layer.shadowEnabled) {
    ctx.shadowColor = layer.shadowColor;
    ctx.shadowBlur = layer.shadowBlur;
    ctx.shadowOffsetX = layer.shadowOffsetX;
    ctx.shadowOffsetY = layer.shadowOffsetY;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = line.length <= 1
      ? Math.max(1, ctx.measureText(line).width)
      : Math.max(1, ctx.measureText(line).width + (line.length - 1) * layer.tracking);
    let x = contentX;
    if (layer.align === 'center') {
      x = contentX + (bounds.width - padding * 2 - lineWidth) / 2;
    } else if (layer.align === 'right') {
      x = contentX + (bounds.width - padding * 2 - lineWidth);
    }
    const y = contentY + i * lineHeightPx;

    if (layer.strokeEnabled) {
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth;
      if (layer.tracking === 0 || line.length <= 1) {
        ctx.strokeText(line, x, y);
      } else {
        let strokeCursor = x;
        for (const ch of line) {
          ctx.strokeText(ch, strokeCursor, y);
          strokeCursor += ctx.measureText(ch).width + layer.tracking;
        }
      }
    }

    drawTextLineWithTracking(ctx, line, x + layer.kerning, y, layer.tracking);
  }

  ctx.restore();
}

export function applyAdjustmentLayerToCanvas(
  canvas: HTMLCanvasElement,
  layer: AdjustmentLayer,
) {
  if (!layer.enabled || !layer.visible) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (layer.adjustmentType === 'sharpen') {
    if (layer.value <= 0) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sharpened = applySharpen(imgData);
    ctx.putImageData(sharpened, 0, 0);
    return;
  }

  let filterPart = '';
  if (layer.adjustmentType === 'brightness') {
    filterPart = `brightness(${1 + layer.value / 100})`;
  } else if (layer.adjustmentType === 'contrast') {
    filterPart = `contrast(${1 + layer.value / 100})`;
  } else if (layer.adjustmentType === 'saturation') {
    filterPart = `saturate(${layer.value / 100})`;
  } else if (layer.adjustmentType === 'blur') {
    filterPart = `blur(${Math.max(0, layer.value)}px)`;
  } else if (layer.adjustmentType === 'grayscale') {
    filterPart = layer.value > 0 ? 'grayscale(1)' : 'none';
  } else if (layer.adjustmentType === 'sepia') {
    filterPart = layer.value > 0 ? 'sepia(1)' : 'none';
  } else if (layer.adjustmentType === 'invert') {
    filterPart = layer.value > 0 ? 'invert(1)' : 'none';
  }

  if (!filterPart || filterPart === 'none') return;

  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  const tctx = temp.getContext('2d');
  if (!tctx) return;

  tctx.filter = filterPart;
  tctx.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(temp, 0, 0);
}

// ---------------------------------------------------------------------------
// Selection Utilities
// ---------------------------------------------------------------------------

export interface EdgeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function createSelectionMask(w: number, h: number): ImageData {
  return new ImageData(w, h);
}

/** Extract edge segments from a selection mask (run once per selection change). */
export function extractSelectionEdges(mask: ImageData): EdgeSegment[] {
  const { width, height, data } = mask;
  const edges: EdgeSegment[] = [];

  const isSelected = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return data[(y * width + x) * 4] >= 128;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isSelected(x, y)) continue;
      if (!isSelected(x, y - 1)) edges.push({ x1: x, y1: y, x2: x + 1, y2: y });
      if (!isSelected(x, y + 1)) edges.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 });
      if (!isSelected(x - 1, y)) edges.push({ x1: x, y1: y, x2: x, y2: y + 1 });
      if (!isSelected(x + 1, y)) edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
    }
  }

  return edges;
}

/** Render pre-cached edge segments with marching-ants animation. */
export function renderCachedMarchingAnts(
  ctx: CanvasRenderingContext2D,
  edges: EdgeSegment[],
  animOffset: number,
  zoom: number,
) {
  if (edges.length === 0) return;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -animOffset;
  ctx.lineWidth = 1 / zoom;
  ctx.strokeStyle = '#000000';

  ctx.beginPath();
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    ctx.moveTo(e.x1, e.y1);
    ctx.lineTo(e.x2, e.y2);
  }
  ctx.stroke();

  // White overlay offset by half a dash for contrast
  ctx.strokeStyle = '#ffffff';
  ctx.lineDashOffset = -(animOffset + 4);
  ctx.stroke();
  ctx.restore();
}

/** @deprecated Use extractSelectionEdges + renderCachedMarchingAnts instead */
export function renderMarchingAnts(
  ctx: CanvasRenderingContext2D,
  mask: ImageData,
  animOffset: number,
  zoom: number,
) {
  const edges = extractSelectionEdges(mask);
  renderCachedMarchingAnts(ctx, edges, animOffset, zoom);
}

export function floodFillSelection(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number,
  contiguous: boolean,
): ImageData {
  const { width, height, data } = imageData;
  const mask = createSelectionMask(width, height);
  const maskData = mask.data;

  const sx = Math.max(0, Math.min(width - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(startY)));
  const startIdx = (sy * width + sx) * 4;
  const tr = data[startIdx];
  const tg = data[startIdx + 1];
  const tb = data[startIdx + 2];

  const matchesColor = (idx: number) => {
    return (
      Math.abs(data[idx] - tr) +
      Math.abs(data[idx + 1] - tg) +
      Math.abs(data[idx + 2] - tb)
    ) <= tolerance * 3;
  };

  if (contiguous) {
    // BFS flood fill
    const visited = new Uint8Array(width * height);
    const queue: number[] = [sy * width + sx];
    visited[sy * width + sx] = 1;

    while (queue.length > 0) {
      const pos = queue.shift()!;
      const px = pos % width;
      const py = (pos - px) / width;
      const idx = pos * 4;

      if (matchesColor(idx)) {
        maskData[idx] = 255;
        maskData[idx + 1] = 255;
        maskData[idx + 2] = 255;
        maskData[idx + 3] = 255;

        const neighbors = [
          py > 0 ? pos - width : -1,
          py < height - 1 ? pos + width : -1,
          px > 0 ? pos - 1 : -1,
          px < width - 1 ? pos + 1 : -1,
        ];
        for (const n of neighbors) {
          if (n >= 0 && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }
    }
  } else {
    // Select all matching pixels globally
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (matchesColor(idx)) {
        maskData[idx] = 255;
        maskData[idx + 1] = 255;
        maskData[idx + 2] = 255;
        maskData[idx + 3] = 255;
      }
    }
  }

  return mask;
}

// ---------------------------------------------------------------------------
// Retouch Utilities
// ---------------------------------------------------------------------------

export function healBrushDab(
  ctx: CanvasRenderingContext2D,
  targetX: number,
  targetY: number,
  sourceX: number,
  sourceY: number,
  brushSize: number,
  hardness: number,
  opacity: number,
) {
  const canvas = ctx.canvas;
  const radius = Math.max(1, Math.round(brushSize / 2));
  const x0 = Math.round(targetX - radius);
  const y0 = Math.round(targetY - radius);
  const size = radius * 2;

  // Clamp to canvas bounds
  const tx = Math.max(0, x0);
  const ty = Math.max(0, y0);
  const tw = Math.min(canvas.width - tx, size - (tx - x0));
  const th = Math.min(canvas.height - ty, size - (ty - y0));
  if (tw <= 0 || th <= 0) return;

  const srcX = Math.round(sourceX - radius) + (tx - x0);
  const srcY = Math.round(sourceY - radius) + (ty - y0);
  const clampedSrcX = Math.max(0, Math.min(canvas.width - tw, srcX));
  const clampedSrcY = Math.max(0, Math.min(canvas.height - th, srcY));

  const targetData = ctx.getImageData(tx, ty, tw, th);
  const sourceData = ctx.getImageData(clampedSrcX, clampedSrcY, tw, th);
  const out = targetData.data;
  const src = sourceData.data;

  const hardnessNorm = Math.max(0.1, hardness / 100);
  const alpha = Math.max(0.01, opacity / 100);

  for (let py = 0; py < th; py++) {
    for (let px = 0; px < tw; px++) {
      const dx = (px + (tx - x0)) - radius;
      const dy = (py + (ty - y0)) - radius;
      const dist = Math.sqrt(dx * dx + dy * dy) / radius;
      if (dist > 1) continue;

      // Gaussian falloff
      const falloff = Math.exp(-((dist / hardnessNorm) ** 2) * 2);
      const blend = falloff * alpha;

      const idx = (py * tw + px) * 4;
      out[idx] = out[idx] + (src[idx] - out[idx]) * blend;
      out[idx + 1] = out[idx + 1] + (src[idx + 1] - out[idx + 1]) * blend;
      out[idx + 2] = out[idx + 2] + (src[idx + 2] - out[idx + 2]) * blend;
    }
  }

  ctx.putImageData(targetData, tx, ty);
}

export function cloneStampDab(
  ctx: CanvasRenderingContext2D,
  targetX: number,
  targetY: number,
  sourceX: number,
  sourceY: number,
  brushSize: number,
  hardness: number,
  opacity: number,
  flow: number,
) {
  const canvas = ctx.canvas;
  const radius = Math.max(1, Math.round(brushSize / 2));
  const x0 = Math.round(targetX - radius);
  const y0 = Math.round(targetY - radius);
  const size = radius * 2;

  const tx = Math.max(0, x0);
  const ty = Math.max(0, y0);
  const tw = Math.min(canvas.width - tx, size - (tx - x0));
  const th = Math.min(canvas.height - ty, size - (ty - y0));
  if (tw <= 0 || th <= 0) return;

  const srcX = Math.round(sourceX - radius) + (tx - x0);
  const srcY = Math.round(sourceY - radius) + (ty - y0);
  const clampedSrcX = Math.max(0, Math.min(canvas.width - tw, srcX));
  const clampedSrcY = Math.max(0, Math.min(canvas.height - th, srcY));

  const targetData = ctx.getImageData(tx, ty, tw, th);
  const sourceData = ctx.getImageData(clampedSrcX, clampedSrcY, tw, th);
  const out = targetData.data;
  const src = sourceData.data;

  const hardnessNorm = Math.max(0.1, hardness / 100);
  const alpha = Math.max(0.01, (opacity / 100) * (flow / 100));

  for (let py = 0; py < th; py++) {
    for (let px = 0; px < tw; px++) {
      const dx = (px + (tx - x0)) - radius;
      const dy = (py + (ty - y0)) - radius;
      const dist = Math.sqrt(dx * dx + dy * dy) / radius;
      if (dist > 1) continue;

      const falloff = Math.exp(-((dist / hardnessNorm) ** 2) * 2);
      const blend = falloff * alpha;

      const idx = (py * tw + px) * 4;
      out[idx] = out[idx] + (src[idx] - out[idx]) * blend;
      out[idx + 1] = out[idx + 1] + (src[idx + 1] - out[idx + 1]) * blend;
      out[idx + 2] = out[idx + 2] + (src[idx + 2] - out[idx + 2]) * blend;
      out[idx + 3] = out[idx + 3] + (src[idx + 3] - out[idx + 3]) * blend;
    }
  }

  ctx.putImageData(targetData, tx, ty);
}

export function spotRemoveDab(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  brushSize: number,
) {
  const canvas = ctx.canvas;
  const innerRadius = Math.max(1, Math.round(brushSize / 2));
  const outerRadius = Math.max(innerRadius + 2, brushSize);

  // Sample ring around spot
  const x0 = Math.max(0, Math.round(centerX - outerRadius));
  const y0 = Math.max(0, Math.round(centerY - outerRadius));
  const x1 = Math.min(canvas.width, Math.round(centerX + outerRadius));
  const y1 = Math.min(canvas.height, Math.round(centerY + outerRadius));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;

  const imgData = ctx.getImageData(x0, y0, w, h);
  const data = imgData.data;

  // Calculate average of ring pixels
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dx = (px + x0) - centerX;
      const dy = (py + y0) - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= innerRadius && dist <= outerRadius) {
        const idx = (py * w + px) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }
  }

  if (count === 0) return;
  const avgR = rSum / count;
  const avgG = gSum / count;
  const avgB = bSum / count;

  // Replace inner pixels with ring average, feathered
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dx = (px + x0) - centerX;
      const dy = (py + y0) - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > innerRadius) continue;

      const blend = 1 - (dist / innerRadius) * 0.3; // Stronger in center
      const idx = (py * w + px) * 4;
      data[idx] = data[idx] + (avgR - data[idx]) * blend;
      data[idx + 1] = data[idx + 1] + (avgG - data[idx + 1]) * blend;
      data[idx + 2] = data[idx + 2] + (avgB - data[idx + 2]) * blend;
    }
  }

  ctx.putImageData(imgData, x0, y0);
}
