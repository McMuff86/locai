import { create } from 'zustand';

interface EqBand {
  frequency: number;
  gain: number;
  Q: number;
}

const DEFAULT_EQ_BANDS: EqBand[] = [
  { frequency: 60, gain: 0, Q: 1 },
  { frequency: 250, gain: 0, Q: 1 },
  { frequency: 1000, gain: 0, Q: 1 },
  { frequency: 4000, gain: 0, Q: 1 },
  { frequency: 12000, gain: 0, Q: 1 },
];

interface StudioState {
  // Track
  activeTrack: { url: string; title: string } | null;
  trackLoading: boolean;
  trackError: string | null;

  // Transport
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;

  // Pitch
  pitch: number;

  // Loop
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;

  // Mixer
  volume: number;
  pan: number;
  muted: boolean;

  // EQ
  eqBands: EqBand[];

  // UI
  waveformZoom: number;

  // Actions
  loadTrack: (url: string, title: string) => void;
  setTrackLoading: (l: boolean) => void;
  setTrackError: (e: string | null) => void;
  setPlaying: (p: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setPlaybackRate: (r: number) => void;
  setPitch: (p: number) => void;
  setLoopEnabled: (l: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setVolume: (v: number) => void;
  setPan: (p: number) => void;
  setMuted: (m: boolean) => void;
  setEqBand: (index: number, gain: number) => void;
  setWaveformZoom: (z: number) => void;
  reset: () => void;
}

const initialState = {
  activeTrack: null,
  trackLoading: false,
  trackError: null as string | null,
  playing: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  pitch: 0,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 0,
  volume: 0,
  pan: 0,
  muted: false,
  eqBands: DEFAULT_EQ_BANDS,
  waveformZoom: 100,
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,

  loadTrack: (url, title) =>
    set({
      ...initialState,
      activeTrack: { url, title },
      trackLoading: true,
      trackError: null,
    }),

  setTrackLoading: (trackLoading) => set({ trackLoading }),
  setTrackError: (trackError) => set({ trackError, trackLoading: false }),
  setPlaying: (playing) => set({ playing }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setPitch: (pitch) => set({ pitch }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setLoopRegion: (loopStart, loopEnd) => set({ loopStart, loopEnd }),
  setVolume: (volume) => set({ volume }),
  setPan: (pan) => set({ pan }),
  setMuted: (muted) => set({ muted }),

  setEqBand: (index, gain) =>
    set((state) => ({
      eqBands: state.eqBands.map((band, i) =>
        i === index ? { ...band, gain } : band,
      ),
    })),

  setWaveformZoom: (waveformZoom) => set({ waveformZoom }),

  reset: () => set(initialState),
}));
