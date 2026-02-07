/**
 * Content Fetcher
 * 
 * Fetches and extracts clean content from web pages using Jina Reader API.
 * Jina Reader converts any URL into clean, LLM-friendly text.
 */

import { PageContent } from './types';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
};

interface FetchOptions {
  maxLength?: number;
  timeout?: number;
}

/**
 * Fetch clean content from a URL using Jina Reader API
 * 
 * Jina Reader (r.jina.ai) converts any URL into clean, readable text
 * that's perfect for LLM processing.
 */
export async function fetchPageContent(
  url: string,
  options: FetchOptions = {}
): Promise<PageContent> {
  const {
    maxLength = 15000,
    timeout = 15000,
  } = options;

  console.debug(`[ContentFetcher] Fetching: ${url}`);

  // Validate and clean URL
  if (!url || !url.startsWith('http')) {
    return {
      url,
      content: '',
      truncated: false,
      error: 'Invalid URL',
    };
  }

  try {
    // Use Jina Reader API
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let content = await response.text();
    let truncated = false;

    // Extract title from first line if present
    let title: string | undefined;
    const lines = content.split('\n');
    if (lines[0] && lines[0].startsWith('Title:')) {
      title = lines[0].replace('Title:', '').trim();
      content = lines.slice(1).join('\n').trim();
    }

    // Truncate if too long
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n... (Inhalt gekürzt)';
      truncated = true;
    }

    // Clean up content
    content = content
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .trim();

    console.debug(`[ContentFetcher] ✓ Fetched ${content.length} chars from ${url}`);

    return {
      url,
      title,
      content,
      truncated,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ContentFetcher] ✗ Failed to fetch ${url}: ${errorMsg}`);

    return {
      url,
      content: '',
      truncated: false,
      error: errorMsg,
    };
  }
}

/**
 * Fetch content from multiple URLs in parallel
 */
export async function fetchMultiplePages(
  urls: string[],
  options: FetchOptions = {}
): Promise<PageContent[]> {
  const results = await Promise.allSettled(
    urls.map(url => fetchPageContent(url, options))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      url: urls[index],
      content: '',
      truncated: false,
      error: result.reason?.message || 'Failed to fetch',
    };
  });
}

export default fetchPageContent;

