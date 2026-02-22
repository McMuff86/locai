# LocAI Audio Studio — Vision & Roadmap

## 1. Vision Statement

**LocAI Audio Studio** ist ein AI-native Audio-Workspace, der direkt in LocAI integriert ist. Es verbindet klassische DAW-Funktionalität (Playback, Mixing, Editing) mit lokaler AI-Generierung (Musik, Sprache, Remix) — alles offline, ohne Cloud.

**Was macht es unique?**

- **Generate → Edit → Mix in einem Flow.** Kein Export/Import zwischen Tools. Du generierst einen Track mit ACE-Step, editierst ihn im Studio, legst TTS-Narration drüber, mixt alles zusammen — ohne die App zu verlassen.
- **AI als Co-Producer.** Nicht nur Playback, sondern iteratives Arbeiten: generieren, anhören, Prompt anpassen, Variation erstellen, vergleichen, mixen.
- **100% lokal.** Keine Latenz zu Cloud-APIs, keine Datenschutz-Bedenken. Dein Audio bleibt auf deiner Maschine.
- **Lightweight DAW, nicht Feature-Bloat.** Inspiriert von Ableton/FL Studio, aber reduziert auf das, was in einem AI-Workspace Sinn macht. Keyboard-first, Dark Theme, responsive.

---

## 2. Feature Roadmap

### Phase 1 — Foundation ✅ (teilweise vorhanden)

| Feature | Status | Komponente |
|---|---|---|
| Musik-Generierung (ACE-Step) | ✅ | `MusicGenerator`, `aceStep/client.ts` |
| TTS / Voice Cloning (Qwen3-TTS) | ✅ | `TextToSpeech`, `qwenTTS/client.ts` |
| Basic Playback | ✅ | `AudioPlayer` |
| Waveform Visualisierung | ✅ | `WaveformPlayer` (Canvas, 200-bar peaks) |
| Audio History / Library | ✅ | `AudioHistory` |
| Remix / Repaint Send-to | ✅ | `onSendToRemix`, `onSendToRepaint` |

**Verbleibend:** Stabilisierung, UX-Polish, konsistente Fehlerbehandlung.

### Phase 2 — Studio Controls (~ 3-4 Wochen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| Speed Control | Playback-Rate 0.25x–4x via `playbackRate` | S |
| Pitch Control | `PitchShifterNode` (AudioWorklet) oder Tonejs `PitchShift` | M |
| Loop / Region Selection | Click+Drag auf Waveform → Loop-Region, A/B-Punkte | M |
| Volume / Pan | `GainNode` + `StereoPannerNode` per Track | S |
| Parametric Equalizer | 3–5 Band EQ mit `BiquadFilterNode`, interaktive Kurve | L |
| Keyboard Shortcuts | Space=Play/Pause, L=Loop, ←/→=Seek, +/-=Zoom | S |

**Geschätzter Aufwand Phase 2:** ~80–100h

### Phase 3 — Mixing & Editing (~ 6-8 Wochen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| Multi-Track Timeline | Horizontale Timeline mit N Tracks, Zoom, Scroll | XL |
| Track Mixer | Volume, Pan, Mute/Solo pro Track, Master Bus | L |
| Basic Editing | Cut, Trim, Fade In/Out via `OfflineAudioContext` | L |
| Crossfade | Overlap-Regions mit automatischem Crossfade | M |
| Export Mix | Render via `OfflineAudioContext` → WAV/MP3 (lamejs) | M |
| Undo/Redo | Command-Pattern für alle Edit-Operationen | M |

**Geschätzter Aufwand Phase 3:** ~200–260h

### Phase 4 — AI-Enhanced (~ 4-6 Wochen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| Prompt-to-Music Iteration | Generate → Listen → Tweak Prompt → Regenerate Loop | M |
| AI Remix | Track an ACE-Step senden als Audio-Prompt für Variation | M |
| AI Audio Description | Audio an LLM/Whisper schicken → Text-Beschreibung | M |
| A/B Comparison | Zwei Tracks nebeneinander abspielen + switchen | M |
| Stem Separation | Vocals/Instruments trennen (braucht Backend, z.B. Demucs) | L |

**Geschätzter Aufwand Phase 4:** ~120–160h

