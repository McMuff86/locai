export interface MusicPreset {
  id: string;
  name: string;
  emoji: string;
  caption: string;
  lyrics?: string;
  duration: number;
  bpm: number;
  instrumental: boolean;
  cfgScale?: number;
  numSteps?: number;
  custom?: boolean;
}

export const BUILT_IN_PRESETS: MusicPreset[] = [
  {
    id: 'lofi-hiphop',
    name: 'Lo-Fi Hip Hop',
    emoji: '🎧',
    caption: 'Relaxing lo-fi hip hop beat with warm vinyl crackle, mellow piano chords, soft drum loops, jazzy Rhodes, and tape saturation',
    duration: 60,
    bpm: 85,
    instrumental: true,
    cfgScale: 5,
    numSteps: 50,
  },
  {
    id: 'ambient',
    name: 'Ambient',
    emoji: '🌊',
    caption: 'Ethereal ambient soundscape with lush evolving pads, gentle reverb tails, granular atmospheric textures, and slowly morphing harmonic drones',
    duration: 120,
    bpm: 65,
    instrumental: true,
    cfgScale: 8,
    numSteps: 80,
  },
  {
    id: 'rock',
    name: 'Rock',
    emoji: '🎸',
    caption: 'Energetic rock track with crunchy distorted electric guitars, driving punchy drums, deep bass groove, powerful riffs, and raw energy',
    duration: 45,
    bpm: 132,
    instrumental: true,
    cfgScale: 5,
    numSteps: 60,
  },
  {
    id: 'electronic',
    name: 'Electronic',
    emoji: '🎛️',
    caption: 'Modern electronic dance track with pulsing synthesizers, four-on-the-floor kick, arpeggiated leads, sidechained deep bass, and euphoric builds',
    duration: 60,
    bpm: 128,
    instrumental: true,
    cfgScale: 6,
    numSteps: 60,
  },
  {
    id: 'jazz',
    name: 'Jazz',
    emoji: '🎷',
    caption: 'Smooth jazz ensemble with walking upright bass, brushed drums, warm tenor saxophone melody, comping piano, and swing feel',
    duration: 90,
    bpm: 112,
    instrumental: true,
    cfgScale: 7,
    numSteps: 80,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    emoji: '🎬',
    caption: 'Epic cinematic orchestral score with soaring string section, brass fanfare, thunderous timpani, emotional build-up, and dramatic dynamics',
    duration: 90,
    bpm: 90,
    instrumental: true,
    cfgScale: 7,
    numSteps: 80,
  },
  {
    id: 'chillwave',
    name: 'Chillwave',
    emoji: '🌅',
    caption: 'Dreamy chillwave with hazy detuned synths, reverb-drenched guitars, nostalgic 80s vibes, soft beat, and warm analog warmth',
    duration: 60,
    bpm: 95,
    instrumental: true,
    cfgScale: 5,
    numSteps: 50,
  },
  {
    id: 'classical-piano',
    name: 'Klassik Piano',
    emoji: '🎹',
    caption: 'Beautiful classical piano piece with expressive dynamics, romantic harmonies, elegant melodic phrasing, and subtle rubato',
    duration: 90,
    bpm: 76,
    instrumental: true,
    cfgScale: 7,
    numSteps: 80,
  },
  {
    id: 'hiphop-trap',
    name: 'Hip-Hop / Trap',
    emoji: '🔥',
    caption: 'Hard-hitting hip-hop beat with booming 808 bass, crisp hi-hat rolls, snappy snare, dark melodic samples, and trap percussion',
    duration: 60,
    bpm: 90,
    instrumental: true,
    cfgScale: 5,
    numSteps: 50,
  },
  {
    id: 'folk-acoustic',
    name: 'Folk / Acoustic',
    emoji: '🪕',
    caption: 'Warm acoustic folk with fingerpicked guitar, gentle fiddle, soft percussion, harmonica accents, and intimate organic production',
    duration: 60,
    bpm: 105,
    instrumental: false,
    cfgScale: 6,
    numSteps: 60,
  },
];

const CUSTOM_PRESETS_KEY = 'locai-music-presets';

export function loadCustomPresets(): MusicPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: MusicPreset[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}
