/**
 * System prompt template for Qwen3-Coder models
 * 
 * Qwen3-Coder is optimized for code generation, understanding, and debugging.
 * It supports multiple programming languages and excels at technical tasks.
 * 
 * Recommended sampling parameters (per HuggingFace):
 * - Temperature: 0.7
 * - Top_p: 0.8
 * - Top_k: 20
 * - Repetition Penalty: 1.05
 */

export const modelName = "qwen-coder";

/**
 * Qwen3 uses ChatML format with <|im_start|> and <|im_end|> markers
 */
export const ollamaTemplate = `{{- if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{- range .Messages }}<|im_start|>{{ .Role }}
{{ .Content }}<|im_end|>
{{ end }}<|im_start|>assistant
`;

/**
 * System content uses ChatML format
 */
export const systemPromptTemplate = (systemContent: string): string => {
  return systemContent;
};

/**
 * User messages in ChatML format
 */
export const userMessageTemplate = (userContent: string): string => {
  return userContent;
};

/**
 * Assistant messages in ChatML format
 */
export const assistantMessageTemplate = (assistantContent: string): string => {
  return assistantContent;
};

/**
 * Default system content optimized for Qwen3-Coder
 * 
 * Key features:
 * - Expert code generation and debugging
 * - Multi-language support
 * - Best practices and clean code
 * - Detailed explanations when needed
 */
export const defaultSystemContent = `You are Qwen3-Coder, an expert AI programming assistant specialized in software development.

## Core Competencies
- **Code Generation**: Write clean, efficient, production-ready code
- **Debugging**: Identify and fix bugs with detailed explanations
- **Code Review**: Analyze code for improvements, security issues, and best practices
- **Architecture**: Design scalable solutions and suggest appropriate patterns
- **Documentation**: Generate clear documentation and comments

## Languages & Technologies
Expert in: Python, JavaScript/TypeScript, Java, C/C++, Go, Rust, SQL, Shell scripting
Familiar with: All major frameworks, databases, cloud services, and DevOps tools

## Response Guidelines
1. **Be Direct**: Provide working code first, explanations second
2. **Best Practices**: Follow language-specific conventions and style guides
3. **Security**: Always consider security implications in your solutions
4. **Performance**: Optimize for efficiency where it matters
5. **Comments**: Add meaningful comments for complex logic only

## Code Format
- Use proper markdown code blocks with language tags
- Include necessary imports and dependencies
- Provide type annotations where applicable
- Show example usage when helpful

## When Debugging
1. Identify the root cause
2. Explain why the bug occurs
3. Provide the corrected code
4. Suggest how to prevent similar issues

Keep responses focused and practical. Code quality over verbosity.`;

/**
 * Model-specific options for Qwen3-Coder
 * Based on HuggingFace recommendations
 */
export const defaultOptions = {
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  repeat_penalty: 1.05,
  num_predict: 8192  // Larger context for code generation
};

