/**
 * Web Search Module
 * 
 * AI-powered web search using SearXNG and Ollama.
 * Inspired by ollama-web-search project.
 * 
 * Features:
 * - AI-optimized search queries
 * - Multi-instance SearXNG with fallback
 * - Intelligent result selection
 * - Full page content extraction via Jina Reader
 */

// Re-export all types
export * from './types';

// Re-export individual modules
export { searchWeb } from './searxng';
export { searchDuckDuckGo } from './duckduckgo';
export { optimizeQuery } from './queryOptimizer';
export { selectBestResult } from './resultSelector';
export { fetchPageContent, fetchMultiplePages } from './contentFetcher';

// Import for the main function
import { searchWeb } from './searxng';
import { optimizeQuery } from './queryOptimizer';
import { selectBestResult } from './resultSelector';
import { fetchPageContent } from './contentFetcher';
import { 
  SearchResponse, 
  QueryOptimizationResult, 
  ResultSelectionResult, 
  PageContent,
  PROMPTS 
} from './types';

// ============================================================================
// Main Orchestration
// ============================================================================

export interface WebSearchOptions {
  // SearXNG
  searxngUrl?: string;
  maxResults?: number;
  timeout?: number;
  language?: string;
  
  // Ollama
  ollamaHost?: string;
  model?: string;
  
  // Features
  optimizeQuery?: boolean;      // Use AI to optimize query (default: true)
  selectBestResult?: boolean;   // Use AI to select best result (default: true)
  fetchContent?: boolean;       // Fetch full page content (default: true)
}

export interface WebSearchResult {
  // Input
  originalQuestion: string;
  
  // Query optimization
  optimization?: QueryOptimizationResult;
  
  // Search results
  search: SearchResponse;
  
  // Selection
  selection?: ResultSelectionResult;
  
  // Content
  content?: PageContent;
  
  // Status
  success: boolean;
  error?: string;
  
  // Timing
  durationMs: number;
}

/**
 * Perform a complete AI-powered web search
 * 
 * This is the main function that orchestrates the entire search process:
 * 1. Optimize the query using AI
 * 2. Search using SearXNG
 * 3. Select the best result using AI
 * 4. Fetch the full page content
 */
export async function performWebSearch(
  question: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult> {
  const startTime = Date.now();
  
  const {
    searxngUrl,
    maxResults = 8,
    timeout = 10000,
    language = 'de-DE',
    ollamaHost = 'http://localhost:11434',
    model = 'llama3',
    optimizeQuery: shouldOptimize = true,
    selectBestResult: shouldSelect = true,
    fetchContent: shouldFetch = true,
  } = options;

  const result: WebSearchResult = {
    originalQuestion: question,
    search: { query: question, results: [], suggestions: [] },
    success: false,
    durationMs: 0,
  };

  try {
    // Step 1: Optimize query (optional)
    let searchQuery = question;
    
    if (shouldOptimize) {
      console.debug('\n[WebSearch] Step 1: Optimizing query...');
      const optimization = await optimizeQuery(question, { ollamaHost, model });
      result.optimization = optimization;
      searchQuery = optimization.optimizedQuery;
    }

    // Step 2: Search the web
    console.debug('\n[WebSearch] Step 2: Searching the web...');
    const searchResponse = await searchWeb(searchQuery, {
      customInstance: searxngUrl,
      maxResults,
      timeout,
      language,
    });
    
    result.search = {
      ...searchResponse,
      optimizedQuery: searchQuery !== question ? searchQuery : undefined,
    };

    if (searchResponse.error || searchResponse.results.length === 0) {
      result.error = searchResponse.error || 'No results found';
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Step 3: Select best result (optional)
    if (shouldSelect && searchResponse.results.length > 1) {
      console.debug('\n[WebSearch] Step 3: Selecting best result...');
      const selection = await selectBestResult(
        question,
        searchQuery,
        searchResponse.results,
        { ollamaHost, model }
      );
      result.selection = selection;
    } else if (searchResponse.results.length > 0) {
      result.selection = {
        selectedIndex: 0,
        title: searchResponse.results[0].title,
        url: searchResponse.results[0].url,
        reason: 'First result (AI selection disabled)',
      };
    }

    // Step 4: Fetch page content (optional)
    if (shouldFetch && result.selection) {
      console.debug('\n[WebSearch] Step 4: Fetching page content...');
      const content = await fetchPageContent(result.selection.url);
      result.content = content;
    }

    result.success = true;
    result.durationMs = Date.now() - startTime;
    
    console.debug(`\n[WebSearch] ✓ Complete in ${result.durationMs}ms`);
    return result;
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.durationMs = Date.now() - startTime;
    console.error(`[WebSearch] ✗ Failed: ${result.error}`);
    return result;
  }
}

/**
 * Format search results for use as chat context
 */
export function formatForChat(result: WebSearchResult): string {
  const parts: string[] = [];

  // Header
  parts.push(`🔍 **Web-Suche: "${result.originalQuestion}"**`);
  
  if (result.optimization && result.optimization.optimizedQuery !== result.originalQuestion) {
    parts.push(`📝 Optimierte Suche: "${result.optimization.optimizedQuery}"`);
  }

  parts.push('');

  // If we have full content
  if (result.content && result.content.content) {
    parts.push(`📄 **Quelle:** ${result.selection?.title || 'Unbekannt'}`);
    parts.push(`🔗 ${result.selection?.url || ''}`);
    parts.push('');
    parts.push('---');
    parts.push('');
    parts.push(result.content.content);
    
    if (result.content.truncated) {
      parts.push('');
      parts.push('*(Inhalt wurde gekürzt)*');
    }
  } 
  // Fallback to search snippets
  else if (result.search.results.length > 0) {
    parts.push('**Suchergebnisse:**');
    parts.push('');
    
    result.search.results.slice(0, 5).forEach((r, i) => {
      parts.push(`**[${i + 1}] ${r.title}**`);
      parts.push(`${r.url}`);
      parts.push(r.content);
      parts.push('');
    });
  }

  return parts.join('\n');
}

/**
 * Get the answer generation prompt
 */
export function getAnswerPrompt(
  question: string,
  title: string,
  url: string,
  content: string
): string {
  return PROMPTS.answerGeneration
    .replace('{question}', question)
    .replace('{title}', title)
    .replace('{url}', url)
    .replace('{content}', content);
}

export default performWebSearch;

