import type {
  AceStepConfig,
  ApiResponse,
  GenerateOptions,
  GenerationResult,
  HealthStatus,
  ModelInfo,
  RawTaskResult,
  TaskInfo,
  TaskResult,
  TaskStatus,
} from "./types.js";
import { AceStepError, AceStepGenerationError, AceStepTimeoutError } from "./errors.js";

const DEFAULT_BASE_URL = "http://localhost:8001";
const DEFAULT_TIMEOUT = 300_000;

export class AceStepClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: Partial<AceStepConfig>) {
    this.baseUrl = (config?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
  }

  // ── helpers ──

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new AceStepError(`HTTP ${res.status}: ${res.statusText}`, res.status);
      }

      const json = (await res.json()) as ApiResponse<T>;

      if (json.error) {
        throw new AceStepError(json.error, json.code);
      }

      return json.data;
    } catch (err) {
      if (err instanceof AceStepError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new AceStepTimeoutError();
      }
      throw new AceStepError((err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private mapTaskStatus(raw: 0 | 1 | 2): TaskStatus {
    switch (raw) {
      case 0: return "processing";
      case 1: return "success";
      case 2: return "failed";
    }
  }

  // ── core ──

  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>("/health");
  }

  async models(): Promise<ModelInfo[]> {
    return this.request<ModelInfo[]>("/v1/models");
  }

  async stats(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/v1/stats");
  }

  // ── generation ──

  async generate(options: GenerateOptions): Promise<TaskInfo> {
    const body: Record<string, unknown> = {
      task_type: options.taskType,
    };
    if (options.caption !== undefined) body.caption = options.caption;
    if (options.lyrics !== undefined) body.lyrics = options.lyrics;
    if (options.description !== undefined) body.description = options.description;
    if (options.duration !== undefined) body.duration = options.duration;
    if (options.bpm !== undefined) body.bpm = options.bpm;
    if (options.batch !== undefined) body.batch = options.batch;

    const data = await this.post<{ task_id: string; status: string }>("/release_task", body);
    return {
      taskId: data.task_id,
      status: data.status as TaskStatus,
    };
  }

  async getStatus(taskId: string): Promise<TaskResult[]> {
    const items = await this.post<RawTaskResult[]>("/query_result", { task_id: taskId });
    return items.map((item) => {
      const { status, audio_path, ...rest } = item;
      const mapped: TaskResult = {
        status: this.mapTaskStatus(status),
        audioPath: audio_path,
        metadata: rest as Record<string, unknown>,
      };
      if (audio_path) {
        mapped.audioUrl = this.getAudioUrl(audio_path);
      }
      return mapped;
    });
  }

  getAudioUrl(audioPath: string): string {
    return `${this.baseUrl}/v1/audio?path=${encodeURIComponent(audioPath)}`;
  }

  async downloadAudio(audioPath: string): Promise<ArrayBuffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(this.getAudioUrl(audioPath), { signal: controller.signal });
      if (!res.ok) {
        throw new AceStepError(`Failed to download audio: HTTP ${res.status}`, res.status);
      }
      return await res.arrayBuffer();
    } catch (err) {
      if (err instanceof AceStepError) throw err;
      if ((err as Error).name === "AbortError") throw new AceStepTimeoutError();
      throw new AceStepError((err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── convenience ──

  async generateAndWait(
    options: GenerateOptions,
    opts?: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (status: TaskStatus) => void;
    },
  ): Promise<GenerationResult> {
    const pollInterval = opts?.pollInterval ?? 2000;
    const timeout = opts?.timeout ?? this.timeout;

    const task = await this.generate(options);
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const results = await this.getStatus(task.taskId);
      if (results.length === 0) {
        opts?.onProgress?.("processing");
        continue;
      }

      const anyProcessing = results.some((r) => r.status === "processing");
      const anyFailed = results.some((r) => r.status === "failed");
      const allDone = results.every((r) => r.status === "success" || r.status === "failed");

      if (anyProcessing) {
        opts?.onProgress?.("processing");
        continue;
      }

      if (allDone) {
        if (anyFailed && results.every((r) => r.status === "failed")) {
          throw new AceStepGenerationError("All generation tasks failed");
        }

        const audios = results
          .filter((r) => r.status === "success" && r.audioPath)
          .map((r) => ({
            url: this.getAudioUrl(r.audioPath!),
            path: r.audioPath!,
          }));

        opts?.onProgress?.("success");
        return { taskId: task.taskId, audios };
      }
    }

    throw new AceStepTimeoutError(`Generation timed out after ${timeout}ms`);
  }

  // ── random ──

  async generateRandom(): Promise<TaskInfo> {
    const data = await this.post<{ task_id: string; status: string }>("/create_random_sample", {});
    return {
      taskId: data.task_id,
      status: data.status as TaskStatus,
    };
  }
}
