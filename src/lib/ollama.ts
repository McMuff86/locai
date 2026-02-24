// Ollama API functions
import { 
  formatSystemMessage, 
  formatUserMessage, 
  formatAssistantMessage,
  getDefaultSystemContent,
  getOllamaTemplate,
  getDefaultOptions
} from './templates';
import { MessageContent, MessageImageContent } from '../types/chat';
import { ollamaFetch } from './ollama-agent';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
const SETTINGS_STORAGE_KEY = 'locai-settings';

function sanitizeHost(host: string): string {
  return host.replace(/\/$/, '');
}

function resolveOllamaHost(explicitHost?: string): string {
  if (explicitHost) return sanitizeHost(explicitHost);

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { ollamaHost?: unknown };
        if (typeof parsed.ollamaHost === 'string' && parsed.ollamaHost.trim()) {
          return sanitizeHost(parsed.ollamaHost.trim());
        }
      }
    } catch {
      // Ignore settings parse errors and fall back
    }
  }

  const envHost = process.env.NEXT_PUBLIC_OLLAMA_URL;
  if (envHost) return sanitizeHost(envHost);

  return DEFAULT_OLLAMA_HOST;
}

function resolveOllamaApiBase(host?: string): string {
  return `${resolveOllamaHost(host)}/api`;
}

// Interface for Ollama models
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

// Interface for model list response
export interface OllamaModelListResponse {
  models: OllamaModel[];
}

// Interface for chat request content
export interface OllamaChatContentItem {
  type: 'text' | 'image';
  text?: string;
  image?: string; // Base64 encoded image
}

// ---------------------------------------------------------------------------
// Ollama Tool-Calling Types (compatible with Ollama v0.3+)
// ---------------------------------------------------------------------------

/** A tool definition sent to Ollama in the request */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: OllamaToolParameters;
  };
}

/** JSON Schema for tool parameters (aligns with ToolParametersSchema from agents/types) */
export interface OllamaToolParameters {
  type: 'object';
  properties: Record<string, OllamaToolProperty>;
  required?: string[];
}

/** A single property in a tool's parameter schema */
export interface OllamaToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: OllamaToolProperty;
  properties?: Record<string, OllamaToolProperty>;
  required?: string[];
  default?: unknown;
  [key: string]: unknown; // Allow extra JSON Schema keys
}

/** A tool call returned by the model in a response message */
export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/** Message shape used inside requests/responses (supports tool role) */
export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OllamaChatContentItem[];
  images?: string[];
  tool_calls?: OllamaToolCall[];
}

// Interface for chat requests
export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
  template?: string; // Optional template parameter for Ollama
  tools?: OllamaTool[];
}

// Interface for chat responses from Ollama API
export interface OllamaChatResponse {
  model: string;
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Token statistics interface
export interface TokenStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalDuration: number;
  tokensPerSecond: number;
}

// Our enriched response interface
export interface ChatResponse {
  content: string;
  tokenStats: TokenStats | null;
  tool_calls?: OllamaToolCall[];
}

