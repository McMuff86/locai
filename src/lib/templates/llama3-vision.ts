/**
 * Templates for llama3.2-vision model
 */

export const modelName = "llama3.2-vision";

// Default system content
export const defaultSystemContent = `You are a helpful vision assistant that can analyze and describe images. 
Provide accurate, detailed, and helpful descriptions of images that users share with you.
Format your responses using markdown when appropriate to enhance clarity.`;

// System prompt template
export const systemPromptTemplate = (content: string) => content;

// User message template - Simple pass-through
export const userMessageTemplate = (content: string) => content;

// Assistant message template - Simple pass-through
export const assistantMessageTemplate = (content: string) => content;

// The custom template for llama3.2-vision as specified
export const ollamaTemplate = `{{- range $index, $_ := .Messages }}<|start_header_id|>{{ .Role }}<|end_header_id|>

{{ .Content }}
{{- if gt (len (slice $.Messages $index)) 1 }}<|eot_id|>
{{- else if ne .Role "assistant" }}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{{ end }}
{{- end }}`;

// Model-specific options
export const defaultOptions = {
  temperature: 0.6,
  top_p: 0.9
}; 