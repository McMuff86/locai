// ============================================================================
// ComfyUI Workflow Template — Type Definitions
// ============================================================================

export interface ComfyUIWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  workflow: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
  createdAt: string;
}

export interface ComfyUITemplateSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}
