import { playlist } from '../data/playlist';
import type { Track } from '../types/content';

type Preferences = {
  volume: number;
  index: number;
};

const STORAGE_KEY = 'hatrix-player';
let audio: HTMLAudioElement | undefined;

function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Preferences>;

    return {
      volume: Math.max(0, Math.min(1, typeof value.volume === 'number' ? value.volume : 0.7)),
      index: Number.isInteger(value.index) ? Math.max(0, value.index as number) : 0,
    };
  } catch {
    return { volume: 0.7, index: 0 };
  }
}

function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage is optional.
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
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

  if (player.dataset.bound === 'true') {
    return audio;
  }

  player.dataset.bound = 'true';

  const preferences = readPreferences();
  const volume = player.querySelector<HTMLInputElement>('[data-player-volume]');
  const progress = player.querySelector<HTMLInputElement>('[data-player-progress]');
  const currentTimeLabel = player.querySelector<HTMLElement>('[data-player-current-time]');
  const durationLabel = player.querySelector<HTMLElement>('[data-player-duration]');
  const toggle = player.querySelector<HTMLButtonElement>('[data-player-toggle]');
  const collapse = player.querySelector<HTMLButtonElement>('[data-player-collapse]');
  const previous = player.querySelector<HTMLButtonElement>('[data-player-prev]');
  const playButton = player.querySelector<HTMLButtonElement>('[data-player-play]');
  const next = player.querySelector<HTMLButtonElement>('[data-player-next]');
  const title = player.querySelector<HTMLElement>('[data-player-title]');
  const artist = player.querySelector<HTMLElement>('[data-player-artist]');
  const state = {
    volume: preferences.volume,
  };

  if (volume) volume.value = String(preferences.volume);
  if (progress) {
    progress.value = '0';
    progress.style.setProperty('--played', '0%');
  }
  if (currentTimeLabel) currentTimeLabel.textContent = '0:00';
  if (durationLabel) durationLabel.textContent = '0:00';
  let index = Math.max(0, preferences.index);

  const saveState = (): void => {
    savePreferences({
      volume: state.volume,
      index,
    });
  };

  toggle?.addEventListener('click', () => setExpanded(player, player.dataset.uiState !== 'expanded'));
  collapse?.addEventListener('click', () => {
    setExpanded(player, false);
    toggle?.focus();
  });
  player.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (target?.closest('button, input, label, a')) return;
    if (player.dataset.displayMode === 'dock' && player.dataset.uiState === 'expanded') {
      setExpanded(player, false);
    }
  });
  root.defaultView?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && player.dataset.displayMode === 'dock') {
      const focusWasInside = player.contains(root.activeElement);
      setExpanded(player, false);
      if (focusWasInside) toggle?.focus();
    }
  });

  if (!tracks.length) return undefined;

  index = Math.min(index, tracks.length - 1);

  const advanceTrack = (): void => {
    load(Math.floor(Math.random() * tracks.length));
    void audio!.play().catch(() => undefined);
  };

  const syncProgress = (): void => {
    const current = Number.isFinite(audio!.currentTime) ? Math.max(0, audio!.currentTime) : 0;
    const duration = Number.isFinite(audio!.duration) && audio!.duration > 0 ? audio!.duration : 0;
    const safeCurrent = duration > 0 ? Math.min(current, duration) : current;

    if (progress) {
      progress.max = String(duration);
      progress.value = String(safeCurrent);
      progress.style.setProperty('--played', duration > 0 ? `${(safeCurrent / duration) * 100}%` : '0%');
    }
    if (currentTimeLabel) currentTimeLabel.textContent = formatTime(safeCurrent);
    if (durationLabel) durationLabel.textContent = formatTime(duration);
  };

  const bindAudioEvents = (element: HTMLAudioElement): void => {
    element.addEventListener('play', () => {
      player.dataset.playbackState = 'playing';
      playButton?.setAttribute('aria-pressed', 'true');
      playButton?.setAttribute('aria-label', '暂停');
      syncProgress();
    });

    element.addEventListener('pause', () => {
      player.dataset.playbackState = 'paused';
      playButton?.setAttribute('aria-pressed', 'false');
      playButton?.setAttribute('aria-label', '播放');
      syncProgress();
    });

    element.addEventListener('loadedmetadata', syncProgress);
    element.addEventListener('durationchange', syncProgress);
    element.addEventListener('timeupdate', syncProgress);
    element.addEventListener('seeked', syncProgress);
    element.addEventListener('ended', () => {
      advanceTrack();
    });
  };

  const load = (nextIndex: number): void => {
    index = (nextIndex + tracks.length) % tracks.length;
    const track = tracks[index]!;
    const nextVolume = audio?.volume ?? state.volume;

    audio?.pause();
    audio = new Audio();
    audio.volume = nextVolume;
    bindAudioEvents(audio);
    audio.src = track.src;
    audio.load();
    audio!.currentTime = 0;
    if (title) {
      title.textContent = track.title;
      title.title = track.title;
    }
    if (artist) {
      artist.textContent = track.artist;
      artist.title = track.artist;
    }

    syncProgress();
    saveState();
  };

  if (progress) {
    progress.addEventListener('input', () => {
      const nextTime = Number(progress.value);
      if (Number.isFinite(nextTime)) {
        audio!.currentTime = Math.max(0, nextTime);
        syncProgress();
      }
    });
  }

  volume?.addEventListener('input', () => {
    state.volume = Number(volume.value);
    audio!.volume = state.volume;
    saveState();
  });

  playButton?.addEventListener('click', () => {
    if (audio!.paused) void audio!.play().catch(() => undefined);
    else audio!.pause();
  });

  previous?.addEventListener('click', advanceTrack);
  next?.addEventListener('click', advanceTrack);

  load(index);
  return audio;
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', () => {
    void initializeMusicPlayer();
  });
  initializeMusicPlayer();
}
