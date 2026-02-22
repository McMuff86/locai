"use client";

import { useRef, useState, useEffect, useCallback } from 'react';

/** Return type for the {@link useAudioPlayback} hook. */
export interface UseAudioPlaybackReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  loop: boolean;
  togglePlay: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleLoop: () => void;
}

/**
 * React hook that manages HTML audio element playback state.
 * Provides play/pause toggle, seek, playback rate control, and looping.
 *
 * @param src - URL of the audio source to play.
 * @returns Playback state and control functions.
 */
export function useAudioPlayback(src: string): UseAudioPlaybackReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // Reset state when src changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  const toggleLoop = useCallback(() => {
    const audio = audioRef.current;
    const newLoop = !loop;
    if (audio) audio.loop = newLoop;
    setLoop(newLoop);
  }, [loop]);

  return {
    audioRef,
    playing,
    currentTime,
    duration,
    playbackRate,
    loop,
    togglePlay,
    seek,
    setPlaybackRate,
    toggleLoop,
  };
}
