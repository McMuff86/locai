// ============================================================================
// Workflow Engine – TypeScript Interfaces
// ============================================================================
// Definiert alle Types für die Multi-Step Agent Workflow Engine (Sprint 5).
// Referenz: docs/adr/ADR-001-workflow-engine.md
//
// HINWEIS: Diese Datei ist ein ADR-Artefakt (Spec, noch nicht implementiert).
// Der Coder Agent implementiert diese Types in:
//   src/lib/agents/workflow.ts
//   src/lib/agents/types.ts (erweitern)
// ============================================================================

// ---------------------------------------------------------------------------
// Workflow Status (State Machine)
// ---------------------------------------------------------------------------

/**
 * Status-Werte der Workflow State Machine.
 * Transition-Graph siehe ADR-001-workflow-engine.md
 */
export type WorkflowStatus =
  | 'idle'        // Noch nicht gestartet
  | 'planning'    // Agent erstellt strukturierten Plan
  | 'executing'   // Agent führt aktuellen Step aus (Tool-Calls)
  | 'reflecting'  // Agent bewertet Step-Ergebnis
  | 'done'        // Erfolgreich abgeschlossen
  | 'cancelled'   // Vom User abgebrochen
  | 'error'       // Fataler Fehler
  | 'timeout';    // Timeout überschritten

// ---------------------------------------------------------------------------
// Workflow Plan
// ---------------------------------------------------------------------------

/**
 * Ein einzelner geplanter Schritt im Workflow.
 * Wird vom LLM als JSON im Planning-Phase generiert.
 */
export interface WorkflowPlanStep {
  /** Eindeutige ID innerhalb des Plans (z.B. "step-1") */
  id: string;
  /** Menschenlesbare Beschreibung des Schritts */
  description: string;
  /** Welche Tools der Agent für diesen Schritt verwenden möchte */
  expectedTools: string[];
  /** IDs von Steps, die zuerst abgeschlossen sein müssen */
  dependsOn: string[];
  /** Kriterium für Erfolg dieses Schritts */
  successCriteria: string;
}

/**
 * Strukturierter Plan des Agents.
 * Wird in der Planning-Phase erstellt und kann in der Reflection-Phase
 * angepasst werden.
 */
export interface WorkflowPlan {
  /** Das übergeordnete Ziel des Workflows */
  goal: string;
  /** Geordnete Liste der Schritte */
  steps: WorkflowPlanStep[];
  /** Maximale Schrittzahl (kann vom Agent gesetzt werden) */
  maxSteps: number;
  /** Timestamp der Planerstellung */
  createdAt: string;
  /** Version des Plans (erhöht sich bei Re-Planung) */
  version: number;
}

// ---------------------------------------------------------------------------
// Workflow Steps (Execution Tracking)
// ---------------------------------------------------------------------------

/** Status eines ausgeführten Workflow-Schritts */
export type WorkflowStepStatus =
  | 'pending'    // Noch nicht begonnen
  | 'running'    // Wird aktuell ausgeführt
  | 'success'    // Erfolgreich abgeschlossen
  | 'failed'     // Fehlgeschlagen (aber Workflow läuft weiter)
  | 'skipped';   // Übersprungen (z.B. nach Plan-Anpassung)

/**
 * Ein tatsächlich ausgeführter Schritt im Workflow.
 * Enthält die vollständige Ausführungshistorie.
 */
export interface WorkflowStep {
  /** ID aus dem WorkflowPlan (oder "unplanned-{n}" für Ad-hoc-Steps) */
  planStepId: string;
  /** Null-basierter Index in der Ausführungsreihenfolge */
  executionIndex: number;
  /** Beschreibung des Schritts */
  description: string;
  /** Status der Ausführung */
  status: WorkflowStepStatus;
  /** Alle Tool-Calls in diesem Schritt */
  toolCalls: import('./workflow-types').WorkflowToolCall[];
  /** Alle Tool-Ergebnisse in diesem Schritt */
  toolResults: import('./workflow-types').WorkflowToolResult[];
  /** Reflection-Ergebnis (wenn vorhanden) */
  reflection?: WorkflowStepReflection;
  /** Startzeitpunkt */
  startedAt: string;
  /** Endzeitpunkt (wenn abgeschlossen) */
  completedAt?: string;
  /** Fehlermeldung (wenn status === 'failed') */
  error?: string;
  /** Dauer in Millisekunden */
  durationMs?: number;
}

