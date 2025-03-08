/**
 * System prompt template for Gemma models
 * 
 * This template follows the specific format expected by Gemma models.
 */

export const modelName = "gemma";

export const systemPromptTemplate = (systemContent: string): string => {
  return `<start_of_turn>system
${systemContent}
<end_of_turn>`;
};

export const userMessageTemplate = (userContent: string): string => {
  return `<start_of_turn>user
${userContent}
<end_of_turn>`;
};

export const assistantMessageTemplate = (assistantContent: string): string => {
  return `<start_of_turn>model
${assistantContent}
<end_of_turn>`;
};

/**
 * Default system content that works well with this model - to be fine-tuned
 */
export const defaultSystemContent = ``; 