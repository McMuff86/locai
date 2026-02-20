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
