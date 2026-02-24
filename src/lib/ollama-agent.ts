/**
 * PERF-1: HTTP Agent with keep-alive for Ollama connections.
 *
 * Reuses TCP connections across requests, reducing latency for sequential
 * LLM calls (especially in agent workflows and streaming).
 *
 * Node.js 18+ global fetch uses undici internally. We use undici's Agent
 * to enable keep-alive and connection pooling via a custom dispatcher.
 */

import { Agent } from 'undici';

// Singleton dispatcher with keep-alive + connection pooling
const ollamaDispatcher = new Agent({
  keepAliveTimeout: 30_000,    // keep idle sockets for 30s
  keepAliveMaxTimeout: 60_000, // max keep-alive 60s
  pipelining: 1,               // HTTP/1.1 pipelining (1 = keep-alive without pipelining)
  connections: 10,             // max concurrent connections per origin
  connect: {
    keepAlive: true,
    keepAliveInitialDelay: 1_000,
  },
});

/**
 * fetch() wrapper that uses our pooled keep-alive dispatcher for Ollama.
 * Drop-in replacement for global fetch with identical signature.
 */
export function ollamaFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    // @ts-expect-error -- dispatcher is a valid undici option for Node.js built-in fetch
    dispatcher: ollamaDispatcher,
  });
}