### Phase 5 — Advanced (~ 4-6 Wochen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| Spectrogram View | FFT-basiertes Spectrogram via `AnalyserNode` + Canvas/WebGL | L |
| BPM Detection | Onset-Detection-Algorithmus oder Web Worker | M |
| MIDI Integration | Optional: MIDI-Input für Trigger/Control (Web MIDI API) | L |
| Drag & Drop Export | Tracks aus Studio per DnD in Chat/Documents/Flow ziehen | M |
| Plugin System | API für custom Audio-Effekte als AudioWorklet-Module | XL |

**Geschätzter Aufwand Phase 5:** ~160–220h

---

## 3. Technologie-Stack

### Core

| Technologie | Zweck |
|---|---|
| **Web Audio API** | Playback, Routing, Analyse, Effects, Offline-Rendering |
| **AudioWorklet** | Custom DSP (Pitch Shift, Custom Effects) |
| **Canvas 2D** | Waveform, Timeline (bereits in WaveformPlayer) |
| **WebGL** (optional) | Spectrogram, grosse Timelines mit vielen Tracks |
| **OfflineAudioContext** | Non-Realtime Rendering für Export und Editing |

### Empfohlene Packages

| Package | Zweck | Empfehlung |
|---|---|---|
| **tone.js** | High-level Audio-Framework, Transport, Effects, Scheduling | ⭐ Stark empfohlen für Phase 2-3. Abstrahiert Web Audio API sauber. |
| **lamejs** | MP3-Encoding im Browser | Für Export |
| **audiobuffer-to-wav** | WAV-Encoding | Für Export |
| **detect-pitch** / **essentia.js** | Pitch/BPM Detection | Phase 5 |

**Bewusst NICHT empfohlen:**
- **wavesurfer.js** — Wir haben bereits einen Custom-Waveform-Renderer. wavesurfer.js bringt zu viel Overhead und ist schwer in eine Custom-Timeline zu integrieren. Besser: eigene Canvas-Lösung weiterentwickeln.

### Bestehende Infrastruktur (nutzen)

- **Zustand** — State Management für Studio-State (Tracks, Mixer, Transport)
- **IndexedDB** — Audio-File-Cache und Projekt-Persistenz
- **Shadcn/UI + Radix** — UI-Komponenten (Slider, Dropdown, Tabs)
- **Framer Motion** — Animationen für UI-Transitions

---

## 4. Component Architecture

```
src/components/audio-studio/
├── AudioStudio.tsx                 # Main container, Layout, State Provider
├── transport/
│   ├── TransportBar.tsx            # Play/Pause/Stop/Record, BPM, Time Display
│   └── TransportControls.tsx       # Speed, Loop, Metronome Toggle
├── player/
│   ├── StudioPlayer.tsx            # Enhanced single-track player
│   ├── WaveformDisplay.tsx         # Canvas waveform (evolved from WaveformPlayer)
│   └── RegionSelector.tsx          # Loop/Selection overlay on waveform
├── timeline/
│   ├── Timeline.tsx                # Multi-track horizontal timeline
│   ├── TimelineTrack.tsx           # Single track lane
│   ├── TimelineClip.tsx            # Audio clip within a track
│   ├── TimelineRuler.tsx           # Time ruler with zoom
│   └── TimelineCursor.tsx          # Playhead
├── mixer/
│   ├── MixerPanel.tsx              # Vertical mixer strips
│   ├── MixerStrip.tsx              # Single channel: fader, pan, mute/solo
│   └── MasterStrip.tsx             # Master output
├── effects/
│   ├── Equalizer.tsx               # Parametric EQ with interactive curve
│   ├── EffectChain.tsx             # Per-track effect stack
│   └── EffectSlot.tsx              # Single effect with bypass
├── visualizer/
│   ├── Visualizer.tsx              # Container for viz modes
│   ├── FrequencyBars.tsx           # Real-time frequency display
│   └── Spectrogram.tsx             # FFT spectrogram (Phase 5)
├── generation/
│   ├── GenerationPanel.tsx         # ACE-Step + TTS unified UI
│   ├── PromptIterator.tsx          # Generate → Listen → Tweak → Regenerate
│   └── ABComparison.tsx            # Side-by-side track comparison
├── export/
│   ├── ExportPanel.tsx             # Format, quality, metadata
│   └── ExportEngine.ts             # OfflineAudioContext rendering
├── hooks/
│   ├── useAudioEngine.ts           # Core Web Audio graph management
│   ├── useTransport.ts             # Play state, position, loop points
│   ├── useMixer.ts                 # Track volumes, pans, mutes
│   └── useWaveform.ts              # Waveform data extraction
└── store/
    └── studioStore.ts              # Zustand store for studio state
```

