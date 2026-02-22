"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Loader2, Volume2 } from 'lucide-react';

const LANGUAGES = [
  'German', 'English', 'French', 'Spanish', 'Italian',
  'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese',
] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  German: 'Deutsch', English: 'Englisch', French: 'Französisch',
  Spanish: 'Spanisch', Italian: 'Italienisch', Portuguese: 'Portugiesisch',
  Russian: 'Russisch', Japanese: 'Japanisch', Korean: 'Koreanisch',
  Chinese: 'Chinesisch',
};

const SPEAKERS = [
  'Ryan', 'Aiden', 'Vivian', 'Serena', 'Uncle_Fu',
  'Dylan', 'Eric', 'Ono_Anna', 'Sohee',
] as const;

interface TextToSpeechProps {
  onGenerated?: () => void;
}

export function TextToSpeech({ onGenerated }: TextToSpeechProps) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('German');
  const [mode, setMode] = useState('custom');
  const [speaker, setSpeaker] = useState('Vivian');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!text.trim()) {
      setError('Bitte gib einen Text ein.');
      return;
    }

    if (mode === 'design' && !voiceDescription.trim()) {
      setError('Bitte beschreibe die gewünschte Stimme.');
      return;
    }

    setLoading(true);
    setError(null);
    setResultUrl(null);

    try {
      const body: Record<string, unknown> = {
        text: text.trim(),
        language,
        mode,
      };

      if (mode === 'custom') {
        body.speaker = speaker;
      } else if (mode === 'design') {
        body.voiceDescription = voiceDescription.trim();
      }

      const res = await fetch('/api/qwen-tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Sprachsynthese fehlgeschlagen');
      }

      setResultUrl(data.audioUrl);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [text, language, mode, speaker, voiceDescription, onGenerated]);

  return (
    <div className="space-y-4">
      {/* Text */}
      <div>
        <label className="block text-sm font-medium mb-1">Text</label>
        <Textarea
          placeholder="Text eingeben, der vorgelesen werden soll..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          disabled={loading}
        />
      </div>

      {/* Language + Mode row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Sprache</label>
          <Select value={language} onValueChange={setLanguage} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang] || lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Modus</label>
          <Select value={mode} onValueChange={setMode} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Sprecher</SelectItem>
              <SelectItem value="design">Stimm-Design</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Speaker (custom mode) */}
      {mode === 'custom' && (
        <div>
          <label className="block text-sm font-medium mb-1">Sprecher</label>
          <Select value={speaker} onValueChange={setSpeaker} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEAKERS.map((s) => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Voice description (design mode) */}
      {mode === 'design' && (
        <div>
          <label className="block text-sm font-medium mb-1">Stimmbeschreibung</label>
          <Textarea
            placeholder="Beschreibe die gewünschte Stimme, z.B. 'Warme, tiefe männliche Stimme mit ruhigem Ton'"
            value={voiceDescription}
            onChange={(e) => setVoiceDescription(e.target.value)}
            rows={2}
            disabled={loading}
          />
        </div>
      )}

      {/* Generate button */}
      <Button onClick={generate} disabled={loading} className="w-full gap-2">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generiere Sprache...
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4" />
            Sprache generieren
          </>
        )}
      </Button>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Ergebnis:</p>
          <AudioPlayer src={resultUrl} title="Generierte Sprache" downloadable />
        </div>
      )}
    </div>
  );
}