/**
 * Tool-Call innerhalb eines Workflow-Steps.
 * Erweitert den bestehenden ToolCall aus types.ts.
 */
export interface WorkflowToolCall {
  /** Eindeutige Call-ID (tc_{timestamp}_{counter}) */
  id: string;
  /** Tool-Name */
  name: string;
  /** Argumente */
  arguments: Record<string, unknown>;
  /** Zum welchen Plan-Step gehört dieser Call */
  stepId: string;
  /** Ausführungsreihenfolge innerhalb des Steps */
  callIndex: number;
  /** Startzeitpunkt des Calls */
  startedAt: string;
  /** Endzeitpunkt des Calls */
  completedAt?: string;
}

/**
 * Ergebnis eines Tool-Calls im Workflow.
 */
export interface WorkflowToolResult {
  /** Korrespondiert mit WorkflowToolCall.id */
  callId: string;
  /** Ergebnisinhalt (für LLM) */
  content: string;
  /** Fehlermeldung (wenn nicht erfolgreich) */
  error?: string;
  /** Ob der Call erfolgreich war */
  success: boolean;
  /** Dauer des Tool-Calls in ms */
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------

/**
 * Ergebnis der Reflection-Phase nach einem Step.
 * Wird vom LLM als JSON generiert.
 */
export interface WorkflowStepReflection {
  /** Bewertung des Schritt-Ergebnisses */
  assessment: 'success' | 'partial' | 'failure';
  /** Nächste Aktion basierend auf Reflection */
  nextAction: 'continue' | 'adjust_plan' | 'complete' | 'abort';
  /** Wenn nextAction === 'adjust_plan': Begründung und neuer Plan */
  planAdjustment?: {
    reason: string;
    newGoal?: string;
    newSteps?: WorkflowPlanStep[];
  };
  /** Wenn nextAction === 'complete': Die finale Antwort */
  finalAnswer?: string;
  /** Wenn nextAction === 'abort': Warum der Workflow abgebrochen wird */
  abortReason?: string;
  /** Kommentar des Agents zur Reflection */
  comment?: string;
}

// ---------------------------------------------------------------------------
// Workflow State (vollständiger Snapshot)
// ---------------------------------------------------------------------------

/**
 * Vollständiger State des Workflows.
 * Wird für Persistenz (IndexedDB/Filesystem) verwendet.
 */
export interface WorkflowState {
  /** Eindeutige Workflow-ID (wf_{nanoid}) */
  id: string;
  /** Zugehörige Conversation-ID */
  conversationId?: string;
  /** Aktueller Status der State Machine */
  status: WorkflowStatus;
  /** Die ursprüngliche User-Message */
  userMessage: string;
  /** Der aktuelle Plan (null wenn noch nicht geplant) */
  plan: WorkflowPlan | null;
  /** Alle bisher ausgeführten Steps */
  steps: WorkflowStep[];
  /** Aktuell ausgeführter Step (Index) */
  currentStepIndex: number;
  /** Anzahl der Plan-Anpassungen (für maxRePlans Guard) */
  replanCount: number;
  /** Finale Antwort (wenn status === 'done') */
  finalAnswer?: string;
  /** Fehlermeldung (wenn status === 'error') */
  errorMessage?: string;
  /** Konfiguration des Workflows */
  config: WorkflowConfig;
  /** Startzeitpunkt */
  startedAt: string;
  /** Endzeitpunkt (wenn abgeschlossen) */
  completedAt?: string;
  /** Gesamtdauer in ms */
  durationMs?: number;
}

/**
 * Konfiguration eines Workflow-Runs.
 */
export interface WorkflowConfig {
  /** Ollama-Modell */
  model: string;
  /** Erlaubte Tools */
  enabledTools: string[];
  /** Maximale Schrittzahl */
  maxSteps: number;
  /** Maximale Plan-Anpassungen */
  maxRePlans: number;
  /** Gesamttimeout in ms */
  timeoutMs: number;
  /** Timeout pro Step in ms */
  stepTimeoutMs: number;
  /** Ollama Host */
  host?: string;
  /** Reflection aktiviert? */
  enableReflection: boolean;
  /** Planning aktiviert? */
  enablePlanning: boolean;
}

// ---------------------------------------------------------------------------
// Streaming Event Types
// ---------------------------------------------------------------------------

/**
 * Alle Event-Types die vom /api/chat/agent/workflow Endpoint gestreamt werden.
 * Format: NDJSON (Newline-Delimited JSON)
 */

/** Workflow wurde gestartet */
export interface WorkflowStartEvent {
  type: 'workflow_start';
  workflowId: string;
  timestamp: string;
  config: Pick<WorkflowConfig, 'maxSteps' | 'enabledTools'>;
}

/** Plan erstellt/angepasst */
export interface WorkflowPlanEvent {
  type: 'plan';
  plan: WorkflowPlan;
  isAdjustment: boolean;  // true wenn Re-Plan
  adjustmentReason?: string;
}

/** Schritt startet */
export interface WorkflowStepStartEvent {
  type: 'step_start';
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  description: string;
  expectedTools: string[];
}

/** Tool wird aufgerufen */
export interface WorkflowToolCallEvent {
  type: 'tool_call';
  stepId: string;
  turn: number;
  call: WorkflowToolCall;
}

/** Tool-Ergebnis */
export interface WorkflowToolResultEvent {
  type: 'tool_result';
  stepId: string;
  turn: number;
  result: WorkflowToolResult;
}

/** Schritt abgeschlossen */
export interface WorkflowStepEndEvent {
  type: 'step_end';
  stepId: string;
  stepIndex: number;
  status: WorkflowStepStatus;
  durationMs: number;
}

/** Reflection abgeschlossen */
export interface WorkflowReflectionEvent {
  type: 'reflection';
  stepId: string;
  assessment: WorkflowStepReflection['assessment'];
  nextAction: WorkflowStepReflection['nextAction'];
  comment?: string;
}

/** Streaming-Nachricht (finale Antwort) */
export interface WorkflowMessageEvent {
  type: 'message';
  content: string;
  done: boolean;
}

/** Workflow abgeschlossen */
export interface WorkflowEndEvent {
  type: 'workflow_end';
  workflowId: string;
  status: WorkflowStatus;
  totalSteps: number;
  durationMs: number;
  summary?: string;
}

/** Fehler */
export interface WorkflowErrorEvent {
  type: 'error';
  message: string;
  recoverable: boolean;
  stepId?: string;
}

/** Abgebrochen */
export interface WorkflowCancelledEvent {
  type: 'cancelled';
  workflowId: string;
  completedSteps: number;
}

/** State-Snapshot für Persistenz (wird an Client gesendet) */
export interface WorkflowStateSnapshotEvent {
  type: 'state_snapshot';
  state: WorkflowState;
}

/** Union Type aller Workflow-Events */
export type WorkflowStreamEvent =
  | WorkflowStartEvent
  | WorkflowPlanEvent
  | WorkflowStepStartEvent
  | WorkflowToolCallEvent
  | WorkflowToolResultEvent
  | WorkflowStepEndEvent
  | WorkflowReflectionEvent
  | WorkflowMessageEvent
  | WorkflowEndEvent
  | WorkflowErrorEvent
  | WorkflowCancelledEvent
  | WorkflowStateSnapshotEvent;

// ---------------------------------------------------------------------------
// API Request / Response Types
// ---------------------------------------------------------------------------

/**
 * Request Body für POST /api/chat/agent/workflow
 */
export interface WorkflowApiRequest {
  /** User-Nachricht */
  message: string;
  /** Ollama-Modell */
  model: string;
  /** Conversation-ID (optional, für Persistenz) */
  conversationId?: string;
  /** Workflow-ID (für Resume) */
  workflowId?: string;
  /** Erlaubte Tools */
  enabledTools?: string[];
  /** Max Schritte (default: 8) */
  maxSteps?: number;
  /** Gesamttimeout in ms (default: 120_000) */
  timeoutMs?: number;
  /** Planning aktivieren (default: true) */
  enablePlanning?: boolean;
  /** Reflection aktivieren (default: true) */
  enableReflection?: boolean;
  /** Ollama Host */
  host?: string;
  /** Konversationshistorie */
  conversationHistory?: Array<{ role: string; content: string }>;
  /** Preset-ID */
  presetId?: string;
}

/**
 * Response: NDJSON-Stream mit WorkflowStreamEvent[]
 * Content-Type: application/x-ndjson
 * Jede Zeile ist ein JSON-serialisiertes WorkflowStreamEvent
 */
export type WorkflowApiResponse = ReadableStream<WorkflowStreamEvent>;

/**
 * Request für DELETE /api/chat/agent/workflow/{id}
 * (Cancel-Endpoint)
 */
export interface WorkflowCancelRequest {
  workflowId: string;
}

/**
 * Response für DELETE /api/chat/agent/workflow/{id}
 */
export interface WorkflowCancelResponse {
  success: boolean;
  workflowId: string;
}

/**
 * Persistierter Workflow (GET /api/chat/agent/workflow/{id})
 */
export interface WorkflowGetResponse {
  workflow: WorkflowState;
}

// ---------------------------------------------------------------------------
// IndexedDB Persistenz Schema
// ---------------------------------------------------------------------------

/**
 * Schema für IndexedDB Workflow-Store.
 * DB Name: 'locai-workflows', Store: 'workflows', Version: 1
 */
export interface WorkflowIndexedDBRecord {
  /** Primary Key: workflowId */
  id: string;
  /** Conversation-ID (für Index) */
  conversationId?: string;
  /** Status (für Index: schnell nach aktiven suchen) */
  status: WorkflowStatus;
  /** Vollständiger State */
  state: WorkflowState;
  /** Zuletzt aktualisiert (für Index: Cleanup alter Records) */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Workflow Defaults
// ---------------------------------------------------------------------------

/**
 * Standard-Konfiguration für neue Workflows.
 */
export const WORKFLOW_DEFAULTS: Omit<WorkflowConfig, 'model' | 'enabledTools' | 'host'> = {
  maxSteps: 8,
  maxRePlans: 2,
  timeoutMs: 120_000,        // 2 Minuten
  stepTimeoutMs: 30_000,     // 30 Sekunden pro Step
  enableReflection: true,
  enablePlanning: true,
} as const;

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

export function isWorkflowStartEvent(e: WorkflowStreamEvent): e is WorkflowStartEvent {
  return e.type === 'workflow_start';
}

export function isWorkflowPlanEvent(e: WorkflowStreamEvent): e is WorkflowPlanEvent {
  return e.type === 'plan';
}

export function isWorkflowStepStartEvent(e: WorkflowStreamEvent): e is WorkflowStepStartEvent {
  return e.type === 'step_start';
}

export function isWorkflowStepEndEvent(e: WorkflowStreamEvent): e is WorkflowStepEndEvent {
  return e.type === 'step_end';
}

export function isWorkflowMessageEvent(e: WorkflowStreamEvent): e is WorkflowMessageEvent {
  return e.type === 'message';
}

export function isWorkflowEndEvent(e: WorkflowStreamEvent): e is WorkflowEndEvent {
  return e.type === 'workflow_end';
}

export function isWorkflowErrorEvent(e: WorkflowStreamEvent): e is WorkflowErrorEvent {
  return e.type === 'error';
}

export function isWorkflowReflectionEvent(e: WorkflowStreamEvent): e is WorkflowReflectionEvent {
  return e.type === 'reflection';
}