// Streaming chunk interface
export interface StreamChunk {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  // Final chunk includes these
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Fetches all available models from Ollama
 */
export async function getOllamaModels(host?: string): Promise<OllamaModel[]> {
  try {
    const response = await ollamaFetch(`${resolveOllamaApiBase(host)}/tags`);
    
    if (!response.ok) {
      throw new Error(`Error fetching models: ${response.statusText}`);
    }
    
    const data = await response.json() as OllamaModelListResponse;
    return data.models;
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}

/**
 * Delete a model from Ollama
 */
export async function deleteOllamaModel(modelName: string, host?: string): Promise<void> {
  const response = await ollamaFetch(`${resolveOllamaApiBase(host)}/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete model: ${errorText || response.statusText}`);
  }
}

/**
 * Model info response from /api/show
 */
export interface ModelInfo {
  modelfile: string;
  parameters: string;
  template: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  model_info: {
    [key: string]: string | number | boolean | null;
  };
}

/**
 * Get detailed info about a specific model including context length
 */
export async function getModelInfo(
  modelName: string,
  host?: string,
): Promise<{ contextLength: number; parameterSize: string } | null> {
  try {
    const base = resolveOllamaHost(host);
    const response = await ollamaFetch(`${base}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName })
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as ModelInfo;
    
    // Extract context length from model_info
    // Different models use different keys
    const modelInfo = data.model_info || {};
    let contextLength = 0;
    
    // Check common context length keys
    for (const key of Object.keys(modelInfo)) {
      if (key.includes('context_length') || key.includes('context_window')) {
        const value = modelInfo[key];
        if (typeof value === 'number') {
          contextLength = value;
          break;
        }
      }
    }
    
    // Fallback: try to parse from parameters string
    if (contextLength === 0 && data.parameters) {
      const match = data.parameters.match(/num_ctx\s+(\d+)/);
      if (match) {
        contextLength = parseInt(match[1], 10);
      }
    }
    
    // Default fallback
    if (contextLength === 0) {
      contextLength = 4096; // Conservative default
    }
    
    return {
      contextLength,
      parameterSize: data.details?.parameter_size || 'Unknown'
    };
  } catch (error) {
    console.error('Error fetching model info:', error);
    return null;
  }
}

/**
 * Get the default system content for a model
 */
export function getModelSystemContent(modelName: string): string {
  return getDefaultSystemContent(modelName);
}

/**
 * Format a message based on the model and role
 */
export function formatMessage(modelName: string, role: 'system' | 'user' | 'assistant', content: string): string {
  switch (role) {
    case 'system':
      return formatSystemMessage(modelName, content);
    case 'user':
      return formatUserMessage(modelName, content);
    case 'assistant':
      return formatAssistantMessage(modelName, content);
    default:
      return content;
  }
}

/**
 * Converts a MessageContent to Ollama's expected format
 */
export function formatMessageContent(content: MessageContent): string | OllamaChatContentItem[] {
  // If content is a string, return it directly
  if (typeof content === 'string') {
    return content;
  }
  
  // If content is an image object
  if ((content as MessageImageContent).type === 'image') {
    const imageContent = content as MessageImageContent;
    return [
      {
        type: 'image',
        image: imageContent.url.startsWith('data:') 
          ? imageContent.url.split(',')[1] // Extract base64 data without the prefix
          : imageContent.url
      }
    ];
  }
  
  // If content is an array of mixed content
  if (Array.isArray(content)) {
    const formattedContent: OllamaChatContentItem[] = [];
    
    for (const item of content) {
      if (typeof item === 'string') {
        formattedContent.push({
          type: 'text',
          text: item
        });
      } else if ((item as MessageImageContent).type === 'image') {
        const imageItem = item as MessageImageContent;
        formattedContent.push({
          type: 'image',
          image: imageItem.url.startsWith('data:')
            ? imageItem.url.split(',')[1]
            : imageItem.url
        });
      }
    }
    
    return formattedContent;
  }
  
  // Fallback
  return String(content);
}

/** Input message shape accepted by our public chat functions */
export interface ChatInputMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent;
  tool_calls?: OllamaToolCall[];
}

/**
 * Formats messages for the Ollama API, handling vision model image extraction.
 * Shared between streaming and non-streaming chat functions.
 */
function formatMessagesForApi(
  model: string,
  messages: ChatInputMessage[]
): OllamaChatRequest['messages'] {
  const isVisionModel = model.toLowerCase().includes('vision');

  return messages.map(msg => {
    // Pass through tool-role messages directly (tool results fed back)
    if (msg.role === 'tool') {
      return {
        role: 'tool' as const,
        content: typeof msg.content === 'string' ? msg.content : String(msg.content),
      };
    }

    // Pass through assistant messages that contain tool_calls
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      return {
        role: 'assistant' as const,
        content: typeof msg.content === 'string' ? msg.content : '',
        tool_calls: msg.tool_calls,
      };
    }

    // For vision models, we need to handle images differently
    if (isVisionModel && msg.role === 'user') {
      const content = msg.content;

      // Check if there are images in the content
      const hasImages =
        (Array.isArray(content) && content.some(item => typeof item !== 'string')) ||
        (typeof content !== 'string' && (content as MessageImageContent)?.type === 'image');

      if (hasImages) {
        // Extract text and images to proper format
        let textContent = '';
        const images: string[] = [];

        if (Array.isArray(content)) {
          content.forEach(item => {
            if (typeof item === 'string') {
              textContent += (textContent ? ' ' : '') + item;
            } else if ((item as MessageImageContent).type === 'image') {
              const imageItem = item as MessageImageContent;
              const imageData = imageItem.url.startsWith('data:')
                ? imageItem.url.split(',')[1]
                : imageItem.url;
              images.push(imageData);
            }
          });
        } else if ((content as MessageImageContent).type === 'image') {
          const imageContent = content as MessageImageContent;
          const imageData = imageContent.url.startsWith('data:')
            ? imageContent.url.split(',')[1]
            : imageContent.url;
          images.push(imageData);
        }

        return {
          role: msg.role,
          content: textContent || "What is in this image?",
          images: images
        };
      }
    }

    // For non-vision models or messages without images, use standard format
    return {
      role: msg.role,
      content: formatMessageContent(msg.content)
    };
  });
}

/**
 * Builds the OllamaChatRequest with model-specific template and options.
 */
function buildChatRequest(
  model: string,
  formattedMessages: OllamaChatRequest['messages'],
  stream: boolean,
  options: Record<string, unknown> = {},
  tools?: OllamaTool[]
): OllamaChatRequest {
  const modelTemplate = getOllamaTemplate(model);
  const modelOptions = getDefaultOptions(model);

  const chatRequest: OllamaChatRequest = {
    model,
    messages: formattedMessages,
    stream,
    options: {
      ...modelOptions,
      ...options
    }
  };

  if (modelTemplate) {
    chatRequest.template = modelTemplate;
  }

  if (tools && tools.length > 0) {
    chatRequest.tools = tools;
  }

  return chatRequest;
}

/**
 * Extracts token statistics from an Ollama API response.
 */
function extractTokenStats(data: {
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  eval_duration?: number;
}): TokenStats | null {
  if (data.prompt_eval_count === undefined && data.eval_count === undefined) {
    return null;
  }

  const promptTokens = data.prompt_eval_count || 0;
  const completionTokens = data.eval_count || 0;
  const totalDuration = (data.total_duration || 0) / 1e9;
  const evalDuration = (data.eval_duration || 0) / 1e9;

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    totalDuration: Math.round(totalDuration * 100) / 100,
    tokensPerSecond: evalDuration > 0
      ? Math.round((completionTokens / evalDuration) * 10) / 10
      : 0
  };
}

/** Options for sendChatMessage and sendStreamingChatMessage (CQ-2: unified) */
export interface ChatCallOptions {
  options?: Record<string, unknown>;
  host?: string;
  tools?: OllamaTool[];
  signal?: AbortSignal;
}

/** @deprecated Use ChatCallOptions instead */
export type SendChatOptions = ChatCallOptions;
/** @deprecated Use ChatCallOptions instead */
export type StreamingChatOptions = ChatCallOptions;

// ---------------------------------------------------------------------------
// CQ-2: Shared helpers for sendChatMessage / sendStreamingChatMessage
// ---------------------------------------------------------------------------

interface ResolvedChatOptions {
  chatOptions: Record<string, unknown>;
  host: string | undefined;
  tools: OllamaTool[] | undefined;
  signal: AbortSignal | undefined;
}

/** Parse both the new ChatCallOptions and the legacy (options, host?) signatures. */
function parseChatOptions(
  optionsOrLegacy: ChatCallOptions | Record<string, unknown>,
  hostLegacy?: string,
): ResolvedChatOptions {
  if ('tools' in optionsOrLegacy || 'host' in optionsOrLegacy || 'signal' in optionsOrLegacy) {
    const opts = optionsOrLegacy as ChatCallOptions;
    return {
      chatOptions: opts.options ?? {},
      host: opts.host,
      tools: opts.tools,
      signal: opts.signal,
    };
  }
  return {
    chatOptions: optionsOrLegacy as Record<string, unknown>,
    host: hostLegacy,
    tools: undefined,
    signal: undefined,
  };
}

/** Shared fetch + error handling for the Ollama /api/chat endpoint. */
async function fetchOllamaChat(
  model: string,
  messages: ChatInputMessage[],
  stream: boolean,
  opts: ResolvedChatOptions,
): Promise<Response> {
  const formattedMessages = formatMessagesForApi(model, messages);
  const chatRequest = buildChatRequest(model, formattedMessages, stream, opts.chatOptions, opts.tools);

  const response = await ollamaFetch(`${resolveOllamaApiBase(opts.host)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatRequest),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error in chat request: ${response.statusText}. Details: ${errorText}`);
  }

  return response;
}

/**
 * Sends a chat request to an Ollama model with support for images
 * Returns content and token statistics
 */
export async function sendChatMessage(
  model: string,
  messages: ChatInputMessage[],
  optionsOrLegacy: ChatCallOptions | Record<string, unknown> = {},
  hostLegacy?: string
): Promise<ChatResponse> {
  try {
    const opts = parseChatOptions(optionsOrLegacy, hostLegacy);
    const response = await fetchOllamaChat(model, messages, false, opts);
    const data = await response.json() as OllamaChatResponse;

    return {
      content: data.message.content,
      tokenStats: extractTokenStats(data),
      tool_calls: data.message.tool_calls,
    };
  } catch (error) {
    console.error('Error sending chat message:', error);
    return {
      content: 'An error occurred. Please try again later.',
      tokenStats: null
    };
  }
}

/**
 * Sends a streaming chat request to an Ollama model
 * Calls onChunk for each token received, onComplete when done
 */
export async function sendStreamingChatMessage(
  model: string,
  messages: ChatInputMessage[],
  onChunk: (content: string, fullContent: string) => void,
  onComplete: (response: ChatResponse) => void,
  onError?: (error: Error) => void,
  optionsOrLegacy: ChatCallOptions | Record<string, unknown> = {},
  hostLegacy?: string
): Promise<void> {
  try {
    const opts = parseChatOptions(optionsOrLegacy, hostLegacy);
    const response = await fetchOllamaChat(model, messages, true, opts);

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let finalChunk: StreamChunk | null = null;
    // Accumulate tool_calls across streaming chunks
    let accumulatedToolCalls: OllamaToolCall[] | undefined;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const chunk = JSON.parse(line) as StreamChunk;

          if (chunk.message?.content) {
            fullContent += chunk.message.content;
            onChunk(chunk.message.content, fullContent);
          }

          // Accumulate tool_calls from streaming chunks
          if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
            if (!accumulatedToolCalls) accumulatedToolCalls = [];
            accumulatedToolCalls.push(...chunk.message.tool_calls);
          }

          if (chunk.done) {
            finalChunk = chunk;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    onComplete({
      content: fullContent,
      tokenStats: finalChunk ? extractTokenStats(finalChunk) : null,
      tool_calls: accumulatedToolCalls,
    });

  } catch (error) {
    console.error('Error in streaming chat:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error'));
  }
}

// ---------------------------------------------------------------------------
// Non-streaming helper for agent executor (server-side, tool-calling)
// ---------------------------------------------------------------------------

/**
 * Send a non-streaming chat request with tool definitions.
 * Designed for the agent executor loop where we need tool_calls in the response.
 */
export async function sendAgentChatMessage(
  model: string,
  messages: OllamaChatMessage[],
  tools: OllamaTool[],
  options: {
    host?: string;
    signal?: AbortSignal;
    chatOptions?: Record<string, unknown>;
  } = {}
): Promise<{
  content: string;
  tool_calls?: OllamaToolCall[];
  tokenStats: TokenStats | null;
}> {
  const host = options.host;
  const chatOptions = options.chatOptions ?? {};

  const chatRequest: OllamaChatRequest = {
    model,
    messages,
    stream: false,
    options: chatOptions,
  };

  if (tools.length > 0) {
    chatRequest.tools = tools;
  }

  const response = await ollamaFetch(`${resolveOllamaApiBase(host)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatRequest),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama chat error: ${response.statusText}. ${errorText}`);
  }

  const data = await response.json() as OllamaChatResponse;

  return {
    content: data.message.content ?? '',
    tool_calls: data.message.tool_calls,
    tokenStats: extractTokenStats(data),
  };
} 
