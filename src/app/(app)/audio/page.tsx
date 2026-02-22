"use client";

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HealthIndicator } from '@/components/HealthIndicator';
import { MusicGenerator } from '@/components/audio/MusicGenerator';
import { TextToSpeech } from '@/components/audio/TextToSpeech';
import { AudioHistory, AudioHistoryHandle } from '@/components/audio/AudioHistory';
import { Button } from '@/components/ui/button';
import { Loader2, Music, Volume2, Play } from 'lucide-react';

export default function AudioPage() {
  const { settings, isLoaded } = useSettings();
  const historyRef = useRef<AudioHistoryHandle>(null);

  // ACE-Step health status
  const [aceStepRunning, setAceStepRunning] = useState<boolean | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const checkAceStepHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/ace-step/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      setAceStepRunning(res.ok);
    } catch {
      setAceStepRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    checkAceStepHealth();
    const id = setInterval(checkAceStepHealth, 15000);
    return () => clearInterval(id);
  }, [isLoaded, checkAceStepHealth]);

  const launchAceStep = useCallback(async () => {
    if (!settings?.aceStepPath) return;
    setIsLaunching(true);
    setLaunchError(null);
    try {
      const res = await fetch('/api/ace-step/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aceStepPath: settings.aceStepPath }),
      });
      const data = await res.json();
      if (data.success) {
        // Wait a bit then re-check health
        setTimeout(checkAceStepHealth, 5000);
      } else {
        setLaunchError(data.error || 'Start fehlgeschlagen');
      }
    } catch {
      setLaunchError('Start fehlgeschlagen');
    } finally {
      setIsLaunching(false);
    }
  }, [settings?.aceStepPath, checkAceStepHealth]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Audio</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <HealthIndicator endpoint="/api/ace-step/health" label="ACE-Step" />
            {aceStepRunning === false && settings?.aceStepPath && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5"
                onClick={launchAceStep}
                disabled={isLaunching}
              >
                {isLaunching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Starten
              </Button>
            )}
          </div>
          <HealthIndicator endpoint="/api/qwen-tts/health" label="Qwen3-TTS" />
        </div>
      </div>

      {/* Launch error */}
      {launchError && (
        <div className="mx-4 mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
          {launchError}
        </div>
      )}

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
