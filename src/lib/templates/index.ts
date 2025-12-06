/**
 * Model-specific prompt templates
 * 
 * This file exports templates for various LLM models and provides a mechanism
 * to select the appropriate template based on the model name.
 */

import * as llama3 from './llama3';
import * as mistral from './mistral';
import * as gemma from './gemma';
import * as deepseek from './deepseek';
import * as llama3Vision from './llama3-vision';
import * as graniteVision from './granite-vision';

// Default template if no specific one is found
const defaultTemplate = {
  modelName: "default",
  systemPromptTemplate: (content: string) => content,
  userMessageTemplate: (content: string) => content,
  assistantMessageTemplate: (content: string) => content,
  defaultSystemContent: `You're running locally on the user's hardware through Ollama.

GUIDELINES:
- Provide clear, accurate, and helpful responses
- Be concise but thorough in your explanations
- When you don't know something, acknowledge that instead of making up information
- Cite sources when appropriate
- Respect user privacy and do not ask for unnecessary personal information
- Format your responses neatly with markdown when it enhances clarity
- Code snippets should be enclosed in proper markdown code blocks with language tags
- Tables should be well-formatted and easy to read

The user's hardware is providing your computing resources, so they value efficiency and relevance in your responses.`
};

// Export all templates
export const templates = {
  llama3,
  mistral,
  gemma,
  deepseek,
  llama3Vision,
  graniteVision,
  default: defaultTemplate
};

/**
 * Get the appropriate template for a model
 * 
 * @param modelName - The name of the model
 * @returns The template for the model or the default template if not found
 */
export function getTemplateForModel(modelName: string) {
  // Normalize model name to lowercase and remove version numbers/punctuation
  const normalizedName = modelName.toLowerCase().replace(/[\d:.-]/g, '');
  
  // Vision models first (more specific match)
  if (normalizedName.includes('granite') && normalizedName.includes('vision')) {
    return templates.graniteVision;
  } else if (normalizedName.includes('llama') && normalizedName.includes('vision')) {
    return templates.llama3Vision;
  }
  // Then general models
  else if (normalizedName.includes('llama') || normalizedName.includes('dolphin')) {
    return templates.llama3;
  } else if (normalizedName.includes('mistral')) {
    return templates.mistral;
  } else if (normalizedName.includes('gemma')) {
    return templates.gemma;
  } else if (normalizedName.includes('deepseek')) {
    return templates.deepseek;
  } else if (normalizedName.includes('granite')) {
    return templates.graniteVision; // Granite models default to vision template
  }
  
  return templates.default;
}

/**
 * Format a system message for a specific model
 * 
 * @param modelName - The name of the model
 * @param content - The content of the system message
 * @returns The formatted system message
 */
export function formatSystemMessage(modelName: string, content: string) {
  const template = getTemplateForModel(modelName);
  return template.systemPromptTemplate(content);
}

/**
 * Get the default system content for a specific model
 * 
 * @param modelName - The name of the model
 * @returns The default system content for the model
 */
export function getDefaultSystemContent(modelName: string) {
  const template = getTemplateForModel(modelName);
  return template.defaultSystemContent || defaultTemplate.defaultSystemContent;
}

/**
 * Format a user message for a specific model
 * 
 * @param modelName - The name of the model
 * @param content - The content of the user message
 * @returns The formatted user message
 */
export function formatUserMessage(modelName: string, content: string) {
  const template = getTemplateForModel(modelName);
  return template.userMessageTemplate(content);
}

/**
 * Format an assistant message for a specific model
 * 
 * @param modelName - The name of the model
 * @param content - The content of the assistant message
 * @returns The formatted assistant message
 */
export function formatAssistantMessage(modelName: string, content: string) {
  const template = getTemplateForModel(modelName);
  return template.assistantMessageTemplate(content);
}

/**
 * Get the Ollama template for a specific model if available
 * 
 * @param modelName - The name of the model
 * @returns The Ollama template or undefined if not available
 */
export function getOllamaTemplate(modelName: string): string | undefined {
  const template = getTemplateForModel(modelName);
  return (template as any).ollamaTemplate;
}

/**
 * Get default options for a specific model if available
 * 
 * @param modelName - The name of the model
 * @returns The default options or an empty object if not available
 */
export function getDefaultOptions(modelName: string): Record<string, any> {
  const template = getTemplateForModel(modelName);
  return (template as any).defaultOptions || {};
} 