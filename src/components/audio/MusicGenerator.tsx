"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Music } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ModeSelector } from './ModeSelector';
import { PresetSelector } from './PresetSelector';
import { QualitySelector } from './QualitySelector';
import { ParameterPanel } from './ParameterPanel';
import { ReferenceAudioUpload } from './ReferenceAudioUpload';
import { ResultCard } from './ResultCard';
import { GenerationStatus } from './GenerationStatus';
import type { useAudioGenerator } from '@/hooks/useAudioGenerator';
import type { MusicPreset } from './presets';

interface MusicGeneratorProps {
  gen: ReturnType<typeof useAudioGenerator>;
  onGenerated?: () => void;
  onOpenInStudio?: (src: string, title: string) => void;
}

export function MusicGenerator({ gen, onGenerated, onOpenInStudio }: MusicGeneratorProps) {
  const needsReference = gen.mode === 'remix' || gen.mode === 'repaint';
  const showLyrics = gen.mode !== 'simple';

  const applyPreset = (preset: MusicPreset) => {
    gen.setCaption(preset.caption);
    if (preset.lyrics) gen.setLyrics(preset.lyrics);
    gen.setDuration(preset.duration);
    gen.setBpm(preset.bpm);
    gen.setInstrumental(preset.instrumental);
    if (preset.cfgScale !== undefined) gen.setCfgScale(preset.cfgScale);
    if (preset.numSteps !== undefined) gen.setNumSteps(preset.numSteps);
  };

  const getCurrentAsPreset = (): MusicPreset => ({
    id: '',
    name: '',
    emoji: '⭐',
    caption: gen.caption,
    lyrics: gen.lyrics || undefined,
    duration: gen.duration,
    bpm: gen.bpm,
    instrumental: gen.instrumental,
    cfgScale: gen.cfgScale,
    numSteps: gen.numSteps,
  });

  const estimatedSeconds = gen.estimatedTime;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
      {/* ── Left Panel: Controls ── */}
      <div className="space-y-5">
        <ModeSelector
          value={gen.mode}
          onChange={gen.setMode}
          disabled={gen.loading}
        />

        <PresetSelector
          onApply={applyPreset}
          onSaveCurrent={getCurrentAsPreset}
          disabled={gen.loading}
        />

        {gen.mode === 'simple' && (
          <QualitySelector
            value={gen.quality}
            onChange={gen.setQuality}
            estimatedTime={gen.estimatedTime}
            disabled={gen.loading}
          />
        )}

        <AnimatePresence mode="wait">
          {needsReference && (
            <motion.div
              key="ref-upload"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ReferenceAudioUpload
                srcAudioPath={gen.srcAudioPath}
                srcAudioName={gen.srcAudioName}
                onUploaded={(path, name) => {
                  gen.setSrcAudioPath(path);
                  gen.setSrcAudioName(name);
                }}
                onClear={gen.clearReference}
                disabled={gen.loading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <ParameterPanel
          mode={gen.mode}
          duration={gen.duration}
          bpm={gen.bpm}
          batch={gen.batch}
          seed={gen.seed}
          instrumental={gen.instrumental}
          thinking={gen.thinking}
          numSteps={gen.numSteps}
          cfgScale={gen.cfgScale}
          strength={gen.strength}
          repaintStart={gen.repaintStart}
          repaintEnd={gen.repaintEnd}
          onDurationChange={gen.setDuration}
          onBpmChange={gen.setBpm}
          onBatchChange={gen.setBatch}
          onSeedChange={gen.setSeed}
          onInstrumentalChange={gen.setInstrumental}
          onThinkingChange={gen.setThinking}
          onNumStepsChange={gen.setNumSteps}
          onCfgScaleChange={gen.setCfgScale}
          onStrengthChange={gen.setStrength}
          onRepaintStartChange={gen.setRepaintStart}
          onRepaintEndChange={gen.setRepaintEnd}
          disabled={gen.loading}
        />
      </div>

      {/* ── Center Panel: Input + Results ── */}
      <div className="space-y-4">
        {/* Caption */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Beschreibung
          </label>
          <Textarea
            placeholder="Beschreibe die Musik, z.B. 'Entspannte Lo-Fi Beats mit sanftem Piano'"
            value={gen.caption}
            onChange={(e) => gen.setCaption(e.target.value)}
            rows={2}
            disabled={gen.loading}
            className="resize-none"
          />
        </div>

        {/* Lyrics (not in simple mode) */}
        <AnimatePresence mode="wait">
          {showLyrics && (
            <motion.div
              key="lyrics"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Lyrics (optional)
              </label>
              <Textarea
                placeholder="Liedtext eingeben..."
                value={gen.lyrics}
                onChange={(e) => gen.setLyrics(e.target.value)}
                rows={4}
                disabled={gen.loading}
                className="resize-none font-mono text-xs"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate button */}
        <Button
          onClick={() => gen.generate(onGenerated)}
          disabled={gen.loading}
          className="w-full gap-2"
          size="lg"
        >
          {gen.loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {gen.statusText || 'Generiere...'}
            </>
          ) : (
            <>
              <Music className="h-4 w-4" />
              Musik generieren
            </>
          )}
        </Button>

        {/* Error */}
        <AnimatePresence>
          {gen.error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-sm text-destructive bg-destructive/10 rounded-lg p-3"
            >
              {gen.error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generation Status */}
        <GenerationStatus loading={gen.loading} statusText={gen.statusText} estimatedSeconds={estimatedSeconds} />

        {/* Results */}
        {gen.results.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ergebnisse
            </h3>
            {gen.results.map((r, i) => (
              <ResultCard
                key={`${r.url}-${i}`}
                url={r.url}
                label={r.label}
                index={i}
                onSendToRemix={(src) => gen.sendToRemix(src, r.label)}
                onSendToRepaint={(src) => gen.sendToRepaint(src, r.label)}
                onOpenInStudio={onOpenInStudio ? (src) => onOpenInStudio(src, r.label) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
