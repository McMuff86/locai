"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ReferenceAudioUpload } from './ReferenceAudioUpload';
import { AudioRecorder } from '@/components/audio-studio/AudioRecorder';
import { Loader2, Volume2, FileAudio, Library } from 'lucide-react';

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

interface SavedVoice {
  id: string;
  name: string;
  description: string;
  referenceAudioPath: string;
  referenceText: string;
}

export function TextToSpeech({ onGenerated }: TextToSpeechProps) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('German');
  const [mode, setMode] = useState('custom');
  const [speaker, setSpeaker] = useState('Vivian');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [referenceAudioPath, setReferenceAudioPath] = useState('');
  const [referenceAudioName, setReferenceAudioName] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Saved voices from Voice Library
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [cloneSource, setCloneSource] = useState<'library' | 'upload' | 'record'>('library');

  // Fetch saved voices when clone mode is selected
  React.useEffect(() => {
    if (mode === 'clone') {
      fetch('/api/voice-library')
        .then(r => r.json())
        .then(data => {
          if (data.success && data.voices) setSavedVoices(data.voices);
        })
        .catch(() => {});
    }
  }, [mode]);

  const generate = useCallback(async () => {
    if (!text.trim()) {
      setError('Bitte gib einen Text ein.');
      return;
    }

    if (mode === 'design' && !voiceDescription.trim()) {
      setError('Bitte beschreibe die gewünschte Stimme.');
      return;
    }

    if (mode === 'clone' && !referenceAudioPath) {
      setError('Bitte lade eine Referenz-Audiodatei hoch.');
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
      } else if (mode === 'clone') {
        body.referenceAudio = referenceAudioPath;
        body.referenceText = referenceText.trim();
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
  }, [text, language, mode, speaker, voiceDescription, referenceAudioPath, referenceText, onGenerated]);

  const handleTranscribe = useCallback(async () => {
    if (!referenceAudioPath) return;
    setTranscribing(true);
    setError(null);
    try {
      const res = await fetch('/api/qwen-tts/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: referenceAudioPath }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Transkription fehlgeschlagen');
      }
      setReferenceText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transkription fehlgeschlagen');
    } finally {
      setTranscribing(false);
    }
  }, [referenceAudioPath]);

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
              <SelectItem value="clone">Voice Clone</SelectItem>
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

      {/* Voice clone (clone mode) */}
      {mode === 'clone' && (
        <div className="space-y-3">
          {/* Source selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Stimmquelle</label>
            <div className="flex gap-2">
              <Button
                variant={cloneSource === 'library' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCloneSource('library')}
                disabled={loading}
                className="flex-1 gap-1.5"
              >
                <Library className="h-3.5 w-3.5" />
                Gespeichert
              </Button>
              <Button
                variant={cloneSource === 'upload' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCloneSource('upload')}
                disabled={loading}
                className="flex-1 gap-1.5"
              >
                <FileAudio className="h-3.5 w-3.5" />
                Hochladen
              </Button>
              <Button
                variant={cloneSource === 'record' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCloneSource('record')}
                disabled={loading}
                className="flex-1 gap-1.5"
              >
                <Volume2 className="h-3.5 w-3.5" />
                Aufnehmen
              </Button>
            </div>
          </div>

          {/* Library voices */}
          {cloneSource === 'library' && (
            <div>
              {savedVoices.length > 0 ? (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {savedVoices.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => {
                        setReferenceAudioPath(voice.referenceAudioPath);
                        setReferenceAudioName(voice.name);
                        setReferenceText(voice.referenceText || '');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-sm ${
                        referenceAudioPath === voice.referenceAudioPath
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/50 hover:bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      <div className="font-medium">{voice.name}</div>
                      {voice.description && (
                        <div className="text-xs text-muted-foreground/70 truncate">{voice.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-lg">
                  Keine Stimmen gespeichert. Erstelle welche im &quot;Voice Clone&quot; Tab.
                </div>
              )}
            </div>
          )}

          {/* Upload */}
          {cloneSource === 'upload' && (
            <ReferenceAudioUpload
              srcAudioPath={referenceAudioPath}
              srcAudioName={referenceAudioName}
              onUploaded={(filePath, fileName) => {
                setReferenceAudioPath(filePath);
                setReferenceAudioName(fileName);
              }}
              onClear={() => {
                setReferenceAudioPath('');
                setReferenceAudioName('');
                setReferenceText('');
              }}
              disabled={loading}
            />
          )}

          {/* Record */}
          {cloneSource === 'record' && (
            <AudioRecorder
              maxDuration={30}
              onRecordingComplete={async (blob) => {
                const file = new File([blob], `tts-ref-${Date.now()}.webm`, { type: blob.type });
                const formData = new FormData();
                formData.append('file', file);
                try {
                  const res = await fetch('/api/qwen-tts/upload', { method: 'POST', body: formData });
                  const data = await res.json();
                  if (data.success && data.filePath) {
                    setReferenceAudioPath(data.filePath);
                    setReferenceAudioName('Aufnahme');
                  }
                } catch { /* ignore */ }
              }}
            />
          )}

          {/* Reference text (shared across all clone sources) */}
          {referenceAudioPath && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">Referenz-Text</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleTranscribe}
                  disabled={transcribing || loading}
                  className="h-7 text-xs gap-1"
                >
                  {transcribing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileAudio className="h-3 w-3" />
                  )}
                  Auto-Transkribieren
                </Button>
              </div>
              <Input
                placeholder="Text der im Referenz-Audio gesprochen wird..."
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional: Transkript des Referenz-Audios für bessere Ergebnisse
              </p>
            </div>
          )}
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
