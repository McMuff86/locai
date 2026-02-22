"use client";

import React, { useRef, useCallback } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HealthIndicator } from '@/components/HealthIndicator';
import { MusicGenerator } from '@/components/audio/MusicGenerator';
import { TextToSpeech } from '@/components/audio/TextToSpeech';
import { AudioHistory, AudioHistoryHandle } from '@/components/audio/AudioHistory';
import { Button } from '@/components/ui/button';
import { Loader2, Music, Volume2, Settings } from 'lucide-react';
import Link from 'next/link';

export default function AudioPage() {
  const { settings, isLoaded } = useSettings();
  const historyRef = useRef<AudioHistoryHandle>(null);

  const handleGenerated = useCallback(() => {
    // Delay slightly so the file is written before we re-fetch
    setTimeout(() => historyRef.current?.refresh(), 1000);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Lade Einstellungen...</p>
      </div>
    );
  }

  // Check if at least one audio service URL is configured (they have defaults, so always true)
  // But show setup hint if user hasn't visited settings yet
  const aceStepUrl = settings?.aceStepUrl || 'http://localhost:8001';
  const qwenTTSUrl = settings?.qwenTTSUrl || 'http://localhost:7861';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Audio</h1>
        </div>
        <div className="flex items-center gap-4">
          <HealthIndicator endpoint="/api/ace-step/health" label="ACE-Step" />
          <HealthIndicator endpoint="/api/qwen-tts/health" label="Qwen3-TTS" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Generation tabs */}
          <Tabs defaultValue="music">
            <TabsList className="w-full">
              <TabsTrigger value="music" className="gap-1.5">
                <Music className="h-4 w-4" />
                Musik
              </TabsTrigger>
              <TabsTrigger value="tts" className="gap-1.5">
                <Volume2 className="h-4 w-4" />
                Sprache
              </TabsTrigger>
            </TabsList>

            <TabsContent value="music">
              <div className="bg-card border border-border rounded-lg p-4 mt-2">
                <MusicGenerator onGenerated={handleGenerated} />
              </div>
            </TabsContent>

            <TabsContent value="tts">
              <div className="bg-card border border-border rounded-lg p-4 mt-2">
                <TextToSpeech onGenerated={handleGenerated} />
              </div>
            </TabsContent>
          </Tabs>

          {/* History */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Verlauf
            </h2>
            <AudioHistory ref={historyRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
