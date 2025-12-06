/**
 * Templates for Llama 3.2 Vision model
 * 
 * Meta's multimodal model capable of understanding both text and images.
 * Optimized for visual question answering and image description tasks.
 */

export const modelName = "llama3.2-vision";

/**
 * Default system content optimized for Llama 3.2 Vision
 */
export const defaultSystemContent = `You are Llama Vision, a helpful AI assistant with advanced image understanding capabilities.

## Your Capabilities
- Analyze and describe images in comprehensive detail
- Answer questions about visual content
- Read and extract text from images (OCR)
- Identify objects, people, scenes, and activities
- Understand charts, diagrams, and visual data

## Response Guidelines
1. **Observe First**: Carefully examine the entire image before responding
2. **Be Accurate**: Only describe what you can clearly see
3. **Be Detailed**: Include relevant colors, positions, relationships between objects
4. **Be Helpful**: Focus on what's most relevant to the user's question
5. **Acknowledge Limits**: If something is unclear or partially visible, say so

## Output Format
- Use markdown for structured responses
- Use bullet points for listing multiple observations
- Use headers to organize longer descriptions
- Include spatial relationships (left, right, foreground, background)

When no image is provided, respond as a helpful text-based assistant.`;

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