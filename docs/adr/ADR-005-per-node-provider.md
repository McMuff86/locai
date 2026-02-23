# ADR-005: Per-Node Provider & Settings

**Status:** Accepted (Implemented)  
**Date:** 2026-02-23  
**Context:** Sprint 6 — Jeder Agent-Node im Flow Builder soll eigene Provider/Model/Settings haben können

---

## Decision

### StepNodeConfig in WorkflowPlanStep

Erweiterte Felder in `WorkflowPlanStep` (workflowTypes.ts):

```typescript
interface WorkflowPlanStep {
  id: string;
  description: string;
  expectedTools: string[];
  dependsOn: string[];
  successCriteria: string;
  // Per-Node Settings (NEU)
  provider?: string;        // 'ollama' | 'anthropic' | 'openai' | 'openrouter'
  model?: string;           // z.B. 'qwen3:30b-a3b', 'claude-sonnet-4'
  temperature?: number;     // 0-2, default 0.3
  maxIterations?: number;   // 1-20, default 5
  systemPrompt?: string;    // Step-spezifischer System Prompt
}
```

### Flow Compiler (engine.ts)

`compileVisualWorkflowToPlan()` extrahiert aus `AgentNodeConfig`:
- `provider` → Step.provider
- `model` → Step.model
- `temperature` → Step.temperature
- `maxIterations` → Step.maxIterations
- `systemPrompt` → Step.systemPrompt

### Workflow Engine (workflow.ts)

`executeStep()` Auflösung:
1. **Provider:** `planStep.provider` → falls gesetzt, `createServerProvider()` pro Step. Fallback: Workflow-Level Provider
2. **Model:** `planStep.model` → falls gesetzt, überschreibt Workflow-Level Model
3. **Temperature:** `planStep.temperature` → in `chatOptions.temperature`
4. **MaxIterations:** `planStep.maxIterations` → in `loopParams.options.maxIterations`
5. **Tools:** `planStep.expectedTools` → werden zu `enabledTools` pro Step (Step-Tool-Isolation)

### Beispiel: Mixed-Provider Flow

```
Input → Read PDF (Ollama/qwen3, temp 0.1, tools: [read_pdf])
      → Analyze (OpenAI/gpt-4.1, temp 0.7, tools: [write_file])
      → Output
```

Compiled Plan:
```json
{
  "steps": [
    {
      "id": "step-1",
      "description": "PDF lesen",
      "provider": "ollama",
      "model": "qwen3:30b-a3b",
      "temperature": 0.1,
      "maxIterations": 2,
      "expectedTools": ["read_pdf"]
    },
    {
      "id": "step-2",
      "description": "Analyse erstellen",
      "provider": "openai",
      "model": "gpt-4.1",
      "temperature": 0.7,
      "maxIterations": 5,
      "expectedTools": ["write_file"]
    }
  ]
}
```

---

## Consequences

- Flows können lokale + Cloud-Modelle mixen (kostenoptimiert)
- Step-Tool-Isolation verhindert dass Agent Tools im falschen Step nutzt
- UI: Temperature + Max Iterations Felder im ConfigPanel (Sprint 5, commit 4a8b049)
- Provider-Selector bereits im ConfigPanel vorhanden
