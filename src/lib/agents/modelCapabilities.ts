// ============================================================================
// Model Capabilities Registry
// ============================================================================
// Static registry for Ollama model tool-calling capabilities.
// Not all models support tool-calling reliably. This helps the UI
// warn users when they select an unsuitable model for agent mode.
// ============================================================================

export type AgentCapabilityTier = 'excellent' | 'good' | 'basic' | 'none';

export interface ModelCapabilityInfo {
  tier: AgentCapabilityTier;
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Pattern-based model capability mapping
// ---------------------------------------------------------------------------

interface ModelPattern {
  /** Regex pattern to match model names (case-insensitive) */
  pattern: RegExp;
  tier: AgentCapabilityTier;
}

const MODEL_PATTERNS: ModelPattern[] = [
  // Excellent: Native tool-calling, reliable
  { pattern: /qwen2\.5|qwen3|qwen2:7[2-9]|qwen2:1[0-9]{2}/i, tier: 'excellent' },
  { pattern: /llama3\.[1-3]|llama-3\.[1-3]|llama3:[1-9]\d*b/i, tier: 'excellent' },
  { pattern: /command-r/i, tier: 'excellent' },
  { pattern: /hermes/i, tier: 'excellent' },
  { pattern: /firefunction/i, tier: 'excellent' },
  { pattern: /mistral-large/i, tier: 'excellent' },
  { pattern: /nemotron/i, tier: 'excellent' },

  // Good: Solid support
  { pattern: /mistral(?!-large)|mistral-nemo/i, tier: 'good' },
  { pattern: /mixtral/i, tier: 'good' },
  { pattern: /llama3(?!\.[1-3])/i, tier: 'good' },

  // Basic: Limited, may hallucinate tool calls
  { pattern: /gemma/i, tier: 'basic' },
  { pattern: /deepseek/i, tier: 'basic' },
  { pattern: /codellama/i, tier: 'basic' },
  { pattern: /yi-/i, tier: 'basic' },

  // None: No tool-calling support
  { pattern: /phi/i, tier: 'none' },
  { pattern: /tinyllama/i, tier: 'none' },
  { pattern: /orca-mini/i, tier: 'none' },
  { pattern: /stablelm/i, tier: 'none' },
  { pattern: /falcon/i, tier: 'none' },
  { pattern: /vicuna/i, tier: 'none' },
];

const TIER_INFO: Record<AgentCapabilityTier, Omit<ModelCapabilityInfo, 'tier'>> = {
  excellent: {
    label: 'Exzellent',
    description: 'Natives Tool-Calling, zuverlaessig und empfohlen fuer Agent-Modus.',
  },
  good: {
    label: 'Gut',
    description: 'Solide Tool-Calling Unterstuetzung, funktioniert in den meisten Faellen.',
  },
  basic: {
    label: 'Begrenzt',
    description: 'Begrenzte Unterstuetzung, kann falsche Tool-Calls erzeugen.',
  },
  none: {
    label: 'Nicht unterstuetzt',
    description: 'Kein Tool-Calling. Agent-Modus wird nicht funktionieren.',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the agent capability tier and info for a given model name.
 */
export function getModelAgentCapability(modelName: string): ModelCapabilityInfo {
  const match = MODEL_PATTERNS.find((p) => p.pattern.test(modelName));
  if (match) {
    return { tier: match.tier, ...TIER_INFO[match.tier] };
  }
  // Unknown model
  return {
    tier: 'basic',
    label: 'Unbekannt',
    description: 'Modell-Kompatibilitaet unbekannt. Tool-Calling koennte funktionieren.',
  };
}

/**
 * Check if a model is suitable for agent mode (excellent or good tier).
 */
export function isModelSuitableForAgent(modelName: string): boolean {
  const { tier } = getModelAgentCapability(modelName);
  return tier === 'excellent' || tier === 'good';
}
