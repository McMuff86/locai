"use client";

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useAudioGenerator } from '@/hooks/useAudioGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HealthIndicator } from '@/components/HealthIndicator';
import { MusicGenerator } from '@/components/audio/MusicGenerator';
import { TextToSpeech } from '@/components/audio/TextToSpeech';
import { AudioHistory, AudioHistoryHandle } from '@/components/audio/AudioHistory';
import { Button } from '@/components/ui/button';
import { Loader2, Music, Volume2, Play } from 'lucide-react';

export default function AudioPage() {
  const { settings, isLoaded } = useSettings();
  const historyRef = useRef<AudioHistoryHandle>(null);
  const gen = useAudioGenerator();

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
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="music">
            <TabsList className="w-full max-w-xs">
              <TabsTrigger value="music" className="gap-1.5">
                <Music className="h-4 w-4" />
                Musik
              </TabsTrigger>
              <TabsTrigger value="tts" className="gap-1.5">
                <Volume2 className="h-4 w-4" />
                Sprache
              </TabsTrigger>
            </TabsList>

            <TabsContent value="music" className="mt-4">
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
                {/* Main generation area */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5">
                  <MusicGenerator gen={gen} onGenerated={handleGenerated} />
                </div>

                {/* Right panel: History */}
                <div className="space-y-3">
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Audio-Verlauf
                  </h2>
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    <AudioHistory
                      ref={historyRef}
                      compact
                      onSendToRemix={(src, name) => gen.sendToRemix(src, name)}
                      onSendToRepaint={(src, name) => gen.sendToRepaint(src, name)}
                    />
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tts" className="mt-4">
              <div className="max-w-2xl">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5">
                  <TextToSpeech onGenerated={handleGenerated} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
