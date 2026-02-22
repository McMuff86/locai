import type {
  QwenTTSConfig,
  Language,
  Speaker,
  ModelSize,
  VoiceCloneOptions,
  CustomVoiceOptions,
  VoiceDesignOptions,
  TTSResult,
  TranscribeResult,
  GradioFileRef,
} from "./types.js";
import {
  QwenTTSConnectionError,
  QwenTTSGenerationError,
} from "./errors.js";

const DEFAULT_CONFIG: QwenTTSConfig = {
  baseUrl: "http://127.0.0.1:7861",
  timeout: 120_000,
};

export const LANGUAGES: Language[] = [
  "German", "English", "French", "Spanish", "Italian",
  "Portuguese", "Russian", "Japanese", "Korean", "Chinese",
];

export const SPEAKERS: Speaker[] = [
  "Ryan", "Aiden", "Vivian", "Serena", "Uncle_Fu",
  "Dylan", "Eric", "Ono_Anna", "Sohee",
];

export const MODEL_SIZES: ModelSize[] = ["0.6B", "1.7B"];

export class QwenTTSClient {
  private config: QwenTTSConfig;

  constructor(config?: Partial<QwenTTSConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Strip trailing slash
    this.config.baseUrl = this.config.baseUrl.replace(/\/+$/, "");
  }

  /** Check if the Gradio server is reachable */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.config.baseUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Clone a voice from reference audio */
  async cloneVoice(options: VoiceCloneOptions): Promise<TTSResult> {
    const audioHandle = await this.resolveFileInput(options.referenceAudio);
    const { data, duration } = await this.callApi<[GradioFileRef, string, string]>(
      "clone_voice",
      [
        audioHandle,
        options.referenceText,
        options.text,
        options.language,
        options.modelSize ?? "1.7B",
        options.combine ?? true,
        options.pauseSeconds ?? 0.5,
      ],
    );
    return this.parseTTSResult(data, duration);
  }

  /** Generate speech with a built-in speaker voice */
  async customVoice(options: CustomVoiceOptions): Promise<TTSResult> {
    const { data, duration } = await this.callApi<[GradioFileRef, string, string]>(
      "generate_custom_voice",
      [
        options.text,
        options.language,
        options.speaker,
        options.instructText ?? "",
        options.modelSize ?? "1.7B",
      ],
    );
    return this.parseTTSResult(data, duration);
  }

  /** Design a voice from a natural language description */
  async designVoice(options: VoiceDesignOptions): Promise<TTSResult> {
    const { data, duration } = await this.callApi<[GradioFileRef, string, string]>(
      "design_and_generate",
      [
        options.text,
        options.language,
        options.voiceDescription,
        options.modelSize ?? "1.7B",
      ],
    );
    return this.parseTTSResult(data, duration);
  }

  /** Transcribe audio to text */
  async transcribe(audio: string | File | Blob): Promise<TranscribeResult> {
    const audioHandle = await this.resolveFileInput(audio);
    const { data } = await this.callApi<[string]>("do_transcribe", [audioHandle]);
    return { text: data[0] };
  }

  /** Download generated audio as ArrayBuffer */
  async downloadAudio(audioUrl: string): Promise<ArrayBuffer> {
    const url = audioUrl.startsWith("http")
      ? audioUrl
      : `${this.config.baseUrl}/${audioUrl.replace(/^\//, "")}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok) {
      throw new QwenTTSGenerationError(`Failed to download audio: ${res.status} ${res.statusText}`);
    }
    return res.arrayBuffer();
  }

  // ── Private helpers ────────────────────────────────────────

  /** Resolve a file input: strings pass through, File/Blob gets uploaded */
  private async resolveFileInput(input: string | File | Blob): Promise<string | GradioFileRef> {
    if (typeof input === "string") {
      return input;
    }
    return this.uploadFile(input);
  }

  /** Upload a file to the Gradio server, returns a file handle for use in API calls */
  private async uploadFile(file: File | Blob, filename?: string): Promise<GradioFileRef> {
    const formData = new FormData();
    const name = filename ?? (file instanceof File ? file.name : "audio.wav");
    formData.append("files", file, name);

    const res = await fetch(`${this.config.baseUrl}/upload`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok) {
      throw new QwenTTSConnectionError(`File upload failed: ${res.status} ${res.statusText}`);
    }

    const paths: string[] = await res.json() as string[];
    if (!paths.length) {
      throw new QwenTTSConnectionError("Upload returned no file paths");
    }
    return { path: paths[0], url: paths[0] };
  }

  /** Generic Gradio API call */
  private async callApi<T>(
    endpoint: string,
    data: unknown[],
  ): Promise<{ data: T; duration: number }> {
    const url = `${this.config.baseUrl}/api/${endpoint}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });
    } catch (err) {
      throw new QwenTTSConnectionError(
        `Failed to connect to ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new QwenTTSGenerationError(
        `API call to ${endpoint} failed (${res.status}): ${body}`,
      );
    }

    const json = (await res.json()) as { data: T; duration: number };
    return json;
  }

  /** Parse the standard TTS 3-tuple response into TTSResult */
  private parseTTSResult(
    data: [GradioFileRef, string, string],
    duration: number,
  ): TTSResult {
    const [audioRef, filePath, status] = data;
    const audioUrl = audioRef.url
      ? `${this.config.baseUrl}/file=${audioRef.url.replace(/^\/file=/, "")}`
      : `${this.config.baseUrl}/file=${audioRef.path}`;
    return {
      audioUrl,
      filePath: audioRef.path ?? filePath,
      status,
      duration,
    };
  }
}
