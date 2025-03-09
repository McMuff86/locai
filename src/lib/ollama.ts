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

// Interface for chat request content
export interface OllamaChatContentItem {
  type: 'text' | 'image';
  text?: string;
  image?: string; // Base64 encoded image
}

// Interface for chat requests
export interface OllamaChatRequest {
  model: string;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string | OllamaChatContentItem[];
    images?: string[]; // Added for vision models
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

/**
 * Sends a chat request to an Ollama model with support for images
 */
export async function sendChatMessage(
  model: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: MessageContent }[],
  options = {}
): Promise<string> {
  try {
    // Get model-specific template if available
    const modelTemplate = getOllamaTemplate(model);
    
    // Get model-specific default options
    const modelOptions = getDefaultOptions(model);
    
    // Check if using a vision model
    const isVisionModel = model.toLowerCase().includes('vision');
    
    // Format messages for Ollama API
    const formattedMessages = messages.map(msg => {
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
          let images: string[] = [];
          
          if (Array.isArray(content)) {
            // Process array of content (text and images)
            content.forEach(item => {
              if (typeof item === 'string') {
                // Combine all text content
                textContent += (textContent ? ' ' : '') + item;
              } else if ((item as MessageImageContent).type === 'image') {
                // Extract image data
                const imageItem = item as MessageImageContent;
                const imageData = imageItem.url.startsWith('data:')
                  ? imageItem.url.split(',')[1] // Extract base64 data without prefix
                  : imageItem.url;
                images.push(imageData);
              }
            });
          } else if ((content as MessageImageContent).type === 'image') {
            // Single image content
            const imageContent = content as MessageImageContent;
            const imageData = imageContent.url.startsWith('data:')
              ? imageContent.url.split(',')[1]
              : imageContent.url;
            images.push(imageData);
          }
          
          // Return the message in the format expected by vision models
          return {
            role: msg.role,
            content: textContent || "What is in this image?", // Default prompt if no text
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
    
    const chatRequest: OllamaChatRequest = {
      model,
      messages: formattedMessages,
      stream: false,
      options: {
        ...modelOptions,
        ...options
      }
    };
    
    // Add template if available for the model
    if (modelTemplate) {
      console.log(`Using custom template for model: ${model}`);
      chatRequest.template = modelTemplate;
    }
    
    console.log('Sending chat request with payload:', JSON.stringify(chatRequest, null, 2));
    
    const response = await fetch(`${OLLAMA_API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error in chat request: ${response.statusText}. Details: ${errorText}`);
    }
    
    const data = await response.json() as OllamaChatResponse;
    return data.message.content;
  } catch (error) {
    console.error('Error sending chat message:', error);
    return 'An error occurred. Please try again later.';
  }
} 