import { validateOllamaHost } from './security';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

/**
 * ARCH-2: Centralised server-side Ollama host resolution + SSRF validation.
 *
 * Resolution order: raw parameter → NEXT_PUBLIC_OLLAMA_URL env → default.
 * Throws on invalid / blocked hosts so callers can catch once.
 */
export function resolveAndValidateOllamaHost(raw?: string | null): string {
  const host = raw?.trim() || process.env.NEXT_PUBLIC_OLLAMA_URL || DEFAULT_OLLAMA_HOST;
  const check = validateOllamaHost(host);
  if (!check.valid) throw new Error(check.reason);
  return check.url;
}
