export interface AceStepConfig {
  baseUrl: string;
  timeout?: number;
}

export type TaskType = "text2music" | "remix" | "repaint" | "caption" | "description";
export type TaskStatus = "queued" | "processing" | "success" | "failed";

export interface GenerateOptions {
  taskType: TaskType;
  caption?: string;
  lyrics?: string;
  description?: string;
  duration?: number;
  bpm?: number;
  batch?: number;
  srcAudioPath?: string;
  instrumental?: boolean;
  thinking?: boolean;
  strength?: number;
  repaintStart?: number;
  repaintEnd?: number;
  seed?: number;
  numSteps?: number;
  cfgScale?: number;
}

export interface TaskInfo {
  taskId: string;
  status: TaskStatus;
  queuePosition?: number;
}

export interface TaskResult {
  status: TaskStatus;
  audioPath?: string;
  audioUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationResult {
  taskId: string;
  audios: { url: string; path: string }[];
  metadata?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
}

export interface ApiResponse<T> {
  data: T;
  code: number;
  error: string | null;
  timestamp: number;
}

export interface RawTaskResult {
  status: 0 | 1 | 2;
  audio_path?: string;
  [key: string]: unknown;
}

/** Shape returned by /query_result for each task_id */
export interface RawQueryResultItem {
  task_id: string;
  status: 0 | 1;
  result: string; // JSON-encoded array of RawAudioItem
}

/** Individual audio entry inside a query_result item's `result` JSON */
export interface RawAudioItem {
  file: string;
  url: string;
  status: number;
  create_time: number;
  seed?: number;
  caption?: string;
  lyrics?: string;
  bpm?: number;
  duration?: number;
  keyscale?: string;
  timesignature?: string;
  vocal_language?: string;
}
