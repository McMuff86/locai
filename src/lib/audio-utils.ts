/** Formats a duration in seconds to `m:ss` display format. */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Extract the filename from an audio src URL like /api/audio/my-file.flac */
export function extractFilename(src: string): string {
  const parts = src.split('/');
  return decodeURIComponent(parts[parts.length - 1] || 'audio.flac');
}
