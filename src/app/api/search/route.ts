import { NextRequest, NextResponse } from 'next/server';
import {
  performWebSearch,
  searchWeb,
  optimizeQuery,
  fetchPageContent,
  formatForChat,
  WebSearchOptions,
} from '@/lib/webSearch';
import { validateSearxngUrl, validateExternalUrl } from '../_utils/security';
import { resolveAndValidateOllamaHost } from '../_utils/ollama';
import { apiError } from '../_utils/responses';

/**
 * GET /api/search
 * 
 * Simple search endpoint - just searches SearXNG without AI optimization.
 * Use POST for the full AI-powered search.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const searxngUrl = searchParams.get('searxngUrl') || undefined;
  const language = searchParams.get('language') || 'de-DE';
  const maxResults = parseInt(searchParams.get('maxResults') || '8', 10);

  if (!query) {
    return apiError('Query parameter "q" is required', 400);
  }

  // SSRF: validate user-supplied SearXNG URL
  if (searxngUrl) {
    const check = validateSearxngUrl(searxngUrl);
    if (!check.valid) {
      return apiError(check.reason, 400);
    }
  }

  try {
    const result = await searchWeb(query, {
      customInstance: searxngUrl,
      maxResults,
      language,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Search API] Error:', error);
    return apiError('Search failed', 500, { details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * POST /api/search
 * 
 * Full AI-powered web search endpoint.
 * 
 * Request body:
 * {
 *   question: string;           // The user's question
 *   options?: {
 *     searxngUrl?: string;      // Custom SearXNG instance
 *     ollamaHost?: string;      // Ollama host (default: http://localhost:11434)
 *     model?: string;           // Ollama model (default: llama3)
 *     optimizeQuery?: boolean;  // Use AI to optimize query (default: true)
 *     selectBestResult?: boolean; // Use AI to select best result (default: true)
 *     fetchContent?: boolean;   // Fetch full page content (default: true)
 *     maxResults?: number;      // Max search results (default: 8)
 *     language?: string;        // Search language (default: de-DE)
 *   }
 * }
 * 
 * Response: WebSearchResult
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, options = {} } = body;

    if (!question) {
      return apiError('Question is required', 400);
    }

    // SSRF: validate user-supplied URLs
    let ollamaHost: string;
    try {
      ollamaHost = resolveAndValidateOllamaHost(options.ollamaHost);
    } catch (err) {
      return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
    }
    if (options.searxngUrl) {
      const check = validateSearxngUrl(options.searxngUrl);
      if (!check.valid) {
        return apiError(check.reason, 400);
      }
    }

    // Merge default options
    const searchOptions: WebSearchOptions = {
      ollamaHost,
      model: options.model || 'llama3',
      searxngUrl: options.searxngUrl,
      maxResults: options.maxResults || 8,
      language: options.language || 'de-DE',
      timeout: options.timeout || 10000,
      optimizeQuery: options.optimizeQuery !== false, // default true
      selectBestResult: options.selectBestResult !== false, // default true
      fetchContent: options.fetchContent !== false, // default true
    };

    console.debug(`[Search API] AI-powered search for: "${question}"`);
    
    const result = await performWebSearch(question, searchOptions);

    // Add formatted version for easy chat insertion
    const response = {
      ...result,
      formattedForChat: formatForChat(result),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Search API] Error:', error);
    return apiError('Search failed', 500, { details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * PUT /api/search
 * 
 * Fetch content from a specific URL using Jina Reader.
 * 
 * Request body:
 * {
 *   url: string;
 *   maxLength?: number;
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const { url, maxLength } = await request.json();

    if (!url) {
      return apiError('URL is required', 400);
    }

    // SSRF: validate external URL
    const urlCheck = validateExternalUrl(url);
    if (!urlCheck.valid) {
      return apiError(urlCheck.reason, 400);
    }

    console.debug(`[Search API] Fetching content from: ${url}`);

    const content = await fetchPageContent(url, { maxLength });

    return NextResponse.json(content);
  } catch (error) {
    console.error('[Search API] Content fetch error:', error);
    return apiError('Failed to fetch content', 500);
  }
}

/**
 * PATCH /api/search
 * 
 * Optimize a search query using AI.
 * 
 * Request body:
 * {
 *   question: string;
 *   ollamaHost?: string;
 *   model?: string;
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { question, ollamaHost, model } = await request.json();

    if (!question) {
      return apiError('Question is required', 400);
    }

    // SSRF: validate user-supplied Ollama host
    let resolvedHost: string;
    try {
      resolvedHost = resolveAndValidateOllamaHost(ollamaHost);
    } catch (err) {
      return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
    }

    console.debug(`[Search API] Optimizing query: "${question}"`);

    const result = await optimizeQuery(question, {
      ollamaHost: resolvedHost,
      model: model || 'llama3',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Search API] Query optimization error:', error);
    return apiError('Failed to optimize query', 500);
  }
}
