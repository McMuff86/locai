"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VoiceLibrary } from './VoiceLibrary';
import { Loader2, Sparkles, Download, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Voice {
  id: string;
  name: string;
  description: string;
  referenceAudioPath: string;
  referenceText: string;
}

const LANGUAGES = [
  { value: 'German', label: 'Deutsch' },
  { value: 'English', label: 'Englisch' },
  { value: 'French', label: 'Französisch' },
  { value: 'Spanish', label: 'Spanisch' },
  { value: 'Italian', label: 'Italienisch' },
  { value: 'Portuguese', label: 'Portugiesisch' },
  { value: 'Russian', label: 'Russisch' },
  { value: 'Japanese', label: 'Japanisch' },
  { value: 'Korean', label: 'Koreanisch' },
  { value: 'Chinese', label: 'Chinesisch' },
] as const;

interface VoiceCloneTTSProps {
  onGenerated?: () => void;
}

export function VoiceCloneTTS({ onGenerated }: VoiceCloneTTSProps) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('German');
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!text.trim()) {
      setError('Bitte gib einen Text ein.');
      return;
    }
    if (!selectedVoice) {
      setError('Bitte wähle eine Stimme aus der Bibliothek.');
      return;
    }

    setLoading(true);
    setError(null);
    setResultUrl(null);

    try {
      const res = await fetch('/api/qwen-tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          language,
          mode: 'clone',
          referenceAudio: selectedVoice.referenceAudioPath,
          referenceText: selectedVoice.referenceText,
        }),
      });

      const data = await res.json();
      if (data.success && data.audioUrl) {
        setResultUrl(data.audioUrl);
        onGenerated?.();
      } else {
        setError(data.error || 'Generierung fehlgeschlagen');
      }
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }, [text, language, selectedVoice, onGenerated]);

  const handleSaveToWorkspace = useCallback(async () => {
    if (!resultUrl) return;
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-clone-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }, [resultUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Voice Library */}
      <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm p-4">
        <VoiceLibrary
          selectedVoiceId={selectedVoice?.id ?? null}
          onSelectVoice={setSelectedVoice}
        />
      </div>

      {/* TTS Controls */}
      <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Text-zu-Sprache
          </h3>
          {selectedVoice && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-auto">
              Stimme: {selectedVoice.name}
            </span>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Text zum Sprechen *
          </label>
          <Textarea
            placeholder="Gib hier den Text ein, der in der gewählten Stimme gesprochen werden soll..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {text.length} Zeichen
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Sprache
          </label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-destructive bg-destructive/10 p-2 rounded"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          onClick={generate}
          disabled={loading || !text.trim() || !selectedVoice}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? 'Generiere...' : 'Generieren'}
        </Button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {resultUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm p-4 space-y-3"
          >
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ergebnis
            </h3>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={resultUrl} className="w-full" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveToWorkspace}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Herunterladen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
