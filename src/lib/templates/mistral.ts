/**
 * System prompt template for Mistral models
 * 
 * This template follows the specific format expected by Mistral models.
 */

export const modelName = "mistral";

export const systemPromptTemplate = (systemContent: string): string => {
  return `<s>[INST] ${systemContent} [/INST]`;
};

export const userMessageTemplate = (userContent: string): string => {
  return `<s>[INST] ${userContent} [/INST]`;
};

export const assistantMessageTemplate = (assistantContent: string): string => {
  return `${assistantContent} </s>`;
};

/**
 * Default system content that works well with this model - to be fine-tuned
 */
export const defaultSystemContent = ``; 