import { playlist } from '../data/playlist';
import { shuffleQuoteOrder } from '../lib/quote-order';
import type { Track } from '../types/content';

const STORAGE_KEY = 'hatrix-player';
const RECORD_CLICK_DELAY = 320;
const RECORD_SWAP_MIDPOINT = 440;
const RECORD_SWAP_DURATION = 720;
const PAUSE_FADE_DURATION = 500;
const PLAYER_VOLUME = 0.7;
let audio: HTMLAudioElement | undefined;

function readTrackIndex(): number {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { index?: number };
    return Number.isInteger(value.index) ? Math.max(0, value.index!) : 0;
  } catch {
    return 0;
  }
}

function saveTrackIndex(index: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index }));
  } catch {
    // Storage is optional.
  }
}

function setExpanded(player: HTMLElement, expanded: boolean): void {
  const isHome = player.dataset.displayMode === 'home';
  const nextState = isHome || expanded;
  player.dataset.uiState = nextState ? 'expanded' : 'collapsed';
  const main = player.querySelector<HTMLElement>('[data-player-main]');
  if (main) main.inert = !nextState;
  const toggle = player.querySelector<HTMLButtonElement>('[data-player-toggle]');
  toggle?.setAttribute('aria-expanded', String(nextState));
  toggle?.setAttribute('aria-label', nextState ? '收起音乐播放器' : '展开音乐播放器');
}

export function synchronizeMusicPlayerLayout(
  player: HTMLElement,
  root: Document,
  pathname: string | undefined,
): void {
  const mode = pathname ? (pathname === '/' ? 'home' : 'dock') : player.dataset.displayMode ?? 'dock';
  player.dataset.displayMode = mode;
  if (mode === 'home') {
    player.dataset.layoutState = 'pending';
    const panel = root.querySelector<HTMLElement>('[data-home-panel="music"]');
    if (!panel) return;
    player.style.left = panel.style.left || '0px';
    player.style.top = panel.style.top || '0px';
    player.style.transform = panel.style.transform || '';
    player.style.transformOrigin = '0 0';
    void player.offsetWidth;
  } else {
    player.style.left = '';
    player.style.top = '';
    player.style.transform = '';
    player.style.transformOrigin = '';
  }
  player.dataset.layoutState = 'ready';
  root.dispatchEvent?.(new CustomEvent('hatrix:player-layout-ready'));
}

