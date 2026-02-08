// ============================================================================
// Storage Utilities
// ============================================================================
// Extracted image-processing functions for server-side conversation storage.
// Used by both the conversation store and migration system.
// ============================================================================

import { MessageContent, MessageImageContent } from "../types/chat";

/** Maximum image size for filesystem storage (2MB — much more than localStorage) */
export const MAX_IMAGE_SIZE_FS = 2 * 1024 * 1024;

export function isDataImageUrl(url: string): boolean {
  return url.startsWith('data:image/');
}

export function estimateDataUrlPayloadBytes(dataUrl: string): number | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const meta = dataUrl.slice(0, commaIndex);
  const data = dataUrl.slice(commaIndex + 1);

  if (!meta.includes(';base64')) {
    return null;
  }

  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const bytes = Math.floor((data.length * 3) / 4) - padding;
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
}

function formatBytes(bytes: number): string {
  const kb = Math.ceil(bytes / 1024);
  return `${kb}KB`;
}

export function buildImagePlaceholder(params: {
  reason: string;
  alt?: string;
  sizeBytes?: number | null;
}): string {
  const parts: string[] = [params.reason];
  if (typeof params.sizeBytes === "number" && params.sizeBytes > 0) {
    parts.push(formatBytes(params.sizeBytes));
  }
  if (params.alt) {
    parts.push(`alt: "${params.alt}"`);
  }
  return `[Bild nicht gespeichert: ${parts.join(", ")}]`;
}

function processImageContentForStorage(
  imageContent: MessageImageContent,
  maxImageSize: number,
): string | MessageImageContent {
  if (!isDataImageUrl(imageContent.url)) {
    return imageContent;
  }

  const payloadBytes = estimateDataUrlPayloadBytes(imageContent.url);
  const isTooLarge =
    (typeof payloadBytes === "number" && payloadBytes > maxImageSize) ||
    (payloadBytes === null && imageContent.url.length > maxImageSize);

  if (isTooLarge) {
    return buildImagePlaceholder({
      reason: 'zu groß für Speicherung',
      alt: imageContent.alt,
      sizeBytes: payloadBytes,
    });
  }

  return imageContent;
}

/**
 * Process message content for storage, stripping oversized images.
 * @param content  The message content to process
 * @param maxImageSize  Maximum allowed image size in bytes (defaults to 2MB)
 */
export function processMessageContentForStorage(
  content: MessageContent,
  maxImageSize: number = MAX_IMAGE_SIZE_FS,
): MessageContent {
  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'object' && 'type' in content && content.type === 'image') {
    return processImageContentForStorage(content as MessageImageContent, maxImageSize);
  }

  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && 'type' in item && item.type === 'image') {
        return processImageContentForStorage(item as MessageImageContent, maxImageSize);
      }
      return item;
    });
  }

  return content;
}
