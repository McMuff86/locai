/**
 * DuckDuckGo Search
 * 
 * Uses DuckDuckGo HTML search and parses results.
 * This is more reliable than SearXNG public instances which often block API requests.
 */

import { SearchResult, SearchResponse } from './types';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

interface DuckDuckGoOptions {
  maxResults?: number;
  timeout?: number;
  region?: string;  // e.g., 'de-de', 'wt-wt' (worldwide)
}

/**
 * Parse DuckDuckGo HTML search results
 */
function parseHtmlResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  
  // DuckDuckGo uses specific patterns for results
  // Pattern 1: result__a (title link) and result__snippet (description)
  const resultPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
  
  // Pattern 2: Alternative structure
  const altPattern = /<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  
  // Pattern 3: Simpler extraction
  const simplePattern = /href="\/\/duckduckgo\.com\/l\/\?uddg=([^&"]*)[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  
  let match;
  
  // Try pattern 1
  while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
    const url = decodeURIComponent(match[1]);
    const title = match[2].trim();
    const content = match[3].replace(/<[^>]*>/g, '').trim();
    
    if (url && title && !url.includes('duckduckgo.com')) {
      results.push({
        title,
        url: url.startsWith('//') ? 'https:' + url : url,
        content,
        engine: 'duckduckgo',
      });
    }
  }
  
  // If pattern 1 didn't work, try pattern 3 (with uddg parameter)
  if (results.length === 0) {
    while ((match = simplePattern.exec(html)) !== null && results.length < maxResults) {
      try {
        const url = decodeURIComponent(match[1]);
        const title = match[2].trim();
        const content = match[3].replace(/<[^>]*>/g, '').trim();
        
        if (url && title && url.startsWith('http')) {
          results.push({
            title,
            url,
            content,
            engine: 'duckduckgo',
          });
        }
      } catch {
        continue;
      }
    }
  }
  
  // Fallback: Extract any links that look like search results
  if (results.length === 0) {
    // Look for uddg parameter which contains the actual URL
    const uddgPattern = /uddg=([^&"]+)[^"]*"[^>]*>([^<]+)/gi;
    while ((match = uddgPattern.exec(html)) !== null && results.length < maxResults) {
      try {
        const url = decodeURIComponent(match[1]);
        const title = match[2].trim();
        
        if (url && title && url.startsWith('http') && !url.includes('duckduckgo.com')) {
          results.push({
            title,
            url,
            content: '',
            engine: 'duckduckgo',
          });
        }
      } catch {
        continue;
      }
    }
  }
  
  return results;
}

/**
 * Search using DuckDuckGo HTML
 */
export async function searchDuckDuckGo(
  query: string,
  options: DuckDuckGoOptions = {}
): Promise<SearchResponse> {
  const {
    maxResults = 8,
    timeout = 10000,
    region = 'wt-wt',  // Worldwide
  } = options;

  // Validate query
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      query: query || '',
      results: [],
      suggestions: [],
      error: 'Leere Suchanfrage',
    };
  }

  const cleanQuery = query.trim();
  console.log(`[DuckDuckGo] Searching for: "${cleanQuery}"`);

  try {
    // DuckDuckGo HTML search URL - build manually to avoid URL constructor issues
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}&kl=${encodeURIComponent(region)}`;

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(cleanQuery)}&kl=${region}`,
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      console.error(`[DuckDuckGo] HTTP ${response.status}`);
      return {
        query,
        results: [],
        suggestions: [],
        error: `DuckDuckGo returned HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    
    // Check for rate limiting or blocking
    if (html.includes('unusual traffic') || html.includes('captcha')) {
      console.error('[DuckDuckGo] Rate limited or blocked');
      return {
        query,
        results: [],
        suggestions: [],
        error: 'DuckDuckGo rate limit - bitte warte einen Moment',
      };
    }

    const results = parseHtmlResults(html, maxResults);
    
    console.log(`[DuckDuckGo] ✓ Found ${results.length} results`);

    return {
      query,
      results,
      suggestions: [],
      instanceUsed: 'duckduckgo',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[DuckDuckGo] Error: ${errorMsg}`);
    
    return {
      query,
      results: [],
      suggestions: [],
      error: `DuckDuckGo Suche fehlgeschlagen: ${errorMsg}`,
    };
  }
}

export default searchDuckDuckGo;

