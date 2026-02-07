/**
 * AI Result Selector
 * 
 * Uses Ollama to intelligently select the most relevant search result.
 */

import { SearchResult, ResultSelectionResult, PROMPTS } from './types';

interface SelectOptions {
  ollamaHost?: string;
  model?: string;
  timeout?: number;
}

/**
 * Format search results for the AI prompt
 */
function formatResults(results: SearchResult[]): string {
  return results
    .map((result, index) => {
      const snippet = result.content.length > 200 
        ? result.content.substring(0, 200) + '...'
        : result.content;
      return `${index + 1}. ${result.title}\n   URL: ${result.url}\n   ${snippet}`;
    })
    .join('\n\n');
}

/**
 * Parse AI response to extract selection
 */
export function parseSelection(response: string, results: SearchResult[]): ResultSelectionResult | null {
  try {
    // Try to parse "NUMBER|REASON" format
    const match = response.match(/^(\d+)\|(.+)$/m);
    
    if (match) {
      const index = parseInt(match[1], 10) - 1;
      const reason = match[2].trim();
      
      if (index >= 0 && index < results.length) {
        return {
          selectedIndex: index,
          title: results[index].title,
          url: results[index].url,
          reason,
        };
      }
    }

    // Fallback: Try to find any number in the response
    const numberMatch = response.match(/\b(\d+)\b/);
    if (numberMatch) {
      const index = parseInt(numberMatch[1], 10) - 1;
      if (index >= 0 && index < results.length) {
        return {
          selectedIndex: index,
          title: results[index].title,
          url: results[index].url,
          reason: 'AI selection',
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Use AI to select the most relevant search result
 */
export async function selectBestResult(
  question: string,
  query: string,
  results: SearchResult[],
  options: SelectOptions = {}
): Promise<ResultSelectionResult> {
  const {
    ollamaHost = 'http://localhost:11434',
    model = 'llama3',
    timeout = 30000,
  } = options;

  if (results.length === 0) {
    throw new Error('No results to select from');
  }

  // If only one result, return it
  if (results.length === 1) {
    return {
      selectedIndex: 0,
      title: results[0].title,
      url: results[0].url,
      reason: 'Only result available',
    };
  }

  console.debug(`[ResultSelector] Selecting best result for: "${question}"`);

  try {
    const prompt = PROMPTS.resultSelection
      .replace('{question}', question)
      .replace('{query}', query)
      .replace('{results}', formatResults(results));

    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 100,
        },
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.response?.trim() || '';

    const selection = parseSelection(aiResponse, results);
    
    if (selection) {
      console.debug(`[ResultSelector] ✓ Selected #${selection.selectedIndex + 1}: ${selection.title}`);
      return selection;
    }

    // Fallback to first result
    console.debug('[ResultSelector] Could not parse AI selection, using first result');
    return {
      selectedIndex: 0,
      title: results[0].title,
      url: results[0].url,
      reason: 'Default selection (first result)',
    };
  } catch (error) {
    console.error('[ResultSelector] Error:', error);
    
    // Fallback: Return first result
    return {
      selectedIndex: 0,
      title: results[0].title,
      url: results[0].url,
      reason: 'Fallback selection due to error',
    };
  }
}

export default selectBestResult;
