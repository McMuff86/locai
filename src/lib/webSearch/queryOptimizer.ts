/**
 * AI Query Optimizer
 * 
 * Uses Ollama to convert natural language questions into optimized search queries.
 */

import { QueryOptimizationResult, PROMPTS } from './types';

interface OptimizeOptions {
  ollamaHost?: string;
  model?: string;
  timeout?: number;
}

/**
 * Optimize a search query using Ollama
 * 
 * Converts natural language questions like "When did Star Trek Voyager first air?"
 * into optimized search queries like "Star Trek Voyager premiere date 1995"
 */
export async function optimizeQuery(
  question: string,
  options: OptimizeOptions = {}
): Promise<QueryOptimizationResult> {
  const {
    ollamaHost = 'http://localhost:11434',
    model = 'llama3',
    timeout = 30000,
  } = options;

  console.debug(`[QueryOptimizer] Optimizing: "${question}"`);

  try {
    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: PROMPTS.queryOptimization + question,
        stream: false,
        options: {
          temperature: 0.3,  // Low temperature for consistent results
          num_predict: 50,   // Short response expected
        },
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    const optimizedQuery = data.response?.trim() || question;

    // Extract keywords (simple split for now)
    const keywords = optimizedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((word: string) => word.length > 2);

    console.debug(`[QueryOptimizer] ✓ Optimized to: "${optimizedQuery}"`);

    return {
      originalQuery: question,
      optimizedQuery,
      keywords,
    };
  } catch (error) {
    console.error('[QueryOptimizer] Error:', error);
    
    // Fallback: Return original query with basic cleanup
    const fallbackQuery = question
      .replace(/^(what|how|when|where|why|who|which|can you|could you|please)\s+/gi, '')
      .replace(/\?+$/, '')
      .trim();

    return {
      originalQuery: question,
      optimizedQuery: fallbackQuery || question,
      keywords: fallbackQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2),
    };
  }
}

export default optimizeQuery;

