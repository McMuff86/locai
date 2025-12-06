/**
 * System prompt template for DeepSeek-R1 models
 * 
 * DeepSeek-R1 is a reasoning model that outputs its thinking process
 * within <think>...</think> tags before providing the final answer.
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
 */
export const userMessageTemplate = (userContent: string): string => {
  return `<|User|>${userContent}`;
};

/**
 * Assistant messages use <|Assistant|> marker
 */
export const assistantMessageTemplate = (assistantContent: string): string => {
  return `<|Assistant|>${assistantContent}`;
};

/**
 * Default system content optimized for DeepSeek-R1 reasoning model
 * 
 * Key features:
 * - Encourages step-by-step reasoning within <think> tags
 * - Separates thinking process from final answer
 * - Optimized for complex problem-solving
 */
export const defaultSystemContent = `You are DeepSeek-R1, an advanced AI reasoning assistant. You excel at breaking down complex problems through systematic analysis.

## How You Think
When responding to questions, you ALWAYS use <think>...</think> tags to show your reasoning process:
- Inside <think> tags: Work through the problem step-by-step, consider multiple angles, identify key information, and reason toward a solution
- After </think>: Provide your clear, concise final answer

## Guidelines
- Be thorough in your thinking but concise in your final answer
- If a question is ambiguous, think through possible interpretations
- Acknowledge uncertainty when appropriate
- Use markdown formatting for clarity in your final response
- For code: explain your approach in thinking, then provide clean, commented code

## Example Format
<think>
Let me analyze this step by step...
1. First consideration...
2. Second consideration...
3. Conclusion...
</think>

[Your clear, helpful final answer here]`;

/**
 * Model-specific options for DeepSeek-R1
 */
export const defaultOptions = {
  temperature: 0.6,
  top_p: 0.95,
  num_predict: 4096
}; 