"use client";

import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useStudioStore } from '@/stores/studioStore';

interface AudioEngine {
  player: Tone.Player;
  pitchShift: Tone.PitchShift;
  filters: Tone.BiquadFilter[];
  panner: Tone.Panner;
  volume: Tone.Volume;
  analyser: Tone.Analyser;
}

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);
  const loadedUrlRef = useRef<string | null>(null);
  const playPendingRef = useRef(false);
  const startWallRef = useRef(0);
  const startOffsetRef = useRef(0);

  const store = useStudioStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  // Build the audio graph once
  const getEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;

    const player = new Tone.Player({ autostart: false });
    const pitchShift = new Tone.PitchShift({ pitch: 0 });
    const filters = [60, 250, 1000, 4000, 12000].map(
      (freq) =>
        new Tone.BiquadFilter({
          frequency: freq,
          type: 'peaking',
          gain: 0,
          Q: 1,
        }),
    );
    const panner = new Tone.Panner(0);
    const volume = new Tone.Volume(0);
    const analyser = new Tone.Analyser('fft', 256);

    // Chain: Player → PitchShift → EQ filters → Panner → Volume → Destination
    //                                                             ↘ Analyser
    player.connect(pitchShift);
    let prev: Tone.ToneAudioNode = pitchShift;
    for (const filter of filters) {
      prev.connect(filter);
      prev = filter;
    }
    prev.connect(panner);
    panner.connect(volume);
    volume.connect(Tone.getDestination());
    volume.connect(analyser);

    engineRef.current = { player, pitchShift, filters, panner, volume, analyser };
    return engineRef.current;
  }, []);

  // Start playback helper
  const startPlayback = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !engine.player.loaded) return;

    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    if (engine.player.state !== 'started') {
      const offset = storeRef.current.currentTime;
      engine.player.start(undefined, offset);
    }
  }, []);

  // Load track when activeTrack changes
  useEffect(() => {
    const track = store.activeTrack;
    if (!track) return;
    if (loadedUrlRef.current === track.url) return;

    const engine = getEngine();
    loadedUrlRef.current = track.url;
    playPendingRef.current = false;

    // Stop current playback
    if (engine.player.state === 'started') {
      engine.player.stop();
    }

    storeRef.current.setTrackLoading(true);

    engine.player.load(track.url).then(() => {
      const dur = engine.player.buffer.duration;
      storeRef.current.setDuration(dur);
      storeRef.current.setCurrentTime(0);
      storeRef.current.setTrackLoading(false);

      // If user already pressed play while loading, start now
      if (playPendingRef.current || storeRef.current.playing) {
        playPendingRef.current = false;
        startPlayback();
      }
    }).catch((err) => {
      const message = err instanceof Error ? err.message : 'Track konnte nicht geladen werden';
      storeRef.current.setTrackError(message);
      loadedUrlRef.current = null;
    });
  }, [store.activeTrack, getEngine, startPlayback]);

  // Sync playback state
  useEffect(() => {
    const engine = engineRef.current;

    if (store.playing) {
      if (!engine || !engine.player.loaded) {
        // Track still loading — mark as pending
        playPendingRef.current = true;
        return;
      }
      startPlayback();
    } else {
      playPendingRef.current = false;
      if (engine && engine.player.state === 'started') {
        engine.player.stop();
      }
    }
  }, [store.playing, startPlayback]);

  // Update currentTime via rAF while playing
  useEffect(() => {
    if (!store.playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    startWallRef.current = performance.now();
    startOffsetRef.current = storeRef.current.currentTime;

    const update = () => {
      const rate = storeRef.current.playbackRate;
      const dur = storeRef.current.duration;
      const elapsed = ((performance.now() - startWallRef.current) / 1000) * rate;
      let t = startOffsetRef.current + elapsed;

      // Handle loop
      if (storeRef.current.loopEnabled && storeRef.current.loopEnd > storeRef.current.loopStart) {
        const ls = storeRef.current.loopStart;
        const le = storeRef.current.loopEnd;
        if (t >= le) {
          t = ls;
          // Seek player to loop start
          const engine = engineRef.current;
          if (engine && engine.player.state === 'started') {
            engine.player.stop();
            engine.player.start(undefined, ls);
          }
          // Reset rAF reference point
          startWallRef.current = performance.now();
          startOffsetRef.current = ls;
          storeRef.current.setCurrentTime(ls);
          rafRef.current = requestAnimationFrame(update);
          return;
        }
      }

      if (t >= dur) {
        storeRef.current.setCurrentTime(dur);
        storeRef.current.setPlaying(false);
        return;
      }

      storeRef.current.setCurrentTime(t);
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [store.playing, store.playbackRate, store.loopEnabled, store.loopStart, store.loopEnd]);

  // Sync playback rate
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.player.playbackRate = store.playbackRate;
  }, [store.playbackRate]);

  // Sync pitch
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.pitchShift.pitch = store.pitch;
  }, [store.pitch]);

  // Sync volume
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.volume.volume.value = store.muted ? -Infinity : store.volume;
  }, [store.volume, store.muted]);

  // Sync pan
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.panner.pan.value = store.pan;
  }, [store.pan]);

  // Sync EQ bands
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    store.eqBands.forEach((band, i) => {
      if (engine.filters[i]) {
        engine.filters[i].gain.value = band.gain;
      }
    });
  }, [store.eqBands]);

  // Sync loop on player
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // Tone.Player loop is handled manually in the rAF above
  }, [store.loopEnabled, store.loopStart, store.loopEnd]);

  // Seek function — called when user clicks waveform or transport
  const seek = useCallback((time: number) => {
    const engine = engineRef.current;
    storeRef.current.setCurrentTime(time);

    // Reset rAF reference point so time display stays in sync
    startWallRef.current = performance.now();
    startOffsetRef.current = time;

    if (engine && engine.player.loaded && storeRef.current.playing) {
      engine.player.stop();
      engine.player.start(undefined, time);
    }
  }, []);

  // Get FFT data for visualizer
  const getFrequencyData = useCallback((): Float32Array => {
    const engine = engineRef.current;
    if (!engine) return new Float32Array(128);
    const data = engine.analyser.getValue();
    if (data instanceof Float32Array) return data;
    return new Float32Array(128);
  }, []);

  // Decode waveform peaks from URL
  const getWaveformData = useCallback(async (url: string): Promise<Float32Array> => {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(buffer);
    audioCtx.close();

    const raw = decoded.getChannelData(0);
    const samples = 600;
    const blockSize = Math.floor(raw.length / samples);
    const peaks = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = start; j < start + blockSize && j < raw.length; j++) {
        sum += Math.abs(raw[j]);
      }
      peaks[i] = sum / blockSize;
    }

    const max = Math.max(...peaks);
    if (max > 0) {
      for (let i = 0; i < peaks.length; i++) {
        peaks[i] /= max;
      }
    }

    return peaks;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      const engine = engineRef.current;
      if (engine) {
        engine.player.stop();
        engine.player.dispose();
        engine.pitchShift.dispose();
        engine.filters.forEach((f) => f.dispose());
        engine.panner.dispose();
        engine.volume.dispose();
        engine.analyser.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  return { seek, getFrequencyData, getWaveformData };
}
