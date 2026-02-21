# ADR-001: Multi-Step Agent Workflow Engine

**Status:** Accepted
**Datum:** 2026-02-18
**Autor:** 🏗️ Architect Agent (Sprint 5)
**Sprint:** Sprint 5 – Agent Evolution & Premium Polish
**Branch:** `sprint5/arch-workflow-engine`

---

## Implementation Status

**Core Engine (Done):**
- `workflowTypes.ts` — Full type hierarchy, state machine types, streaming events, type guards
- `workflow.ts` — WorkflowEngine class with planning, execution, reflection, final answer
- `useWorkflowChat.ts` — Frontend hook with NDJSON parsing, state management, cancel
- `POST /api/chat/agent/workflow` — Streaming NDJSON endpoint
- `WorkflowProgress` UI component — Step visualization
- Chat page integration — Workflow mode toggle, agent/workflow switching

**Persistence & Resume (Added):**
- `workflowPersistence.ts` — IndexedDB client-side persistence (active workflow snapshots)
- `workflowStore.ts` — Filesystem server-side persistence (~/.locai/workflows/)
- `GET/POST /api/workflows` + `GET/DELETE /api/workflows/[id]` — Workflow CRUD
- `DELETE /api/chat/agent/workflow/[workflowId]` — REST cancel endpoint
- Per-step timeout (30s) with cascading AbortController
- State snapshot emission after each step
- Auto-save to IndexedDB on step_end/plan/state_snapshot events
- Resume dialog on chat page mount

---

## Kontext

Der bestehende Agent Loop in `src/lib/agents/executor.ts` implementiert ein einfaches Tool-Calling-Pattern:

```
User Message → LLM → Tool Calls → Execute → Feed Back → Repeat (max 8x)
```

Dieser Ansatz hat folgende Limitierungen:

1. **Keine Planung mit Struktur** – Die optionale Planning-Step gibt einen Text-Plan aus, aber die Execution verfolgt ihn nicht strukturiert
2. **Keine Reflection** – Nach Tool-Ausführung bewertet der Agent sein Ergebnis nicht explizit
3. **Keine Anpassung des Plans** – Wenn Schritt 2 fehlschlägt, kann der Agent nicht systematisch reagieren
4. **Keine Persistenz** – Ein Browser-Refresh verliert den gesamten Agent-State
5. **Keine Workflow-Visualisierung möglich** – Kein strukturierter State für das UI
6. **Linearer Loop** – Keine Unterscheidung zwischen Plan→Execute→Reflect-Phasen

---

## Entscheidung

Wir erweitern die bestehende Agent-Infrastruktur um eine **Workflow Engine** mit expliziter State Machine. Die Engine ist ein Layer **über** dem bestehenden `executeAgentLoop()` und ersetzt ihn nicht.

---

## Architektur

### State Machine

```
┌─────────┐   start    ┌──────────┐  plan ready  ┌───────────┐
│  idle   │──────────>│ planning │─────────────>│ executing │
└─────────┘           └──────────┘              └─────┬─────┘
                                                      │
                                              step done│
                                                      ▼
                                              ┌────────────┐
                                              │ reflecting │
                                              └─────┬──────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                          continue             adjust plan             done
                              │                     │                     │
                              ▼                     ▼                     ▼
                        ┌───────────┐        ┌──────────┐         ┌──────┐
                        │ executing │        │ planning │         │ done │
                        └───────────┘        └──────────┘         └──────┘
                                                                       │
                                                      ┌────────────────┘
                                                      │ (oder jederzeit)
                                                      ▼
                                                ┌──────────┐
                                                │cancelled │
                                                └──────────┘
                                                      │
                                              ┌───────┴──────┐
                                              │    error     │
                                              └──────────────┘
```

**State-Übergänge:**

| Von | Event | Nach |
|-----|-------|------|
| `idle` | `start(message)` | `planning` |
| `planning` | `plan_ready(plan)` | `executing` |
| `planning` | `plan_failed` | `executing` (ohne Plan) |
| `executing` | `step_complete(result)` | `reflecting` |
| `executing` | `max_steps_reached` | `done` |
| `executing` | `tool_error(err)` | `reflecting` |
| `reflecting` | `continue` | `executing` |
| `reflecting` | `adjust_plan(newPlan)` | `planning` |
| `reflecting` | `complete(answer)` | `done` |
| `*` | `cancel()` | `cancelled` |
| `*` | `fatal_error(err)` | `error` |

