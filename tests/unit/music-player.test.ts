import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { nextMode, initializeMusicPlayer } from '../../src/scripts/music-player';

describe('music player', () => {
  it('renders track information, progress, and turntable chrome', async () => {
    const source = await readFile('src/components/MusicPlayer.astro', 'utf8');
    expect(source).toContain('data-player-prev');
    expect(source).toContain('data-player-play');
    expect(source).toContain('data-player-next');
    expect(source).toContain('data-player-mode');
    expect(source).toContain('data-player-volume');
    expect(source).toContain('data-player-progress');
    expect(source).toContain('data-player-current-time');
    expect(source).toContain('data-player-duration');
    expect(source).toContain('data-turntable-record');
    expect(source).toContain('data-turntable-tonearm');
    expect(source).toContain('data-turntable-pivot');
    expect(source).toContain('data-turntable-post');
    expect(source).toContain('prefers-reduced-motion');
    expect(source).toContain('data-player-title');
    expect(source).toContain('data-player-artist');
    expect(source).toContain('.mode-button {');
    expect(source).toContain('border: 1px solid #ffffff22;');
  });

  it('cycles modes list, shuffle, single', () => {
    expect(nextMode('list')).toBe('shuffle');
    expect(nextMode('shuffle')).toBe('single');
    expect(nextMode('single')).toBe('list');
  });

  it('does not construct Audio for an empty playlist', () => {
    expect(initializeMusicPlayer([], {} as Document)).toBeUndefined();
  });
});
