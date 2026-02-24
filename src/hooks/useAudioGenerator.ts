"use client";

import { useState, useCallback } from 'react';
import { type QualityLevel, QUALITY_PRESETS, estimateGenerationTime } from '@/lib/aceStep/promptTemplates';

export type GenerationMode = 'simple' | 'custom' | 'remix' | 'repaint';

export interface GeneratedAudio {
  url: string;
  label: string;
}

export interface AudioGeneratorState {
  mode: GenerationMode;
  caption: string;
  lyrics: string;
  duration: number;
  bpm: number;
  batch: number;
  instrumental: boolean;
  seed: string;
  // Advanced
  thinking: boolean;
  numSteps: number;
  cfgScale: number;
  // Remix
  strength: number;
  // Repaint
  repaintStart: number;
  repaintEnd: number;
  // Reference audio
  srcAudioPath: string;
  srcAudioName: string;
  // Quality
  quality: QualityLevel;
  estimatedTime: number;
  // Status
  loading: boolean;
  error: string | null;
  statusText: string;
  results: GeneratedAudio[];
}

const MODE_TO_TASK_TYPE: Record<GenerationMode, string> = {
  simple: 'text2music',
  custom: 'text2music',
  remix: 'remix',
  repaint: 'repaint',
};

export function useAudioGenerator() {
  const [mode, setMode] = useState<GenerationMode>('simple');
  const [caption, setCaption] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(30);
  const [bpm, setBpm] = useState(120);
  const [batch, setBatch] = useState(1);
  const [instrumental, setInstrumental] = useState(false);
  const [seed, setSeed] = useState('');
  const [thinking, setThinking] = useState(false);
  const [numSteps, setNumSteps] = useState(50);
  const [cfgScale, setCfgScale] = useState(5);
  const [strength, setStrength] = useState(0.5);
  const [repaintStart, setRepaintStart] = useState(0);
  const [repaintEnd, setRepaintEnd] = useState(-1);
  const [srcAudioPath, setSrcAudioPath] = useState('');
  const [srcAudioName, setSrcAudioName] = useState('');
  const [quality, setQuality] = useState<QualityLevel>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState<GeneratedAudio[]>([]);

  const effectiveNumSteps = mode === 'simple' ? QUALITY_PRESETS[quality].numSteps : numSteps;
  const effectiveCfgScale = mode === 'simple' ? QUALITY_PRESETS[quality].cfgScale : cfgScale;
  const estimatedTime = estimateGenerationTime(duration, batch, quality);

  const generate = useCallback(async (onGenerated?: () => void) => {
    if (!caption.trim() && !lyrics.trim() && mode !== 'remix' && mode !== 'repaint') {
      setError('Bitte gib eine Beschreibung oder Lyrics ein.');
      return;
    }

    if ((mode === 'remix' || mode === 'repaint') && !srcAudioPath) {
      setError('Bitte lade eine Referenz-Audio-Datei hoch.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setStatusText('Generiere Musik...');

    try {
      const body: Record<string, unknown> = {
        task_type: MODE_TO_TASK_TYPE[mode],
        caption: caption.trim() || undefined,
        lyrics: lyrics.trim() || undefined,
        duration,
        bpm,
        batch,
      };

      if (instrumental) body.instrumental = true;
      if (seed.trim()) body.seed = parseInt(seed);
      if (mode === 'simple') {
        const qp = QUALITY_PRESETS[quality];
        if (qp.numSteps !== 50) body.num_steps = qp.numSteps;
        if (qp.cfgScale !== 5) body.cfg_scale = qp.cfgScale;
      } else if (mode === 'custom' || mode === 'remix' || mode === 'repaint') {
        if (thinking) body.thinking = true;
        if (numSteps !== 50) body.num_steps = numSteps;
        if (cfgScale !== 5) body.cfg_scale = cfgScale;
      }
      if (mode === 'remix') {
        body.src_audio_path = srcAudioPath;
        body.strength = strength;
      }
      if (mode === 'repaint') {
        body.src_audio_path = srcAudioPath;
        body.repainting_start = repaintStart;
        body.repainting_end = repaintEnd;
      }

      const res = await fetch('/api/ace-step/generate-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Generierung fehlgeschlagen');
      }

      const audioUrls = data.audioUrls as string[];
      setResults(
        audioUrls.map((url, i) => ({
          url,
          label: `Track ${i + 1}`,
        }))
      );
      setStatusText('');
      onGenerated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
        setError('ACE-Step Server nicht erreichbar. Bitte starte den Server über den "Server starten" Button oder prüfe ob er auf localhost:8001 läuft.');
      } else if (message.includes('timeout') || message.includes('Timeout')) {
        setError('Generierung hat zu lange gedauert (Timeout). Versuche eine kürzere Dauer oder weniger Steps.');
      } else {
        setError(message);
      }
      setStatusText('');
    } finally {
      setLoading(false);
    }
  }, [caption, lyrics, duration, bpm, batch, mode, instrumental, seed, thinking, numSteps, cfgScale, strength, repaintStart, repaintEnd, srcAudioPath, quality]);

  const sendToRemix = useCallback((audioPath: string, audioName?: string) => {
    setMode('remix');
    setSrcAudioPath(audioPath);
    setSrcAudioName(audioName || 'Audio');
    setStrength(0.5);
  }, []);

  const sendToRepaint = useCallback((audioPath: string, audioName?: string) => {
    setMode('repaint');
    setSrcAudioPath(audioPath);
    setSrcAudioName(audioName || 'Audio');
    setRepaintStart(0);
    setRepaintEnd(-1);
  }, []);

  const clearReference = useCallback(() => {
    setSrcAudioPath('');
    setSrcAudioName('');
  }, []);

  return {
    // State
    mode, caption, lyrics, duration, bpm, batch, instrumental, seed,
    thinking, numSteps, cfgScale, strength, repaintStart, repaintEnd,
    srcAudioPath, srcAudioName,
    quality, estimatedTime, effectiveNumSteps, effectiveCfgScale,
    loading, error, statusText, results,
    // Setters
    setMode, setCaption, setLyrics, setDuration, setBpm, setBatch,
    setInstrumental, setSeed, setThinking, setNumSteps, setCfgScale,
    setStrength, setRepaintStart, setRepaintEnd,
    setSrcAudioPath, setSrcAudioName, setQuality,
    // Actions
    generate, sendToRemix, sendToRepaint, clearReference,
  };
}
