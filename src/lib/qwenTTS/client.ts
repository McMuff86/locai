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
} from "./types";
import {
  QwenTTSConnectionError,
  QwenTTSGenerationError,
} from "./errors";

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
      // Try Gradio 6 info endpoint first (more reliable than HEAD)
      const res = await fetch(`${this.config.baseUrl}/gradio_api/info`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) return true;

      // Fallback: simple HEAD
      const head = await fetch(this.config.baseUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5_000),
      });
      return head.ok;
    } catch {
      return false;
    }
  }

  /** Clone a voice from reference audio */
  async cloneVoice(options: VoiceCloneOptions): Promise<TTSResult> {
    const audioHandle = await this.resolveFileInput(options.referenceAudio);
    // clone_voice(voice_file_dropdown, voice_file_upload, reference_text,
    //             text_to_generate, language, model_size, combine_audio, pause_seconds)
    const { data, duration } = await this.callApi<[GradioFileRef, string, string]>(
      "clone_voice",
      [
        null,                              // voice_file_dropdown (not used)
        audioHandle,                       // voice_file_upload
        options.referenceText ?? "",       // reference_text
        options.text,                      // text_to_generate
        options.language,                  // language
        options.modelSize ?? "1.7B",       // model_size
        options.combine ?? true,           // combine_audio
        options.pauseSeconds ?? 0.5,       // pause_seconds
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

    // Try Gradio 6 upload path first, then Gradio 5
    let res = await fetch(`${this.config.baseUrl}/gradio_api/upload`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(`${this.config.baseUrl}/upload`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(this.config.timeout!),
      });
    }

    if (!res.ok) {
      throw new QwenTTSConnectionError(`File upload failed: ${res.status} ${res.statusText}`);
    }

    const paths: string[] = await res.json() as string[];
    if (!paths.length) {
      throw new QwenTTSConnectionError("Upload returned no file paths");
    }
    return { path: paths[0], url: paths[0] };
  }

  /** Generic Gradio API call — supports both Gradio 5 (/api/) and Gradio 6 (/gradio_api/call/) */
  private async callApi<T>(
    endpoint: string,
    data: unknown[],
  ): Promise<{ data: T; duration: number }> {
    // Try Gradio 6 first (/gradio_api/call/), fall back to Gradio 5 (/api/)
    const g6url = `${this.config.baseUrl}/gradio_api/call/${endpoint}`;
    const g5url = `${this.config.baseUrl}/api/${endpoint}`;

    let res: Response;
    let isGradio6 = false;

    try {
      res = await fetch(g6url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        isGradio6 = true;
      } else if (res.status === 404) {
        // Gradio 5 fallback
        res = await fetch(g5url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
          signal: AbortSignal.timeout(this.config.timeout!),
        });
      }
    } catch (err) {
      // Try Gradio 5 as fallback
      try {
        res = await fetch(g5url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
          signal: AbortSignal.timeout(this.config.timeout!),
        });
      } catch (err2) {
        throw new QwenTTSConnectionError(
          `Failed to connect to ${g6url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (isGradio6) {
      // Gradio 6: POST returns { event_id }, then GET SSE stream for result
      if (!res!.ok) {
        const body = await res!.text().catch(() => "");
        throw new QwenTTSGenerationError(`API call to ${endpoint} failed (${res!.status}): ${body}`);
      }

      const { event_id } = (await res!.json()) as { event_id: string };
      const resultUrl = `${this.config.baseUrl}/gradio_api/call/${endpoint}/${event_id}`;
      const startTime = Date.now();

      // Poll the SSE stream for completion
      const sseRes = await fetch(resultUrl, {
        method: "GET",
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!sseRes.ok) {
        throw new QwenTTSGenerationError(`SSE stream failed (${sseRes.status})`);
      }

      const sseText = await sseRes.text();
      console.log(`[QwenTTS] SSE response for ${endpoint}:`, sseText.slice(0, 500));
      const duration = (Date.now() - startTime) / 1000;

      // Parse SSE: look for "event: complete" followed by "data: ..."
      const lines = sseText.split("\n");
      let resultData: T | null = null;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("event: complete")) {
          // Next "data:" line has the JSON
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].startsWith("data: ")) {
              const jsonStr = lines[j].slice(6);
              const parsed = JSON.parse(jsonStr);
              resultData = parsed as T;
              break;
            }
          }
          break;
        }
        if (lines[i].startsWith("event: error")) {
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].startsWith("data: ")) {
              const errData = lines[j].slice(6);
              // Try to parse JSON error for better message
              try {
                const parsed = JSON.parse(errData);
                const msg = parsed?.message || parsed?.error || parsed || errData;
                throw new QwenTTSGenerationError(`Gradio error: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
              } catch (e) {
                if (e instanceof QwenTTSGenerationError) throw e;
                throw new QwenTTSGenerationError(`Gradio error: ${errData}`);
              }
            }
          }
          throw new QwenTTSGenerationError("Gradio returned an error event");
        }
      }

      if (!resultData) {
        throw new QwenTTSGenerationError("No completion event in Gradio SSE response");
      }

      return { data: resultData, duration };
    }

    // Gradio 5: direct JSON response
    if (!res!.ok) {
      const body = await res!.text().catch(() => "");
      throw new QwenTTSGenerationError(`API call to ${endpoint} failed (${res!.status}): ${body}`);
    }

    const json = (await res!.json()) as { data: T; duration: number };
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
