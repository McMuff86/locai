# Workflow Engine – Integration Test Szenario

> **Zweck:** Beschreibt ein vollständiges End-to-End Szenario für die WorkflowEngine.
> Kann als Basis für zukünftige E2E Tests oder manuelle QA dienen.
>
> **Status:** Dokumentiert – Unit Tests sind in `workflow.test.ts` implementiert.
> Dieses File beschreibt, wie ein echter E2E Test aussehen würde.

---

## Szenario: "Analysiere eine Python-Datei und erstelle eine Zusammenfassung"

### User Story
Ein User gibt folgende Aufgabe: *"Lies die Datei `analysis.py`, analysiere den Code und speichere eine Zusammenfassung als `summary.md`."*

### Erwarteter Ablauf

```
User: "Lies die Datei analysis.py, analysiere den Code und speichere eine Zusammenfassung als summary.md"
           │
           ▼
┌─────────────────────────────────────────────┐
│  Phase 1: PLANNING                          │
│  LLM erstellt strukturierten JSON-Plan      │
│  ──────────────────────────────────────     │
│  {                                          │
│    "goal": "Code analysieren + Doku",       │
│    "steps": [                               │
│      { "id": "step-1",                      │
│        "description": "Datei lesen",        │
│        "expectedTools": ["read_file"] },    │
│      { "id": "step-2",                      │
│        "description": "Code analysieren",   │
│        "expectedTools": [] },               │
│      { "id": "step-3",                      │
│        "description": "Doku schreiben",     │
│        "expectedTools": ["write_file"] }    │
│    ],                                       │
│    "maxSteps": 3                            │
│  }                                          │
└─────────────────────────────────────────────┘
           │
           ▼ EVENT: plan
┌─────────────────────────────────────────────┐
│  Phase 2: EXECUTING – Step 1               │
│  executeAgentLoop() → read_file("analysis.py")
│  Ergebnis: "def fibonacci(n): ..."         │
│                                             │
│  EVENT: step_start (stepId: "step-1")      │
│  EVENT: tool_call  (name: "read_file")     │
│  EVENT: tool_result (success: true)        │
│  EVENT: step_end (status: "success")       │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Phase 3: REFLECTING – Step 1               │
│  LLM bewertet: {"assessment": "success",   │
│                 "nextAction": "continue"}   │
│                                             │
│  EVENT: reflection (assessment: "success") │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Phase 2: EXECUTING – Step 2               │
│  executeAgentLoop() → keine Tools           │
│  LLM analysiert Code intern                 │
│                                             │
│  EVENT: step_start (stepId: "step-2")      │
│  EVENT: step_end (status: "success")       │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Phase 3: REFLECTING – Step 2               │
│  LLM: {"assessment": "success",            │
│         "nextAction": "continue"}           │
│                                             │
│  EVENT: reflection (assessment: "success") │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Phase 2: EXECUTING – Step 3               │
│  executeAgentLoop() → write_file("summary.md", "...")
│  Ergebnis: "File written successfully"     │
│                                             │
│  EVENT: step_start (stepId: "step-3")      │
│  EVENT: tool_call  (name: "write_file")    │
│  EVENT: tool_result (success: true)        │
│  EVENT: step_end (status: "success")       │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Phase 3: REFLECTING – Step 3 (letzter)    │
│  LLM erkennt: Alle Steps erledigt          │
│  {"assessment": "success",                  │
│   "nextAction": "complete",                 │
│   "finalAnswer": "Die Datei wurde..."       │
│                                             │
│  EVENT: reflection (nextAction: "complete")│
│  EVENT: message (done: true)               │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Phase 4: DONE                              │
│  STATUS: done                               │
│  finalAnswer gespeichert                    │
│                                             │
│  EVENT: workflow_end (status: "done")       │
└─────────────────────────────────────────────┘
```

---

## Vollständige Event-Sequenz

| # | Event Type | Key Data |
|---|-----------|----------|
| 1 | `workflow_start` | workflowId, config |
| 2 | `plan` | 3 Steps, isAdjustment: false |
| 3 | `step_start` | stepId: "step-1", description: "Datei lesen" |
| 4 | `tool_call` | name: "read_file", args: { path: "analysis.py" } |
| 5 | `tool_result` | success: true, content: "def fibonacci..." |
| 6 | `step_end` | status: "success", durationMs: ~800 |
| 7 | `reflection` | assessment: "success", nextAction: "continue" |
| 8 | `step_start` | stepId: "step-2", description: "Code analysieren" |
| 9 | `step_end` | status: "success" |
| 10 | `reflection` | assessment: "success", nextAction: "continue" |
| 11 | `step_start` | stepId: "step-3", description: "Doku schreiben" |
| 12 | `tool_call` | name: "write_file", args: { path: "summary.md", content: "..." } |
| 13 | `tool_result` | success: true |
| 14 | `step_end` | status: "success" |
| 15 | `reflection` | assessment: "success", nextAction: "complete", finalAnswer: "..." |
| 16 | `message` | content: "Die Analyse ist abgeschlossen...", done: true |
| 17 | `workflow_end` | status: "done", totalSteps: 3, durationMs: ~5000 |

---

## Benötigte Mocks für E2E Tests

### 1. Ollama API (`sendAgentChatMessage`)

