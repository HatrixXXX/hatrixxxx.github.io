import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeMusicPlayer } from '../../src/scripts/music-player';

class PlayerElement extends EventTarget {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  inert = false;
  offsetWidth = 380;
  controls = new Map<string, PlayerElement>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  querySelector(selector: string) { return this.controls.get(selector) ?? null; }
  closest() { return null; }
}

function playerFixture(pathname: string) {
  const player = new PlayerElement();
  const panel = new PlayerElement();
  const toggle = new PlayerElement();
  const main = new PlayerElement();
  player.controls.set('[data-player-toggle]', toggle);
  player.controls.set('[data-player-main]', main);
  const location = { pathname };
  const root = Object.assign(new EventTarget(), {
    querySelector: (selector: string) => {
      if (selector === '[data-music-player]') return player;
      if (selector === '[data-home-panel="music"]') return panel;
      return null;
    },
    defaultView: Object.assign(new EventTarget(), { location }),
  }) as unknown as Document;
  return { player, panel, toggle, main, location, root };
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
    expect(source).toContain('prefers-reduced-motion');
    expect(source).toContain('data-player-title');
    expect(source).toContain('data-player-artist');
    expect(source).toContain("data-layout-state={mode === 'home' ? 'pending' : 'ready'}");
    expect(source).toMatch(/\.music-player\[data-display-mode='home'\]\[data-layout-state='pending'\]\s*\{\s*visibility: hidden;\s*transition: none;/);
    expect(source).not.toContain('data-player-mode');
    expect(source).not.toContain('mode-button');
  });

  it('uses fixed random selection and starts each loaded track from the beginning', async () => {
    const source = await readFile('src/scripts/music-player.ts', 'utf8');
    expect(source).toContain('Math.floor(Math.random() * (tracks.length - 1))');
    expect(source).toContain('audio = new Audio()');
    expect(source).toContain('audio!.currentTime = 0');
  });

  it('does not construct Audio for an empty playlist', () => {
    const { root } = playerFixture('/about/');
    expect(initializeMusicPlayer([], root)).toBeUndefined();
    expect(Audio).not.toHaveBeenCalled();
  });

  it('hides the home player until the final panel geometry is committed', () => {
    const { root, player, panel } = playerFixture('/');
    panel.style.left = '12px';
    panel.style.top = '785px';
    panel.style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,12,785,0,1)';
    let committed = false;
    Object.defineProperty(player, 'offsetWidth', {
      get() {
        expect(player.dataset.layoutState).toBe('pending');
        expect(player.style.left).toBe(panel.style.left);
        expect(player.style.top).toBe(panel.style.top);
        expect(player.style.transform).toBe(panel.style.transform);
        committed = true;
        return 380;
      },
    });
    const ready = vi.fn(() => {
      expect(committed).toBe(true);
      expect(player.dataset.layoutState).toBe('ready');
    });
    root.addEventListener('hatrix:player-layout-ready', ready);

    initializeMusicPlayer([], root);

    expect(committed).toBe(true);
    expect(player.dataset.layoutState).toBe('ready');
    expect(player.style.transformOrigin).toBe('0 0');
    expect(ready).toHaveBeenCalledOnce();
  });

  it('keeps the home player pending without a layout panel', () => {
    const { root, player } = playerFixture('/');
    root.querySelector = ((selector: string) => selector === '[data-music-player]' ? player : null) as Document['querySelector'];
    const ready = vi.fn();
    root.addEventListener('hatrix:player-layout-ready', ready);

    initializeMusicPlayer([], root);

    expect(player.dataset.layoutState).toBe('pending');
    expect(ready).not.toHaveBeenCalled();
    expect(Audio).not.toHaveBeenCalled();
  });

  it('clears persisted home geometry before marking the dock ready', () => {
    const { root, player } = playerFixture('/about/');
    player.dataset.layoutState = 'pending';
    Object.assign(player.style, { left: '12px', top: '785px', transform: 'matrix3d(...)', transformOrigin: '0 0' });

    initializeMusicPlayer([], root);

    expect(player.dataset.layoutState).toBe('ready');
    expect(player.dataset.displayMode).toBe('dock');
    expect(player.style).toEqual({ left: '', top: '', transform: '', transformOrigin: '' });
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

  it('marks the persisted player pending before navigation back home', async () => {
    const { root, player } = playerFixture('/about/');
    player.dataset.bound = 'true';
    vi.stubGlobal('document', root);
    vi.resetModules();
    await import('../../src/scripts/music-player');

    root.dispatchEvent(Object.assign(new Event('astro:before-preparation'), { to: new URL('https://hatrix.site/blog/') }));
    expect(player.attributes.get('data-layout-state')).toBeUndefined();
    root.dispatchEvent(Object.assign(new Event('astro:before-preparation'), { to: new URL('https://hatrix.site/') }));
    expect(player.attributes.get('data-layout-state')).toBe('pending');
  });

  it('retains the same Audio instance and track position across home and dock navigation', () => {
    class TestAudio extends EventTarget {
      volume = 0.7;
      currentTime = 0;
      duration = 120;
      paused = true;
      src = '';
      load() {}
      pause() { this.paused = true; }
    }
    vi.stubGlobal('Audio', vi.fn(function () { return new TestAudio(); }));
    const tracks = [{ id: 'track', title: 'Track', artist: 'Artist', src: '/track.mp3' }];
    const { root, player, location } = playerFixture('/');
    const initialAudio = initializeMusicPlayer(tracks, root)!;
    initialAudio.currentTime = 42;

    location.pathname = '/about/';
    expect(initializeMusicPlayer(tracks, root)).toBe(initialAudio);
    expect(player.dataset.uiState).toBe('collapsed');
    location.pathname = '/';
    expect(initializeMusicPlayer(tracks, root)).toBe(initialAudio);
    expect(initialAudio.currentTime).toBe(42);
    expect(Audio).toHaveBeenCalledOnce();
  });
});
