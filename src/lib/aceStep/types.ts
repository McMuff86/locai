export interface AceStepConfig {
  baseUrl: string;
  timeout?: number;
}

export type TaskType = "caption" | "description";
export type TaskStatus = "queued" | "processing" | "success" | "failed";

export interface GenerateOptions {
  taskType: TaskType;
  caption?: string;
  lyrics?: string;
  description?: string;
  duration?: number;
  bpm?: number;
  batch?: number;
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
