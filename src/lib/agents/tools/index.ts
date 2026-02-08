// ============================================================================
// Built-in Tools Registration
// ============================================================================
// Registers all default agent tools in the provided (or default) registry.
// ============================================================================

import { ToolRegistry, defaultRegistry } from '../registry';
import searchDocumentsTool from './searchDocuments';
import webSearchTool from './webSearch';
import readFileTool from './readFile';
import writeFileTool from './writeFile';
import editFileTool from './editFile';
import createNoteTool from './createNote';
import saveMemoryTool from './saveMemory';
import recallMemoryTool from './recallMemory';
import runCommandTool from './runCommand';
import generateImageTool from './generateImage';
import runCodeTool from './runCode';

/** All built-in tools in registration order */
export const builtinTools = [
  searchDocumentsTool,
  webSearchTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  createNoteTool,
  saveMemoryTool,
  recallMemoryTool,
  runCommandTool,
  runCodeTool,
  generateImageTool,
] as const;

/**
 * Register all built-in tools in the given registry.
 * Safe to call multiple times – skips already registered tools.
 */
export function registerBuiltinTools(registry: ToolRegistry = defaultRegistry): void {
  for (const tool of builtinTools) {
    if (!registry.has(tool.definition.name)) {
      registry.register(tool);
    }
  }
}

// Re-export individual tools for selective registration
export { searchDocumentsTool, webSearchTool, readFileTool, writeFileTool, editFileTool, createNoteTool, saveMemoryTool, recallMemoryTool, runCommandTool, runCodeTool, generateImageTool };
