/**
 * SearXNG Multi-Instance Search with DuckDuckGo Fallback
 * 
 * Searches the web using:
 * 1. Custom SearXNG instance (if configured)
 * 2. DuckDuckGo (reliable fallback)
 * 
 * Public SearXNG instances often block API requests, so DuckDuckGo
 * is used as the primary fallback for reliability.
 */

import { SearchResult, SearchResponse } from './types';
import { searchDuckDuckGo } from './duckduckgo';

// Browser-like headers to avoid being blocked
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
};

interface SearchOptions {
  customInstance?: string;
  maxResults?: number;
  timeout?: number;
  language?: string;
}

/**
 * Try to search using a SearXNG instance
 */
async function trySearXNG(
  instanceUrl: string,
  query: string,
  language: string,
  timeout: number,
  maxResults: number
): Promise<SearchResponse | null> {
  try {
    // Validate inputs
    if (!instanceUrl || !query) {
      return null;
    }
    
    console.debug(`[SearXNG] Trying: ${instanceUrl}`);
    
    // Build search URL manually to avoid URL constructor issues
    const separator = instanceUrl.includes('?') ? '&' : '?';
    const searchUrl = `${instanceUrl}${separator}q=${encodeURIComponent(query)}&format=json&categories=general&language=${encodeURIComponent(language)}`;

    const response = await fetch(searchUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      console.debug(`[SearXNG] ✗ HTTP ${response.status}`);
      return null;
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.debug(`[SearXNG] ✗ Not JSON response`);
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.debug(`[SearXNG] ✗ No results`);
      return null;
    }

    const mappedResults: SearchResult[] = results
      .slice(0, maxResults)
      .map((r: { title?: string; url?: string; content?: string; snippet?: string; engine?: string }) => ({
        title: r.title || 'No title',
        url: r.url || '',
        content: r.content || r.snippet || '',
        engine: r.engine || 'searxng',
      }));

    console.debug(`[SearXNG] ✓ Found ${mappedResults.length} results`);
    
    return {
      query,
      results: mappedResults,
      suggestions: data.suggestions || [],
      instanceUsed: instanceUrl,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.debug(`[SearXNG] ✗ Error: ${errorMsg}`);
    return null;
  }
}

/**
 * Search the web using SearXNG (if configured) with DuckDuckGo fallback
 */
export async function searchWeb(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const {
    customInstance,
    maxResults = 8,
    timeout = 10000,
    language = 'de-DE',
  } = options;

  console.debug(`[WebSearch] Searching for: "${query}"`);

  // Try custom SearXNG instance first (if configured)
  if (customInstance) {
    let normalizedUrl = customInstance.trim();
    if (!normalizedUrl.endsWith('/search')) {
      normalizedUrl = normalizedUrl.replace(/\/$/, '') + '/search';
    }
    
    const searxResult = await trySearXNG(normalizedUrl, query, language, timeout, maxResults);
    if (searxResult && searxResult.results.length > 0) {
      return searxResult;
    }
    console.debug('[WebSearch] Custom SearXNG failed, falling back to DuckDuckGo');
  }

  // Use DuckDuckGo as the reliable fallback
  console.debug('[WebSearch] Using DuckDuckGo');
  return searchDuckDuckGo(query, { maxResults, timeout });
}

export default searchWeb;