export function initializeMusicPlayer(
  tracks: readonly Track[] = playlist,
  root: Document = document,
): HTMLAudioElement | undefined {
  if (!root || typeof root.querySelector !== 'function') return undefined;

  const player = root.querySelector<HTMLElement>('[data-music-player]');
  if (!player) return audio;

  const pathname = root.defaultView?.location.pathname;
  const mode = pathname ? (pathname === '/' ? 'home' : 'dock') : player.dataset.displayMode ?? 'dock';
  const changedPage = player.dataset.playerPath !== pathname;
  player.dataset.displayMode = mode;
  if (changedPage || player.dataset.bound !== 'true' || mode === 'home') {
    setExpanded(player, mode === 'home');
  }
  if (pathname) player.dataset.playerPath = pathname;

  synchronizeMusicPlayerLayout(player, root, pathname);

  if (player.dataset.bound === 'true') return audio;
  player.dataset.bound = 'true';

  const toggle = player.querySelector<HTMLButtonElement>('[data-player-toggle]');
  const record = player.querySelector<HTMLButtonElement>('[data-player-record]');
  const trackLabel = player.querySelector<HTMLElement>('[data-player-track]');
  toggle?.addEventListener('click', () => setExpanded(player, player.dataset.uiState !== 'expanded'));
  player.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (target?.closest('button, a')) return;
    if (player.dataset.displayMode === 'dock' && player.dataset.uiState === 'expanded') {
      setExpanded(player, false);
    }
  });
  root.addEventListener?.call(root, 'click', (event: Event) => {
    if (player.dataset.displayMode !== 'dock' || player.dataset.uiState !== 'expanded') return;
    if (!player.contains((event as MouseEvent).target as Node | null)) setExpanded(player, false);
  });
  root.defaultView?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && player.dataset.displayMode === 'dock') {
      const focusWasInside = player.contains(root.activeElement);
      setExpanded(player, false);
      if (focusWasInside) toggle?.focus();
    }
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') player.dataset.inputMode = 'keyboard';
  });
  for (const eventName of ['pointerenter', 'pointerleave', 'pointerdown']) {
    record?.addEventListener(eventName, () => { player.dataset.inputMode = 'pointer'; });
  }

  player.dataset.playbackState = 'paused';
  if (!tracks.length) {
    record?.setAttribute('aria-label', '歌单待添加');
    if (record) record.disabled = true;
    return undefined;
  }

  let index = Math.min(readTrackIndex(), tracks.length - 1);
  const indices = tracks.map((_, trackIndex) => trackIndex);
  let order = shuffleQuoteOrder(indices.filter((trackIndex) => trackIndex !== index));
  audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = PLAYER_VOLUME;
  const playerAudio = audio;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let midpointTimer: ReturnType<typeof setTimeout> | undefined;
  let nextPlayTimer: ReturnType<typeof setTimeout> | undefined;
  let pauseFadeTimer: ReturnType<typeof setInterval> | undefined;
  let swapInProgress = false;

  const clearPauseFade = (): void => {
    if (pauseFadeTimer !== undefined) clearInterval(pauseFadeTimer);
    pauseFadeTimer = undefined;
  };
  const cancelPauseFade = (): void => {
    clearPauseFade();
    playerAudio.volume = PLAYER_VOLUME;
  };
  const pauseWithFade = (): void => {
    const startedAt = Date.now();
    const startVolume = playerAudio.volume;
    pauseFadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / PAUSE_FADE_DURATION);
      playerAudio.volume = Math.max(0, startVolume * (1 - progress));
      if (progress < 1) return;
      clearPauseFade();
      playerAudio.pause();
    }, 20);
  };

  const setPlaying = (playing: boolean): void => {
    if (playing && trackLabel) {
      trackLabel.textContent = `${tracks[index]!.title}-${tracks[index]!.artist}`;
    }
    player.dataset.playbackState = playing ? 'playing' : 'paused';
    record?.setAttribute('aria-pressed', String(playing));
    record?.setAttribute('aria-label', playing ? '暂停唱片，双击随机下一曲' : '播放唱片，双击随机下一曲');
  };
  const play = (): void => {
    cancelPauseFade();
    playerAudio.preload = 'auto';
    void playerAudio.play().catch(() => {
      setPlaying(false);
      if (trackLabel) trackLabel.textContent = '播放失败，请重试';
    });
  };
  const load = (nextIndex: number): void => {
    index = nextIndex;
    const track = tracks[index]!;
    clearPauseFade();
    playerAudio.pause();
    playerAudio.src = track.src;
    playerAudio.load();
    playerAudio.currentTime = 0;
    playerAudio.volume = PLAYER_VOLUME;
    player.dataset.recordVariant = String(index % 3);
    if (trackLabel) trackLabel.textContent = `${track.title}-${track.artist}`;
    saveTrackIndex(index);
  };
  const advanceTrack = (): void => {
    clearTimeout(clickTimer);
    clickTimer = undefined;
    clearTimeout(midpointTimer);
    clearTimeout(nextPlayTimer);
    if (order.length === 0) order = shuffleQuoteOrder(indices, index);
    const nextIndex = order.shift() ?? index;
    swapInProgress = true;
    clearPauseFade();
    playerAudio.pause();
    player.dataset.playbackState = 'changing';
    record?.setAttribute('aria-pressed', 'false');
    record?.setAttribute('aria-label', '正在更换唱片');
    if (player.dataset.uiState === 'collapsed' || root.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      load(nextIndex);
      swapInProgress = false;
      play();
      return;
    }
    player.dataset.recordSwap = 'true';
    if (record) record.disabled = true;
    midpointTimer = setTimeout(() => {
      midpointTimer = undefined;
      load(nextIndex);
    }, RECORD_SWAP_MIDPOINT);
    nextPlayTimer = setTimeout(() => {
      nextPlayTimer = undefined;
      delete player.dataset.recordSwap;
      if (record) record.disabled = false;
      swapInProgress = false;
      play();
    }, RECORD_SWAP_DURATION);
  };

  const togglePlayback = (): void => {
    if (swapInProgress) return;
    if (pauseFadeTimer !== undefined) {
      cancelPauseFade();
      return;
    }
    if (playerAudio.paused) {
      play();
    } else {
      pauseWithFade();
    }
  };

  playerAudio.addEventListener('play', () => setPlaying(true));
  playerAudio.addEventListener('waiting', () => {
    if (playerAudio.paused || swapInProgress) return;
    player.dataset.playbackState = 'buffering';
    record?.setAttribute('aria-label', '正在缓冲，单击暂停');
    if (trackLabel) trackLabel.textContent = `正在缓冲 · ${tracks[index]!.title}-${tracks[index]!.artist}`;
  });
  playerAudio.addEventListener('playing', () => setPlaying(true));
  playerAudio.addEventListener('pause', () => {
    clearPauseFade();
    if (!swapInProgress) setPlaying(false);
  });
  playerAudio.addEventListener('ended', advanceTrack);
  playerAudio.addEventListener('error', () => {
    clearPauseFade();
    setPlaying(false);
    if (trackLabel) trackLabel.textContent = '音频无法加载';
  });
  record?.addEventListener('click', (event) => {
    if (swapInProgress || record.disabled) return;
    if ((event as MouseEvent).detail >= 2) {
      clearTimeout(clickTimer);
      clickTimer = undefined;
      advanceTrack();
      return;
    }
    if (pauseFadeTimer !== undefined) {
      cancelPauseFade();
      return;
    }
    if ((event as MouseEvent).detail === 0) {
      togglePlayback();
      return;
    }
    if (!playerAudio.paused) {
      pauseWithFade();
      return;
    }
    if (clickTimer !== undefined) {
      clearTimeout(clickTimer);
      clickTimer = undefined;
      advanceTrack();
      return;
    }
    clickTimer = setTimeout(() => {
      clickTimer = undefined;
      togglePlayback();
    }, RECORD_CLICK_DELAY);
  });
  record?.addEventListener('keydown', (event) => {
    if (swapInProgress || record.disabled) return;
    if (event.shiftKey && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      clearTimeout(clickTimer);
      clickTimer = undefined;
      advanceTrack();
    }
  });

  setPlaying(false);
  load(index);
  return playerAudio;
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:before-swap', (raw) => {
    const to = (raw as unknown as { to?: URL }).to;
    if (to?.pathname === '/') {
      document.querySelector<HTMLElement>('[data-music-player]')?.setAttribute('data-layout-state', 'pending');
    }
  });
  document.addEventListener('astro:after-swap', () => { void initializeMusicPlayer(); });
  document.addEventListener('astro:page-load', () => { void initializeMusicPlayer(); });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void initializeMusicPlayer();
  });
  initializeMusicPlayer();
}