### State Management

```typescript
// studioStore.ts — Zustand
interface StudioState {
  // Transport
  playing: boolean;
  position: number;        // seconds
  bpm: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;

  // Tracks
  tracks: Track[];
  selectedTrackId: string | null;

  // Mixer
  masterVolume: number;
  masterPan: number;

  // UI
  zoom: number;            // pixels per second
  viewMode: 'player' | 'timeline' | 'mixer';
}

interface Track {
  id: string;
  name: string;
  audioUrl: string;
  volume: number;          // 0–1
  pan: number;             // -1 to 1
  muted: boolean;
  solo: boolean;
  clips: Clip[];
  effects: Effect[];
}
```

---

## 5. UX / Design-Richtung

### Grundprinzipien

- **Dark Theme** — Konsistent mit LocAI. Dunkle Backgrounds (`zinc-900/950`), farbige Akzente für Waveforms, Clip-Farben, aktive Elemente.
- **DAW-inspiriert, simplified** — Nicht 500 Buttons wie Ableton. Stattdessen: progressive disclosure. Einfacher Player → Studio View → Timeline View.
- **Keyboard-first** — Jede Aktion hat einen Shortcut. `Space`=Play, `L`=Loop, `M`=Mute, `S`=Solo, `Cmd+Z`=Undo, `Cmd+E`=Export.
- **Responsive** — Funktioniert im Fullscreen und als schmales Panel im Agent Workspace. Timeline scrollt horizontal, Mixer kann als Overlay eingeblendet werden.

### View Modes

1. **Player Mode** — Einzelner Track, grosse Waveform, grundlegende Controls. Standard-Ansicht.
2. **Studio Mode** — Player + Equalizer + Effects + Generation Panel. Für Detailarbeit an einem Track.
3. **Timeline Mode** — Multi-Track Timeline + Mixer. Für Mixing-Sessions.

### Farbschema für Audio-Elemente

| Element | Farbe |
|---|---|
| Waveform (played) | `emerald-400` |
| Waveform (unplayed) | `zinc-600` |
| Loop Region | `amber-500/20` overlay |
| Selection | `blue-500/20` overlay |
| Track Clips | Pro Track verschiedene Farben (`emerald`, `blue`, `violet`, `amber`) |
| Playhead | `white` / `red-500` (recording) |

---

## 6. Aufwand-Schätzung Gesamt

| Phase | Zeitraum | Stunden | Voraussetzung |
|---|---|---|---|
| **Phase 1** — Foundation | ✅ Done | — | — |
| **Phase 2** — Studio Controls | 3–4 Wochen | 80–100h | — |
| **Phase 3** — Mixing & Editing | 6–8 Wochen | 200–260h | Phase 2 |
| **Phase 4** — AI-Enhanced | 4–6 Wochen | 120–160h | Phase 2, teilw. Phase 3 |
| **Phase 5** — Advanced | 4–6 Wochen | 160–220h | Phase 3 |
| **Total** | | **~560–740h** | |

### Empfohlene Reihenfolge

Phase 2 ist der logische nächste Schritt — es baut auf dem existierenden `WaveformPlayer` auf und liefert sofort spürbare UX-Verbesserungen. Phase 4 (AI-Enhanced) kann teilweise parallel zu Phase 3 entwickelt werden, da Features wie Prompt-Iteration und A/B-Vergleich unabhängig vom Multi-Track-System sind.

### Quick Wins (sofort umsetzbar)

1. **Speed Control** — Eine Zeile Code (`audio.playbackRate = value`), grosser UX-Gewinn
2. **Volume/Pan** — `GainNode` + `StereoPannerNode`, einfach zu implementieren
3. **Keyboard Shortcuts** — Event-Listener, kein Audio-Code nötig
4. **A/B Comparison** — Zwei Player nebeneinander, minimal neue Logik
