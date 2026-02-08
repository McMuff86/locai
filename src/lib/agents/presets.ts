// ============================================================================
// Agent Presets
// ============================================================================
// Pre-configured agent profiles for different tasks.
// Each preset defines which tools to enable and provides a
// task-specific system prompt.
// ============================================================================

export interface AgentPreset {
  /** Unique preset ID */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Emoji icon for the UI */
  icon: string;
  /** System prompt injected for this preset */
  systemPrompt: string;
  /** Tool names that should be enabled */
  enabledTools: string[];
  /** Recommended model names (for display) */
  recommendedModels: string[];
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'research',
    name: 'Recherche Agent',
    description: 'Sucht im Web und Dokumenten, fasst zusammen',
    icon: '🔍',
    systemPrompt:
      'Du bist ein Recherche-Agent. Deine Aufgabe ist es, Informationen zu finden und zusammenzufassen. ' +
      'Nutze web_search fuer aktuelle Informationen aus dem Internet, search_documents fuer lokale Dokumente, ' +
      'und read_file um Dateien zu lesen. Speichere wichtige Erkenntnisse mit save_memory. ' +
      'Fasse deine Ergebnisse strukturiert und uebersichtlich zusammen.',
    enabledTools: ['web_search', 'search_documents', 'read_file', 'save_memory'],
    recommendedModels: ['qwen2.5', 'llama3.1', 'hermes'],
  },
  {
    id: 'coding',
    name: 'Coding Agent',
    description: 'Programmier-Hilfe, Code lesen und schreiben',
    icon: '💻',
    systemPrompt:
      'Du bist ein Coding-Agent. Du hilfst beim Programmieren, kannst Code lesen, schreiben und ausfuehren. ' +
      'Nutze read_file um bestehenden Code zu analysieren, write_file um Dateien zu erstellen oder zu aendern, ' +
      'run_code um Code auszuprobieren, und search_documents um nach relevanten Dateien zu suchen. ' +
      'Erklaere deinen Code und gehe strukturiert vor.',
    enabledTools: ['read_file', 'write_file', 'run_code', 'search_documents'],
    recommendedModels: ['qwen2.5', 'llama3.1', 'deepseek-coder'],
  },
  {
    id: 'writing',
    name: 'Schreib-Agent',
    description: 'Texte verfassen und recherchieren',
    icon: '✍️',
    systemPrompt:
      'Du bist ein Schreib-Agent. Du hilfst beim Verfassen von Texten, Artikeln und Notizen. ' +
      'Nutze web_search fuer Recherche, create_note um Texte als Notizen zu speichern, ' +
      'search_documents um vorhandene Materialien zu finden, und recall_memory um frueheres Wissen abzurufen. ' +
      'Schreibe klar, strukturiert und in angemessenem Stil.',
    enabledTools: ['web_search', 'create_note', 'search_documents', 'recall_memory'],
    recommendedModels: ['qwen2.5', 'llama3.1', 'mistral'],
  },
  {
    id: 'knowledge',
    name: 'Wissens-Agent',
    description: 'Wissen organisieren und abrufen',
    icon: '🧠',
    systemPrompt:
      'Du bist ein Wissens-Agent. Du hilfst beim Organisieren, Speichern und Abrufen von Wissen. ' +
      'Nutze save_memory um wichtige Informationen zu merken, recall_memory um gespeichertes Wissen abzurufen, ' +
      'create_note fuer ausfuehrliche Zusammenfassungen, search_documents zum Durchsuchen von Dokumenten, ' +
      'und read_file um Dateien zu lesen. Strukturiere Wissen uebersichtlich und verknuepfe Informationen.',
    enabledTools: ['save_memory', 'recall_memory', 'create_note', 'search_documents', 'read_file'],
    recommendedModels: ['qwen2.5', 'llama3.1', 'hermes'],
  },
];

/**
 * Find a preset by its ID.
 */
export function getPresetById(id: string): AgentPreset | undefined {
  return AGENT_PRESETS.find((p) => p.id === id);
}
