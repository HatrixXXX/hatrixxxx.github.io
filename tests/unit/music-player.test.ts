import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeMusicPlayer } from '../../src/scripts/music-player';

class PlayerElement extends EventTarget {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  inert = false;
  controls = new Map<string, PlayerElement>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  querySelector(selector: string) { return this.controls.get(selector) ?? null; }
  closest() { return null; }
}

function playerFixture(pathname: string) {
  const player = new PlayerElement();
  const toggle = new PlayerElement();
  const main = new PlayerElement();
  player.controls.set('[data-player-toggle]', toggle);
  player.controls.set('[data-player-main]', main);
  const location = { pathname };
  const root = {
    querySelector: () => player,
    defaultView: Object.assign(new EventTarget(), { location }),
  } as unknown as Document;
  return { player, toggle, main, location, root };
}

describe('music player', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    vi.stubGlobal('Audio', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders track information, progress, and turntable chrome', async () => {
    const source = await readFile('src/components/MusicPlayer.astro', 'utf8');
    expect(source).toContain('data-player-prev');
    expect(source).toContain('data-player-play');
    expect(source).toContain('data-player-next');
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
    expect(source).not.toContain('data-player-mode');
    expect(source).not.toContain('mode-button');
  });

  it('uses fixed random selection and starts each loaded track from the beginning', async () => {
    const source = await readFile('src/scripts/music-player.ts', 'utf8');
    expect(source).toContain('Math.floor(Math.random() * tracks.length)');
    expect(source).toContain('audio = new Audio()');
    expect(source).toContain('audio!.currentTime = 0');
  });

  it('does not construct Audio for an empty playlist', () => {
    const { root } = playerFixture('/about/');
    expect(initializeMusicPlayer([], root)).toBeUndefined();
    expect(Audio).not.toHaveBeenCalled();
  });

  it('starts every non-home player collapsed and exposes it through the record toggle', () => {
    const { root, player, toggle, main } = playerFixture('/blog/');
    initializeMusicPlayer([], root);
    expect(player.dataset.uiState).toBe('collapsed');
    expect(main.inert).toBe(true);
    toggle.dispatchEvent(new Event('click'));
    expect(player.dataset.uiState).toBe('expanded');
    expect(toggle.attributes.get('aria-expanded')).toBe('true');
    expect(main.inert).toBe(false);
    player.dispatchEvent(new Event('click'));
    expect(player.dataset.uiState).toBe('collapsed');
  });

  it('adapts the persisted player between home and dock without rebinding', () => {
    const { root, player, toggle, location } = playerFixture('/');
    initializeMusicPlayer([], root);
    expect(player.dataset.uiState).toBe('expanded');
    expect(player.dataset.displayMode).toBe('home');
    player.dispatchEvent(new Event('click'));
    toggle.dispatchEvent(new Event('click'));
    expect(player.dataset.uiState).toBe('expanded');

    location.pathname = '/about/';
    initializeMusicPlayer([], root);
    expect(player.dataset.displayMode).toBe('dock');
    expect(player.dataset.uiState).toBe('collapsed');
    toggle.dispatchEvent(new Event('click'));
    expect(player.dataset.uiState).toBe('expanded');

    location.pathname = '/';
    initializeMusicPlayer([], root);
    expect(player.dataset.displayMode).toBe('home');
    expect(player.dataset.uiState).toBe('expanded');
    expect(Audio).not.toHaveBeenCalled();
  });
});