### Workflow Engine Layer

```
src/lib/agents/
├── executor.ts          # Bestehend – bleibt unverändert
├── types.ts             # Bestehend – wird erweitert
├── registry.ts          # Bestehend – unverändert
├── workflow.ts          # NEU: WorkflowEngine Klasse
├── workflowStore.ts     # NEU: Persistenz (IndexedDB / Filesystem)
└── workflowPlanner.ts   # NEU: Strukturierter Planner
```

### WorkflowEngine (`workflow.ts`)

```typescript
class WorkflowEngine {
  // State Machine
  private state: WorkflowState = { status: 'idle', ... }
  
  // Core Methods
  async start(message: string, options: WorkflowOptions): AsyncGenerator<WorkflowEvent>
  async cancel(): Promise<void>
  
  // State Queries
  getState(): WorkflowState
  getHistory(): WorkflowStep[]
  
  // Private State Machine
  private transition(event: WorkflowTransitionEvent): void
  private async executePlanningPhase(): Promise<WorkflowPlan>
  private async executeStep(step: WorkflowStep): Promise<StepResult>
  private async executeReflectionPhase(step: WorkflowStep, result: StepResult): Promise<ReflectionResult>
}
```

### Structured Planning

Der Planner fordert den LLM auf, einen **maschinenlesbaren Plan** zu erstellen:

**Prompt-Format:**
```
Erstelle einen strukturierten Plan als JSON mit dieser Struktur:
{
  "goal": "Was soll erreicht werden",
  "steps": [
    {
      "id": "step-1",
      "description": "Was in diesem Schritt getan wird",
      "expectedTools": ["web_search"],
      "dependsOn": [],
      "successCriteria": "Woran erkenne ich dass dieser Schritt erfolgreich war"
    }
  ],
  "maxSteps": 5
}
```

**Fallback:** Wenn das JSON-Parsing fehlschlägt → Text-Plan (wie bisher).

### Reflection Phase

Nach jedem Schritt bewertet der Agent explizit:

**Prompt-Format:**
```
Du hast gerade Schritt {n} ausgeführt: {description}
Ergebnis der Tools: {toolResults}

Bewerte:
1. War der Schritt erfolgreich? (ja/nein/teilweise)
2. Soll der Plan angepasst werden? Falls ja: wie?
3. Kannst du das Ziel jetzt beantworten? Falls ja: antworte direkt.
4. Was ist der nächste Schritt?

Antworte als JSON: { "success": boolean, "adjustPlan": string|null, "finalAnswer": string|null, "nextStep": string|null }
```

### Wie der Agent seinen Plan anpassen kann

Der Agent kann den Plan in der **Reflection Phase** in drei Wegen anpassen:

1. **Plan-Adjustment:** Der Agent erkennt in `reflecting`, dass ein Schritt nicht zum Ziel geführt hat und schlägt alternative Schritte vor → zurück zu `planning` mit dem neuen Plan als Input
2. **Early Exit:** Der Agent erkennt, dass das Ziel bereits erreicht ist und gibt die Antwort sofort ab → `done`
3. **Tool-Switch:** Statt des geplanten Tools (z.B. `web_search`) wählt der Agent in der nächsten Iteration ein anderes Tool (z.B. `search_documents`) → der bestehende Executor handelt das automatisch

**Max Re-Plans:** 2 pro Workflow (verhindert endlose Schleifen)

---

## Workflow-Persistenz

### Entscheidung: IndexedDB im Browser (Client-Side) + Filesystem (Server-Side)

**Optionen bewertet:**

