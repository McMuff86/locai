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
    caption: 'Relaxing lo-fi hip hop beat with warm vinyl crackle, mellow piano chords, soft drum loops, and jazzy Rhodes',
    duration: 60,
    bpm: 85,
    instrumental: true,
    cfgScale: 5,
  },
  {
    id: 'ambient',
    name: 'Ambient',
    emoji: '🌊',
    caption: 'Ethereal ambient soundscape with lush pads, gentle reverb, atmospheric textures, and slowly evolving drones',
    duration: 120,
    bpm: 70,
    instrumental: true,
    cfgScale: 7,
  },
  {
    id: 'rock',
    name: 'Rock',
    emoji: '🎸',
    caption: 'Energetic rock track with driving electric guitars, punchy drums, bass groove, and powerful riffs',
    duration: 45,
    bpm: 130,
    instrumental: true,
    cfgScale: 5,
  },
  {
    id: 'electronic',
    name: 'Electronic',
    emoji: '🎹',
    caption: 'Modern electronic dance music with pulsing synths, four-on-the-floor kick, arpeggiated leads, and deep bass',
    duration: 60,
    bpm: 128,
    instrumental: true,
    cfgScale: 5,
  },
  {
    id: 'jazz',
    name: 'Jazz',
    emoji: '🎷',
    caption: 'Smooth jazz ensemble with walking bass, brushed drums, warm saxophone melody, and comping piano',
    duration: 60,
    bpm: 110,
    instrumental: true,
    cfgScale: 6,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    emoji: '🎬',
    caption: 'Epic cinematic orchestral score with soaring strings, brass fanfare, timpani, and emotional build-up',
    duration: 90,
    bpm: 90,
    instrumental: true,
    cfgScale: 7,
  },
  {
    id: 'chillwave',
    name: 'Chillwave',
    emoji: '🌅',
    caption: 'Dreamy chillwave with hazy synths, reverb-drenched guitars, nostalgic 80s vibes, and soft beat',
    duration: 60,
    bpm: 95,
    instrumental: true,
    cfgScale: 5,
  },
  {
    id: 'classical-piano',
    name: 'Klassik Piano',
    emoji: '🎹',
    caption: 'Beautiful classical piano piece with expressive dynamics, romantic harmonies, and elegant melodic phrasing',
    duration: 90,
    bpm: 80,
    instrumental: true,
    cfgScale: 6,
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
