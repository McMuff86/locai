// Ollama API functions
import { 
  formatSystemMessage, 
  formatUserMessage, 
  formatAssistantMessage,
  getDefaultSystemContent,
  getOllamaTemplate
} from './templates';

// Base URL for the Ollama API
const OLLAMA_API_URL = 'http://localhost:11434/api';

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

// Interface for chat requests
export interface OllamaChatRequest {
  model: string;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
  template?: string; // Optional template parameter for Ollama
}

// Interface for chat responses
export interface OllamaChatResponse {
  model: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
}

/**
 * Fetches all available models from Ollama
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/tags`);
    
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
 * Sends a chat request to an Ollama model
 */
export async function sendChatMessage(
  model: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options = {}
): Promise<string> {
  try {
    // Get model-specific template if available
    const modelTemplate = getOllamaTemplate(model);
    
    const chatRequest: OllamaChatRequest = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: false,
      options: {
        temperature: 0.7,
        ...options
      }
    };
    
    // Add template if available for the model
    if (modelTemplate) {
      console.log(`Using custom template for model: ${model}`);
      chatRequest.template = modelTemplate;
    }
    
    const response = await fetch(`${OLLAMA_API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatRequest)
    });
    
    if (!response.ok) {
      throw new Error(`Error in chat request: ${response.statusText}`);
    }
    
    const data = await response.json() as OllamaChatResponse;
    return data.message.content;
  } catch (error) {
    console.error('Error sending chat message:', error);
    return 'An error occurred. Please try again later.';
  }
} 