| Option | Pro | Contra |
|--------|-----|--------|
| **Kein Persist** | Einfach, kein Overhead | Refresh verliert alles |
| **SessionStorage** | Einfach | Verloren bei Tab-Close |
| **IndexedDB** | Browser-nativ, robust | Nur Browser-seitig |
| **~/.locai/workflows/** | Server-persistent | API-Roundtrip nötig |
| **Hybrid** (IndexedDB + Server) | Best of both | Komplexer |

**Gewählte Lösung: Hybrid-Ansatz**

1. **IndexedDB (Client):** Aktiver Workflow-State wird kontinuierlich in IndexedDB gesichert (alle 500ms oder nach jedem Step). Key: `workflow:{conversationId}:{workflowId}`
2. **Filesystem (Server):** Abgeschlossene Workflows werden in `~/.locai/workflows/` gespeichert. Endpoint: `POST /api/agents/workflows/{id}/save`
3. **Resume nach Refresh:** Beim Laden der Chat-Seite wird IndexedDB geprüft. Falls ein aktiver Workflow für die Conversation-ID vorhanden ist → Resume-Dialog anzeigen

**Resume-Flow:**
```
Page Load → Check IndexedDB → Found active workflow?
  → Yes: "Workflow fortsetzen?" Dialog
    → User: Ja → WorkflowEngine.resume(savedState)
    → User: Nein → State löschen, neu starten
  → No: Normaler Start
```

**Persistence-Scope:** Nur Workflows mit `status !== 'idle'` werden persistiert.

---

## API-Contract für Workflow-Streaming

### Endpoint

**Bestehend:** `POST /api/chat/agent` (bleibt kompatibel)  
**Neu:** `POST /api/chat/agent/workflow` (erweiterter Endpoint für Workflow-Mode)

### Request Body

```typescript
interface WorkflowRequest {
  message: string;
  model: string;
  conversationId?: string;
  workflowId?: string;        // Für Resume: existierender Workflow
  enabledTools?: string[];
  maxSteps?: number;          // Default: 8
  timeoutMs?: number;         // Default: 120_000 (2 min)
  enablePlanning?: boolean;   // Default: true für Workflow-Mode
  enableReflection?: boolean; // Default: true für Workflow-Mode
  host?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}
```

### Response: NDJSON Stream

Jede Zeile ist ein JSON-Event (Newline-Delimited JSON):

```typescript
// Workflow gestartet
{ "type": "workflow_start", "workflowId": "wf_abc123", "timestamp": "..." }

// Plan erstellt
{ "type": "plan", "plan": { "goal": "...", "steps": [...], "maxSteps": 5 } }

// Schritt startet
{ "type": "step_start", "stepId": "step-1", "stepIndex": 0, "totalSteps": 5, "description": "..." }

// Tool wird aufgerufen
{ "type": "tool_call", "turn": 0, "stepId": "step-1", "call": { "id": "tc_...", "name": "web_search", "arguments": {...} } }

// Tool-Ergebnis
{ "type": "tool_result", "turn": 0, "stepId": "step-1", "result": { "callId": "tc_...", "content": "...", "success": true } }

// Schritt abgeschlossen
{ "type": "step_end", "stepId": "step-1", "stepIndex": 0, "success": true, "durationMs": 1234 }

// Reflection
{ "type": "reflection", "stepId": "step-1", "assessment": "success", "nextAction": "continue" }

// Plan-Anpassung
{ "type": "plan_adjustment", "reason": "...", "newPlan": { ... } }

// Abschlussnachricht (streaming)
{ "type": "message", "content": "Hier ist...", "done": false }
{ "type": "message", "content": " die Antwort.", "done": true }

// Workflow abgeschlossen
{ "type": "workflow_end", "workflowId": "wf_abc123", "status": "done", "totalSteps": 3, "durationMs": 8500 }

// Fehler
{ "type": "error", "message": "...", "recoverable": false }

// Abgebrochen
{ "type": "cancelled", "workflowId": "wf_abc123" }
```

**Rückwärtskompatibilität:** Der bestehende Endpoint `POST /api/chat/agent` bleibt unverändert und sendet weiterhin die alten Event-Types (`turn_start`, `turn_end`, `tool_call`, `tool_result`, `plan`, `message`, `error`).

---

## Limits & Safeguards

### Maximale Iterationen

```typescript
const WORKFLOW_DEFAULTS = {
  maxSteps: 8,           // Pro Workflow (überschreibt executor.ts maxIterations)
  maxReflections: 8,     // Max Reflection-LLM-Calls
  maxRePlans: 2,         // Max Plan-Anpassungen pro Workflow
  maxToolCallsPerStep: 5, // Max Tool-Calls in einem Schritt
  timeoutMs: 120_000,    // 2 Minuten Gesamttimeout
  stepTimeoutMs: 30_000, // 30s pro Schritt
}
```

### Timeout-Handling

```
Workflow-Start → AbortController erstellt
  → Global Timeout: setTimeout(120s) → abort()
  → Step Timeout: Per-Step AbortController mit 30s
  → User Cancel: controller.abort() → type: 'cancelled' Event
```

**Cascade bei Timeout:**
1. Laufender Tool-Call wird abgebrochen
2. Reflection-Phase wird übersprungen  
3. Bisher gesammelte Ergebnisse werden zusammengefasst
4. `workflow_end` mit `status: "timeout"` wird gesendet

### Cancellation

```typescript
// Frontend
DELETE /api/chat/agent/workflow/{workflowId}

// Oder via AbortController im useAgentChat Hook
cancelWorkflow()  // → controller.abort()
```

---

## Migration von bestehender Agent-Infrastruktur

**Bestehende Flows bleiben funktional.** Die WorkflowEngine ist opt-in:

```typescript
// Alt (bleibt funktional):
POST /api/chat/agent  →  executeAgentLoop()

// Neu (Workflow-Mode):
POST /api/chat/agent/workflow  →  WorkflowEngine.start()
  → intern: WorkflowEngine ruft executeAgentLoop() Step für Step auf
```

**UI-Toggle:** Ein neuer `workflowMode` Boolean im `useAgentChat` Hook aktiviert den neuen Endpoint.

---

## Frontend-Integration

### useAgentChat Hook Erweiterungen

```typescript
// Neue State-Felder
workflowState: WorkflowStatus         // idle|planning|executing|reflecting|done|cancelled|error
workflowPlan: WorkflowPlan | null     // Strukturierter Plan
workflowSteps: WorkflowStep[]         // Ausgeführte Schritte mit Status
currentStep: WorkflowStep | null      // Aktiver Schritt
workflowMode: boolean                 // Toggle: einfacher Loop vs. Workflow Engine

// Neue Actions
enableWorkflowMode(): void
cancelWorkflow(): void
resumeWorkflow(workflowId: string): void
```

---

## Risiken & Mitigations

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| LLM gibt kein valides JSON für Plan/Reflection | Mittel | Mittel | Fallback auf Text-Parsing |
| Reflection erhöht Latenz stark | Hoch | Mittel | Reflection optional (Flag) |
| IndexedDB API nicht verfügbar | Niedrig | Niedrig | Graceful Degradation (kein Persist) |
| Endlose Re-Plan-Loops | Niedrig | Hoch | `maxRePlans: 2` Limit |
| Reflection-LLM-Call schlägt fehl | Mittel | Niedrig | Skip Reflection, weiter mit nächstem Step |

---

## Implementierungs-Reihenfolge (für Coder Agent)

1. **Schritt 1:** `workflow-types.ts` → TypeScript Interfaces implementieren
2. **Schritt 2:** `workflowPlanner.ts` → Structured Planner mit JSON-Fallback
3. **Schritt 3:** `workflow.ts` → WorkflowEngine State Machine (ohne Persistenz)
4. **Schritt 4:** `app/api/chat/agent/workflow/route.ts` → Neuer API-Endpoint
5. **Schritt 5:** `useAgentChat.ts` → Hook-Erweiterungen für neuen Endpoint
6. **Schritt 6:** `workflowStore.ts` → IndexedDB Persistenz (kann auch nach Step 5 kommen)
7. **Schritt 7:** UI-Components für Workflow-Visualisierung (UI/UX Agent)

---

## Alternativen Abgewogen

### Alt 1: Direktes Upgrade von executeAgentLoop()
**Abgelehnt.** Würde bestehende Funktionalität gefährden und ist schwerer zu testen. Die Layer-Trennung ist sauberer.

### Alt 2: LangChain.js / LangGraph
**Abgelehnt.** Externe Abhängigkeit, nicht Ollama-optimiert, zu schwer für das Projekt.

### Alt 3: Nur Text-basierter Plan (status quo verbessert)
**Abgelehnt.** Zu wenig strukturell – das UI kann keinen Text-Plan visualisieren.

---

## Referenzen

- `src/lib/agents/executor.ts` – Bestehender Agent Loop
- `src/lib/agents/types.ts` – Bestehende Types
- `src/hooks/useAgentChat.ts` – Frontend Hook
- `docs/adr/workflow-types.ts` – TypeScript Interfaces (dieses Sprint)
- Sprint 5 Backlog: `sprints/sprint-5-agent-evolution.md` → ARCH-1, FEAT-1, UI-1
