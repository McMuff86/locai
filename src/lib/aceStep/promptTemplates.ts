import type { GenerateOptions } from './types';

export interface GenreTemplate {
  id: string;
  name: string;
  emoji: string;
  caption: string;
  bpm: number;
  duration: number;
  cfgScale: number;
  numSteps: number;
  instrumental: boolean;
  description: string;
}

export const GENRE_TEMPLATES: GenreTemplate[] = [
  {
    id: 'pop',
    name: 'Pop',
    emoji: '🎤',
    caption: 'Catchy pop song with bright synths, groovy bassline, crisp snare, uplifting chorus melody, and polished radio-ready production',
    bpm: 118,
    duration: 60,
    cfgScale: 5,
    numSteps: 60,
    instrumental: false,
    description: 'Radio-tauglicher Pop mit eingängiger Melodie',
  },
  {
    id: 'rock',
    name: 'Rock',
    emoji: '🎸',
    caption: 'Powerful rock track with crunchy electric guitars, driving drum beat, deep bass groove, energetic riffs, and raw distortion',
    bpm: 132,
    duration: 45,
    cfgScale: 5,
    numSteps: 60,
    instrumental: true,
    description: 'Energetischer Rock mit E-Gitarren und Power-Drums',
  },
  {
    id: 'electronic',
    name: 'Electronic',
    emoji: '🎛️',
    caption: 'Modern electronic dance track with pulsing synthesizers, four-on-the-floor kick drum, arpeggiated leads, sidechained bass, and euphoric build-ups',
    bpm: 128,
    duration: 60,
    cfgScale: 6,
    numSteps: 60,
    instrumental: true,
    description: 'EDM mit Synths, Drops und tanzbarem Beat',
  },
  {
    id: 'jazz',
    name: 'Jazz',
    emoji: '🎷',
    caption: 'Sophisticated jazz ensemble with walking upright bass, brushed snare, warm tenor saxophone improvisation, comping piano chords, and smooth swing feel',
    bpm: 112,
    duration: 90,
    cfgScale: 7,
    numSteps: 80,
    instrumental: true,
    description: 'Smooth Jazz mit Saxophon und Walking Bass',
  },
  {
    id: 'classical',
    name: 'Classical',
    emoji: '🎻',
    caption: 'Elegant classical orchestral piece with lush string section, expressive dynamics, romantic harmonies, woodwind countermelodies, and graceful phrasing',
    bpm: 76,
    duration: 120,
    cfgScale: 7,
    numSteps: 80,
    instrumental: true,
    description: 'Orchestrale Klassik mit Streichern und Dynamik',
  },
  {
    id: 'hiphop',
    name: 'Hip-Hop',
    emoji: '🎤',
    caption: 'Hard-hitting hip-hop beat with booming 808 bass, crisp hi-hats, snappy snare, dark melodic samples, and trap-style percussion rolls',
    bpm: 90,
    duration: 60,
    cfgScale: 5,
    numSteps: 50,
    instrumental: true,
    description: 'Hip-Hop/Trap Beat mit 808s und harten Drums',
  },
  {
    id: 'ambient',
    name: 'Ambient',
    emoji: '🌌',
    caption: 'Expansive ambient soundscape with ethereal pads, granular textures, gentle field recordings, deep reverb spaces, and slowly evolving harmonic drones',
    bpm: 65,
    duration: 180,
    cfgScale: 8,
    numSteps: 80,
    instrumental: true,
    description: 'Atmosphärische Klanglandschaften und Texturen',
  },
  {
    id: 'folk',
    name: 'Folk',
    emoji: '🪕',
    caption: 'Warm acoustic folk song with fingerpicked guitar, gentle fiddle, soft percussion, harmonica accents, and intimate organic production',
    bpm: 105,
    duration: 60,
    cfgScale: 6,
    numSteps: 60,
    instrumental: false,
    description: 'Akustischer Folk mit Gitarre und Fiddle',
  },
];

/** Quality presets that adjust num_steps and cfg_scale */
export type QualityLevel = 'draft' | 'standard' | 'high';

export interface QualityPreset {
  id: QualityLevel;
  name: string;
  label: string;
  numSteps: number;
  cfgScale: number;
  estimatedMultiplier: number; // multiplier vs standard for time estimation
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  draft: {
    id: 'draft',
    name: 'Draft',
    label: '⚡ Draft — Schnell',
    numSteps: 25,
    cfgScale: 4,
    estimatedMultiplier: 0.5,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    label: '🎵 Standard',
    numSteps: 50,
    cfgScale: 5,
    estimatedMultiplier: 1.0,
  },
  high: {
    id: 'high',
    name: 'High Quality',
    label: '💎 High Quality',
    numSteps: 100,
    cfgScale: 7,
    estimatedMultiplier: 2.0,
  },
};

/**
 * Get optimal ACE-Step generation settings for a genre.
 * Merges genre defaults with optional quality override.
 */
export function getOptimalSettings(
  genre: string,
  quality?: QualityLevel,
): Partial<GenerateOptions> {
  const template = GENRE_TEMPLATES.find((t) => t.id === genre);
  if (!template) {
    // Return quality-only defaults
    const q = quality ? QUALITY_PRESETS[quality] : QUALITY_PRESETS.standard;
    return { numSteps: q.numSteps, cfgScale: q.cfgScale };
  }

  const q = quality ? QUALITY_PRESETS[quality] : undefined;

  return {
    caption: template.caption,
    duration: template.duration,
    bpm: template.bpm,
    instrumental: template.instrumental,
    numSteps: q?.numSteps ?? template.numSteps,
    cfgScale: q?.cfgScale ?? template.cfgScale,
  };
}

/**
 * Estimate generation time in seconds based on duration, batch, and quality.
 */
export function estimateGenerationTime(
  durationSec: number,
  batch: number,
  quality: QualityLevel = 'standard',
): number {
  const q = QUALITY_PRESETS[quality];
  const baseTime = (durationSec / 30) * 20; // ~20s per 30s of audio at standard
  return Math.max(10, Math.round(baseTime * batch * q.estimatedMultiplier));
}
