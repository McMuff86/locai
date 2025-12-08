/**
 * Web Search Types
 * 
 * Type definitions for the AI-powered web search feature.
 */

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  content: string;  // Snippet/description from search
  engine: string;   // Which search engine provided this result
}

export interface SearchResponse {
  query: string;
  optimizedQuery?: string;  // AI-optimized query
  results: SearchResult[];
  suggestions: string[];
  instanceUsed?: string;
  error?: string;
}

export interface SelectedResult {
  result: SearchResult;
  reason?: string;  // Why AI selected this result
  confidence?: number;
}

// ============================================================================
// Content Types
// ============================================================================

export interface PageContent {
  url: string;
  title?: string;
  content: string;
  truncated: boolean;
  error?: string;
}

// ============================================================================
// AI Types
// ============================================================================

export interface QueryOptimizationResult {
  originalQuery: string;
  optimizedQuery: string;
  keywords: string[];
}

export interface ResultSelectionResult {
  selectedIndex: number;
  title: string;
  url: string;
  reason: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface WebSearchConfig {
  // SearXNG
  searxngUrl?: string;  // Optional custom instance
  maxResults: number;
  timeout: number;
  language: string;
  
  // Ollama
  ollamaHost: string;
  model: string;
  
  // Content
  maxContentLength: number;
  fetchFullContent: boolean;
}

export const DEFAULT_CONFIG: WebSearchConfig = {
  maxResults: 8,
  timeout: 10000,
  language: 'de-DE',
  ollamaHost: 'http://localhost:11434',
  model: 'llama3',
  maxContentLength: 15000,
  fetchFullContent: true,
};

// ============================================================================
// SearXNG Instances (Fallback List)
// ============================================================================

export const SEARXNG_INSTANCES = [
  'https://search.inetol.net/search',
  'https://searx.be/search',
  'https://search.brave4u.com/search',
  'https://priv.au/search',
  'https://searx.tiekoetter.com/search',
  'https://search.ononoki.org/search',
];

// ============================================================================
// Prompts
// ============================================================================

export const PROMPTS = {
  queryOptimization: `You are an expert at creating precise web search queries. Convert the user's question into an optimal search query that will find the most relevant results.

Guidelines:
- Use specific keywords and terms
- Remove unnecessary words like "what", "how", "can you"
- Include important context and dates if relevant
- Keep it concise but comprehensive
- Return ONLY the search query, nothing else

Examples:
Question: "What is the capital of France?"
Query: capital France

Question: "How do I install Docker on Ubuntu?"
Query: install Docker Ubuntu tutorial

Question: "When did Star Trek Voyager first air?"
Query: Star Trek Voyager premiere date 1995

User's question: `,

  resultSelection: `You are an expert at evaluating search results. Based on the original question, select the MOST RELEVANT result that will best answer the user's question.

Original Question: {question}
Search Query: {query}

Search Results:
{results}

Respond with ONLY the number of the best result (1, 2, 3, etc.) and a brief reason.
Format: NUMBER|REASON

Example: 3|Official Wikipedia article with comprehensive information`,

  answerGeneration: `You are a knowledgeable assistant providing accurate information based on web content.

Original Question: {question}
Source: {title}
URL: {url}

Retrieved Content:
{content}

Instructions:
- Provide a comprehensive but concise answer to the user's question
- Use information from the retrieved content
- Cite specific details when relevant
- If the content doesn't fully answer the question, mention what information is available
- Format your response clearly
- Be helpful and informative
- Answer in the same language as the question`,
};

