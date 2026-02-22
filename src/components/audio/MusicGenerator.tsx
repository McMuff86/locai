"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Loader2, Music } from 'lucide-react';

interface MusicGeneratorProps {
  onGenerated?: () => void;
}

interface GeneratedAudio {
  url: string;
  caption: string;
}

export function MusicGenerator({ onGenerated }: MusicGeneratorProps) {
  const [caption, setCaption] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(30);
  const [bpm, setBpm] = useState(120);
  const [batch, setBatch] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedAudio[]>([]);
  const [statusText, setStatusText] = useState('');

  const generate = useCallback(async () => {
    if (!caption.trim() && !lyrics.trim()) {
      setError('Bitte gib eine Beschreibung oder Lyrics ein.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setStatusText('Generiere Musik...');

    try {
      const res = await fetch('/api/ace-step/generate-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: caption.trim() ? 'caption' : 'description',
          caption: caption.trim() || undefined,
          lyrics: lyrics.trim() || undefined,
          duration,
          bpm,
          batch: parseInt(batch),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Generierung fehlgeschlagen');
      }

      const audioUrls = data.audioUrls as string[];
      setResults(
        audioUrls.map((url, i) => ({
          url,
          caption: `Track ${i + 1}`,
        }))
      );
      setStatusText('');
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setStatusText('');
    } finally {
      setLoading(false);
    }
  }, [caption, lyrics, duration, bpm, batch, onGenerated]);

  return (
    <div className="space-y-4">
      {/* Caption */}
      <div>
        <label className="block text-sm font-medium mb-1">Beschreibung</label>
        <Textarea
          placeholder="Beschreibe die Musik, z.B. 'Entspannte Lo-Fi Beats mit sanftem Piano'"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          disabled={loading}
        />
      </div>

      {/* Lyrics */}
      <div>
        <label className="block text-sm font-medium mb-1">Lyrics (optional)</label>
        <Textarea
          placeholder="Liedtext eingeben..."
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={3}
          disabled={loading}
        />
      </div>

      {/* Duration + BPM row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Dauer: {duration}s
          </label>
          <Slider
            min={5}
            max={300}
            step={5}
            value={[duration]}
            onValueChange={(v) => setDuration(v[0])}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            BPM: {bpm}
          </label>
          <Slider
            min={60}
            max={200}
            step={1}
            value={[bpm]}
            onValueChange={(v) => setBpm(v[0])}
            disabled={loading}
          />
        </div>
      </div>

      {/* Batch */}
      <div>
        <label className="block text-sm font-medium mb-1">Varianten</label>
        <Select value={batch} onValueChange={setBatch} disabled={loading}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Variante</SelectItem>
            <SelectItem value="2">2 Varianten</SelectItem>
            <SelectItem value="3">3 Varianten</SelectItem>
            <SelectItem value="4">4 Varianten</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Generate button */}
      <Button onClick={generate} disabled={loading} className="w-full gap-2">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {statusText || 'Generiere...'}
          </>
        ) : (
          <>
            <Music className="h-4 w-4" />
            Musik generieren
          </>
        )}
      </Button>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Ergebnis:</p>
          {results.map((r, i) => (
            <AudioPlayer key={i} src={r.url} title={r.caption} downloadable />
          ))}
        </div>
      )}
    </div>
  );
}
