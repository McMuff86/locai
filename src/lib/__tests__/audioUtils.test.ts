import { describe, it, expect } from 'vitest';
import { formatTime, extractFilename } from '../audio-utils';

describe('formatTime', () => {
  it('formats 0 seconds', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats 65 seconds as 1:05', () => {
    expect(formatTime(65)).toBe('1:05');
  });

  it('formats 3661 seconds as 61:01', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('formats fractional seconds (floors)', () => {
    expect(formatTime(9.9)).toBe('0:09');
  });

  it('handles NaN gracefully', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('handles Infinity gracefully', () => {
    expect(formatTime(Infinity)).toBe('0:00');
  });

  it('handles negative values gracefully', () => {
    expect(formatTime(-5)).toBe('0:00');
  });

  it('pads single-digit seconds', () => {
    expect(formatTime(3)).toBe('0:03');
  });
});

describe('extractFilename', () => {
  it('extracts filename from API path', () => {
    expect(extractFilename('/api/audio/my-file.flac')).toBe('my-file.flac');
  });

  it('extracts filename from simple path', () => {
    expect(extractFilename('/file.mp3')).toBe('file.mp3');
  });

  it('decodes URL-encoded characters', () => {
    expect(extractFilename('/api/audio/my%20file.wav')).toBe('my file.wav');
  });

  it('returns fallback for empty path', () => {
    expect(extractFilename('/')).toBe('audio.flac');
  });

  it('handles bare filename', () => {
    expect(extractFilename('song.mp3')).toBe('song.mp3');
  });
});
