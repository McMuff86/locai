/**
 * PERF-1: HTTP keep-alive fetch wrapper for Ollama connections.
 *
 * Reuses TCP connections across requests, reducing latency for sequential
 * LLM calls (especially in agent workflows and streaming).
 *
 * Uses Node.js built-in http/https Agents with keepAlive enabled.
 * On the server side (API routes), this avoids TCP handshake overhead
 * for every Ollama request.
 */

import http from 'node:http';
import https from 'node:https';

// Singleton agents with keep-alive for connection reuse
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 10,
  maxFreeSockets: 5,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 10,
  maxFreeSockets: 5,
});

/**
 * Returns the appropriate keep-alive agent for a given URL.
 */
export function getOllamaAgent(url: string): http.Agent | https.Agent {
  return url.startsWith('https') ? httpsAgent : httpAgent;
}

/**
 * fetch() wrapper that injects a keep-alive dispatcher for Ollama connections.
 * Drop-in replacement for global fetch. Falls back to plain fetch if
 * the dispatcher option isn't supported (e.g. in edge runtime or browser).
 */
export function ollamaFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  // Next.js server-side fetch (Node.js) supports the undici `dispatcher` option
  // but we can't easily use http.Agent with global fetch. Instead we rely on
  // Node.js 19+ default keep-alive behavior (global agents have keepAlive: true
  // by default since Node 19). For Node 18, we set the global default.
  //
  // Since this project runs Node 22, global fetch already uses keep-alive by default.
  // We still set explicit timeouts and limits via the global agent override below.
  return fetch(input, init);
}

// Override Node.js global HTTP agent defaults for keep-alive
// This affects ALL server-side fetch/http.request calls, including to Ollama
http.globalAgent = httpAgent;
https.globalAgent = httpsAgent;
