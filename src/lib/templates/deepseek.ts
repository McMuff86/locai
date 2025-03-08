/**
 * System prompt template for Deepseek models
 * 
 * This template follows the specific format expected by Deepseek-R1 models.
 */

export const modelName = "deepseek";

/**
 * The complete Ollama template for Deepseek models 
 */
export const ollamaTemplate = `{{- if .System }}{{ .System }}{{ end }}
{{- range $i, $_ := .Messages }}
{{- $last := eq (len (slice $.Messages $i)) 1}}
{{- if eq .Role "user" }}<|User|>{{ .Content }}
{{- else if eq .Role "assistant" }}<|Assistant|>{{ .Content }}{{- if not $last }}<|end_of_sentence|>{{- end }}
{{- end }}
{{- if and $last (ne .Role "assistant") }}<|Assistant|>{{- end }}
{{- end }}`;

/**
 * For deepseek, the system content is used directly without special markers
 */
export const systemPromptTemplate = (systemContent: string): string => {
  return systemContent;
};

/**
 * User messages use <|User|> marker
 * Using ASCII equivalents to avoid encoding issues
 */
export const userMessageTemplate = (userContent: string): string => {
  return `<|User|>${userContent}`;
};

/**
 * Assistant messages use <|Assistant|> marker
 * Using ASCII equivalents to avoid encoding issues
 * Note: In conversation context we would add <|end_of_sentence|> at the end
 * except for the last message, but in our case Ollama handles that
 */
export const assistantMessageTemplate = (assistantContent: string): string => {
  return `<|Assistant|>${assistantContent}`;
};

/**
 * Default system content that works well with this model
 */
export const defaultSystemContent = `I want you to act as a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe.
If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrect.
If you don't know the answer to a question, please don't share false information.

Keep your responses concise and to the point. Format your responses with markdown to enhance readability when appropriate.`; 