// Ollama API functions

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
 * Sends a chat request to an Ollama model
 */
export async function sendChatMessage(
  model: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options = {}
): Promise<string> {
  try {
    const chatRequest: OllamaChatRequest = {
      model,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
        ...options
      }
    };
    
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