```typescript
// Planning response
vi.mocked(sendAgentChatMessage).mockResolvedValueOnce({
  content: JSON.stringify({
    goal: "Python-Datei lesen, analysieren und dokumentieren",
    steps: [
      { id: "step-1", description: "Datei lesen", expectedTools: ["read_file"], dependsOn: [], successCriteria: "Inhalt verfügbar" },
      { id: "step-2", description: "Code analysieren", expectedTools: [], dependsOn: ["step-1"], successCriteria: "Analyse vollständig" },
      { id: "step-3", description: "Doku schreiben", expectedTools: ["write_file"], dependsOn: ["step-2"], successCriteria: "summary.md erstellt" },
    ],
    maxSteps: 3,
  }),
  tokenStats: null,
});

// Reflection after step-1
vi.mocked(sendAgentChatMessage).mockResolvedValueOnce({
  content: JSON.stringify({ assessment: "success", nextAction: "continue", comment: "Datei gelesen." }),
  tokenStats: null,
});

// Reflection after step-2
vi.mocked(sendAgentChatMessage).mockResolvedValueOnce({
  content: JSON.stringify({ assessment: "success", nextAction: "continue", comment: "Analyse fertig." }),
  tokenStats: null,
});

// Reflection after step-3 (early exit)
vi.mocked(sendAgentChatMessage).mockResolvedValueOnce({
  content: JSON.stringify({
    assessment: "success",
    nextAction: "complete",
    finalAnswer: "Die Python-Datei wurde analysiert und eine Zusammenfassung in summary.md gespeichert.",
  }),
  tokenStats: null,
});
```

### 2. Agent Executor (`executeAgentLoop`)

```typescript
// Step 1: read_file
vi.mocked(executeAgentLoop).mockImplementationOnce(async function*() {
  yield {
    index: 0,
    toolCalls: [{ id: "tc_001", name: "read_file", arguments: { path: "analysis.py" } }],
    toolResults: [{ callId: "tc_001", content: "def fibonacci(n):\n    ...", success: true }],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
});

// Step 2: no tools (analysis happens in LLM)
vi.mocked(executeAgentLoop).mockImplementationOnce(async function*() {
  yield {
    index: 0,
    toolCalls: [],
    toolResults: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    assistantMessage: "The code implements Fibonacci algorithm...",
  };
});

// Step 3: write_file
vi.mocked(executeAgentLoop).mockImplementationOnce(async function*() {
  yield {
    index: 0,
    toolCalls: [{ id: "tc_002", name: "write_file", arguments: { path: "summary.md", content: "# Analyse\n..." } }],
    toolResults: [{ callId: "tc_002", content: "File written successfully", success: true }],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
});
```

### 3. Filesystem (für echte Tool-Ausführung)

```typescript
// Temporäres Verzeichnis für den Test
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'locai-e2e-'));
await fs.writeFile(path.join(tmpDir, 'analysis.py'), 'def fibonacci(n):\n    ...');
process.env.LOCAI_DATA_PATH = tmpDir;

// Nach dem Test aufräumen
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```

---

## Assertions für den E2E Test

```typescript
// Alle Events werden emittiert
expect(events.map(e => e.type)).toEqual([
  'workflow_start', 'plan',
  'step_start', 'tool_call', 'tool_result', 'step_end', 'reflection',
  'step_start', 'step_end', 'reflection',
  'step_start', 'tool_call', 'tool_result', 'step_end', 'reflection',
  'message',
  'workflow_end',
]);

// Workflow ist erfolgreich
expect(lastEvent.status).toBe('done');

// Finale Antwort enthält die richtigen Infos
const msgEvent = events.find(e => e.type === 'message');
expect(msgEvent.content).toContain('zusammenfassung');
expect(msgEvent.done).toBe(true);

// summary.md wurde erstellt
const summaryContent = await fs.readFile(path.join(tmpDir, 'summary.md'), 'utf-8');
expect(summaryContent).toBeTruthy();
```

---

## Zusätzliche E2E Szenarien (für die Zukunft)

### Szenario 2: Plan-Adjustment
- Step schlägt fehl (Tool-Fehler)
- Reflection erkennt: `adjust_plan`
- Neuer Plan mit alternativen Steps
- Test: 2 `plan` Events (initial + adjusted)

### Szenario 3: Timeout
- Workflow mit sehr kurzem `timeoutMs`
- Fake timers (`vi.useFakeTimers()`)
- Test: `workflow_end.status === 'timeout'`

### Szenario 4: Cancellation
- User bricht nach Step 1 ab
- Test: `cancelled` event + `workflow_end.status === 'cancelled'`

### Szenario 5: LLM-Fehler Recovery
- Planning LLM gibt kein valides JSON → Fallback Plan
- Reflection wirft Exception → Workflow geht weiter
- Test: Workflow endet mit `done` trotz Fehler

---

## Implementierungs-Hinweise

### Testdatei Location
```
src/lib/agents/workflow.e2e.test.ts  (noch zu erstellen)
```

### Benötigte Imports
```typescript
import { WorkflowEngine } from './workflow';
import { ToolRegistry } from './registry';
import { registerBuiltinTools } from './tools';
import { executeAgentLoop } from './executor';
import { sendAgentChatMessage } from '@/lib/ollama';
```

### Vitest Config für E2E
- Separates Test-Target: `vitest.e2e.config.ts`
- Timeout erhöhen: `testTimeout: 30_000`
- Nicht im normalen `npm run test` (zu langsam)
- Separat: `npm run test:e2e`

---

> **Erstellt von:** 🧪 Test Agent (Sprint 5, 2026-02-18)
> **Referenz:** ADR-001-workflow-engine.md, workflow.ts, workflowTypes.ts
