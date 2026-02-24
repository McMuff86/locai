"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Trash2, Check, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type RecorderState = 'idle' | 'ready' | 'recording' | 'preview';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number;
  className?: string;
  compact?: boolean;
}

export function AudioRecorder({
  onRecordingComplete,
  maxDuration = 30,
  className,
  compact = false,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyserData, setAnalyserData] = useState<number[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const bars = 20;
    const step = Math.floor(data.length / bars);
    const sampled = Array.from({ length: bars }, (_, i) => data[i * step] / 255);
    setAnalyserData(sampled);
    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    analyserRef.current = null;
    setAnalyserData([]);
  }, []);

  // Step 1: Click "Stimme aufnehmen" → request mic permission, show ready state
  const prepareRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Show live mic level in ready state
      updateVisualizer();
      setState('ready');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Mikrofon-Zugriff verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.');
      } else {
        setError('Mikrofon konnte nicht gestartet werden.');
      }
    }
  }, [updateVisualizer]);

  // Step 2: Click "Start" → begin recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // Create preview URL
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewBlob(blob);
      cleanup();
      setState('preview');
    };

    recorder.start(250);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setState('recording');

    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= maxDuration) {
        stopRecording();
      }
    }, 200);
  }, [maxDuration, cleanup]);

  // Step 3: Click "Stopp" → stop recording, show preview
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Preview: accept recording
  const acceptRecording = useCallback(() => {
    if (previewBlob) {
      onRecordingComplete(previewBlob, elapsed);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setState('idle');
    setElapsed(0);
  }, [previewBlob, previewUrl, elapsed, onRecordingComplete]);

  // Preview: discard and try again
  const discardRecording = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setState('idle');
    setElapsed(0);
  }, [previewUrl]);

  // Cancel from ready state
  const cancelReady = useCallback(() => {
    cleanup();
    setState('idle');
  }, [cleanup]);

  const playPreview = useCallback(() => {
    if (!previewUrl) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(previewUrl);
    previewAudioRef.current = audio;
    audio.play();
  }, [previewUrl]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <Button
        variant={state === 'recording' ? 'destructive' : 'outline'}
        size="sm"
        onClick={state === 'idle' ? prepareRecording : state === 'ready' ? startRecording : stopRecording}
        className={className}
      >
        {state === 'recording' ? (
          <><Square className="h-3.5 w-3.5 mr-1.5 fill-current" />{formatTime(elapsed)}</>
        ) : (
          <><Mic className="h-3.5 w-3.5 mr-1.5" />Aufnehmen</>
        )}
      </Button>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* IDLE: Show "Stimme aufnehmen" button */}
      {state === 'idle' && (
        <Button variant="outline" className="w-full" onClick={prepareRecording}>
          <Mic className="h-4 w-4 mr-2" />
          Stimme aufnehmen
        </Button>
      )}

      {/* READY: Mic is active, waiting for user to press Start */}
      {state === 'ready' && (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
          <div className="text-xs text-muted-foreground text-center">
            Mikrofon bereit — drücke <span className="font-semibold text-foreground">Start</span> wenn du bereit bist
          </div>

          {/* Live mic level indicator */}
          <div className="flex items-end justify-center gap-[2px] h-8 px-2">
            {analyserData.map((v, i) => (
              <motion.div
                key={i}
                className="w-1.5 rounded-full bg-cyan-500/60"
                animate={{ height: Math.max(3, v * 32) }}
                transition={{ duration: 0.05 }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={cancelReady}>
              Abbrechen
            </Button>
            <Button variant="default" size="sm" className="flex-1" onClick={startRecording}>
              <Mic className="h-3.5 w-3.5 mr-1.5" />
              Start
            </Button>
          </div>
        </div>
      )}

      {/* RECORDING: Show waveform, timer, stop button */}
      {state === 'recording' && (
        <div className="space-y-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
          {/* Waveform visualizer */}
          <div className="flex items-end justify-center gap-[2px] h-10 px-2">
            {analyserData.map((v, i) => (
              <motion.div
                key={i}
                className="w-1.5 rounded-full bg-red-500"
                animate={{ height: Math.max(3, v * 40) }}
                transition={{ duration: 0.05 }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-sm font-mono tabular-nums text-red-400">
                {formatTime(elapsed)} / {formatTime(maxDuration)}
              </span>
            </div>

            <Button variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
              Stopp
            </Button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${(elapsed / maxDuration) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* PREVIEW: Play back, accept or discard */}
      {state === 'preview' && (
        <div className="space-y-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-400">
                Aufnahme: {formatTime(elapsed)}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={playPreview}>
              <Play className="h-3.5 w-3.5 mr-1 fill-current" />
              Anhören
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={discardRecording}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Verwerfen
            </Button>
            <Button variant="default" size="sm" className="flex-1" onClick={acceptRecording}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Verwenden
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
