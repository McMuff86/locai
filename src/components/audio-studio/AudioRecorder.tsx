"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  /** Called with the recorded audio blob when recording stops */
  onRecordingComplete: (blob: Blob, duration: number) => void;
  /** Max recording duration in seconds (default 30) */
  maxDuration?: number;
  /** Optional class name */
  className?: string;
  /** Show as compact button */
  compact?: boolean;
}

export function AudioRecorder({
  onRecordingComplete,
  maxDuration = 30,
  className,
  compact = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyserData, setAnalyserData] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Visualizer update loop
  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    // Sample 16 bars from the frequency data
    const bars = 16;
    const step = Math.floor(data.length / bars);
    const sampled = Array.from({ length: bars }, (_, i) => data[i * step] / 255);
    setAnalyserData(sampled);
    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      // Setup analyser for visualizer
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Prefer WAV-compatible format, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete(blob, duration);

        // Cleanup
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        setAnalyserData([]);
      };

      recorder.start(250); // collect data every 250ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setElapsed(0);

      // Start visualizer
      updateVisualizer();

      // Timer
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs >= maxDuration) {
          stopRecording();
        }
      }, 200);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Mikrofon-Zugriff verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.');
      } else {
        setError('Mikrofon konnte nicht gestartet werden.');
      }
    }
  }, [maxDuration, onRecordingComplete, updateVisualizer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <Button
        variant={isRecording ? 'destructive' : 'outline'}
        size="sm"
        onClick={isRecording ? stopRecording : startRecording}
        className={className}
      >
        {isRecording ? (
          <>
            <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
            {formatTime(elapsed)}
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 mr-1.5" />
            Aufnehmen
          </>
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

      {isRecording ? (
        <div className="space-y-3">
          {/* Waveform visualizer */}
          <div className="flex items-end justify-center gap-[2px] h-12 px-2">
            {analyserData.map((v, i) => (
              <motion.div
                key={i}
                className="w-1.5 rounded-full bg-red-500"
                animate={{ height: Math.max(4, v * 48) }}
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

            <Button
              variant="destructive"
              size="sm"
              onClick={stopRecording}
            >
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
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={startRecording}
        >
          <Mic className="h-4 w-4 mr-2" />
          Stimme aufnehmen
        </Button>
      )}
    </div>
  );
}
