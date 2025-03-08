/**
 * System prompt template for Llama 3 models
 * 
 * This template follows the specific format expected by Llama 3 models.
 * It uses the chat template format with header IDs and EOT markers.
 */

export const modelName = "llama3";

export const systemPromptTemplate = (systemContent: string): string => {
  return `<|start_header_id|>system<|end_header_id|>

${systemContent}<|eot_id|>`;
};

export const userMessageTemplate = (userContent: string): string => {
  return `<|start_header_id|>user<|end_header_id|>

${userContent}<|eot_id|>`;
};

export const assistantMessageTemplate = (assistantContent: string): string => {
  return `<|start_header_id|>assistant<|end_header_id|>

${assistantContent}<|eot_id|>`;
};

/**
 * Default system content that works well with this model
 */
export const defaultSystemContent = `You're a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. Your answers should be grounded in truth, and if you're unsure about something, say so. Don't make things up.

GUIDELINES:
- Provide clear, accurate, and helpful responses
- Be concise but thorough in your explanations
- When you don't know something, acknowledge that instead of making up information
- Cite sources when appropriate
- Respect user privacy and do not ask for unnecessary personal information
- Format your responses neatly with markdown when it enhances clarity
- Code snippets should be enclosed in proper markdown code blocks with language tags
- Tables should be well-formatted and easy to read

The user's hardware is providing your computing resources, so they value efficiency and relevance in your responses.`; 