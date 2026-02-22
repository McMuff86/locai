export interface QwenTTSConfig {
  /** Base URL of the Gradio server */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export type Language =
  | "German"
  | "English"
  | "French"
  | "Spanish"
  | "Italian"
  | "Portuguese"
  | "Russian"
  | "Japanese"
  | "Korean"
  | "Chinese";

export type Speaker =
  | "Ryan"
  | "Aiden"
  | "Vivian"
  | "Serena"
  | "Uncle_Fu"
  | "Dylan"
  | "Eric"
  | "Ono_Anna"
  | "Sohee";

export type ModelSize = "0.6B" | "1.7B";

export interface VoiceCloneOptions {
  /** Path to reference audio file OR File/Blob for upload */
  referenceAudio: string | File | Blob;
  /** Reference text (transcript of the audio) */
  referenceText: string;
  /** Text to generate in the cloned voice */
  text: string;
  language: Language;
  /** Model size, default "1.7B" */
  modelSize?: ModelSize;
  /** Combine multiple segments into one, default true */
  combine?: boolean;
  /** Pause between segments in seconds, default 0.5 */
  pauseSeconds?: number;
}

export interface CustomVoiceOptions {
  text: string;
  language: Language;
  speaker: Speaker;
  /** Optional instruction text for voice style */
  instructText?: string;
  modelSize?: ModelSize;
}

export interface VoiceDesignOptions {
  text: string;
  language: Language;
  /** Natural language description of desired voice */
  voiceDescription: string;
  modelSize?: ModelSize;
}

export interface TTSResult {
  /** URL to download the audio */
  audioUrl: string;
  /** Server-side file path */
  filePath: string;
  /** Status message */
  status: string;
  /** Generation duration in seconds */
  duration: number;
}

export interface TranscribeResult {
  text: string;
}

/** Gradio file reference in API responses */
export interface GradioFileRef {
  path: string;
  url: string;
  orig_name?: string;
  size?: number;
  mime_type?: string;
}
