import { playlist } from '../data/playlist';
import type { Track } from '../types/content';

export type PlaybackMode = 'list' | 'shuffle' | 'single';

type Preferences = {
  volume: number;
  mode: PlaybackMode;
  index: number;
  expanded: boolean;
};

const STORAGE_KEY = 'hatrix-player';
const MODES: PlaybackMode[] = ['list', 'shuffle', 'single'];
let audio: HTMLAudioElement | undefined;

export function nextMode(mode: PlaybackMode): PlaybackMode {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length] ?? 'list';
}

function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Preferences>;
    const mode = MODES.includes(value.mode as PlaybackMode) ? (value.mode as PlaybackMode) : 'list';

    return {
      volume: Math.max(0, Math.min(1, typeof value.volume === 'number' ? value.volume : 0.7)),
      mode,
      index: Number.isInteger(value.index) ? Math.max(0, value.index as number) : 0,
      expanded: value.expanded !== false,
    };
  } catch {
    return { volume: 0.7, mode: 'list', index: 0, expanded: true };
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

export function initializeMusicPlayer(
  tracks: readonly Track[] = playlist,
  root: Document = document,
): HTMLAudioElement | undefined {
  if (!root || typeof root.querySelector !== 'function') return undefined;

  const player = root.querySelector<HTMLElement>('[data-music-player]');
  if (!player) return audio;

  const currentIsArticle =
    root.defaultView?.location.pathname.startsWith('/posts/') ?? player.dataset.contentPage === 'true';
  player.dataset.contentPage = currentIsArticle ? 'true' : 'false';

  if (player.dataset.bound === 'true') {
    if (!currentIsArticle) player.dataset.uiState = 'expanded';
    return audio;
  }

  player.dataset.bound = 'true';

  const preferences = readPreferences();
  const volume = player.querySelector<HTMLInputElement>('[data-player-volume]');
  const progress = player.querySelector<HTMLInputElement>('[data-player-progress]');
  const currentTimeLabel = player.querySelector<HTMLElement>('[data-player-current-time]');
  const durationLabel = player.querySelector<HTMLElement>('[data-player-duration]');
  const toggle = player.querySelector<HTMLButtonElement>('[data-player-toggle]');
  const previous = player.querySelector<HTMLButtonElement>('[data-player-prev]');
  const playButton = player.querySelector<HTMLButtonElement>('[data-player-play]');
  const next = player.querySelector<HTMLButtonElement>('[data-player-next]');
  const modeButton = player.querySelector<HTMLButtonElement>('[data-player-mode]');
  const title = player.querySelector<HTMLElement>('[data-player-title]');
  const artist = player.querySelector<HTMLElement>('[data-player-artist]');

  if (volume) volume.value = String(preferences.volume);
  if (progress) {
    progress.value = '0';
    progress.style.setProperty('--played', '0%');
  }
  if (currentTimeLabel) currentTimeLabel.textContent = '0:00';
  if (durationLabel) durationLabel.textContent = '0:00';

  if (currentIsArticle) {
    const expanded = preferences.expanded;
    player.dataset.uiState = expanded ? 'expanded' : 'collapsed';
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', expanded ? '收起音乐播放器' : '展开音乐播放器');
    }

    const setExpanded = (nextState: boolean) => {
      player.dataset.uiState = nextState ? 'expanded' : 'collapsed';
      toggle?.setAttribute('aria-expanded', String(nextState));
      toggle?.setAttribute('aria-label', nextState ? '收起音乐播放器' : '展开音乐播放器');
      savePreferences({ ...readPreferences(), expanded: nextState });
    };

    toggle?.addEventListener('click', () => setExpanded(player.dataset.uiState !== 'expanded'));
    toggle?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setExpanded(player.dataset.uiState !== 'expanded');
      }
    });
    root.defaultView?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && player.dataset.uiState === 'expanded') {
        setExpanded(false);
      }
    });
  } else {
    player.dataset.uiState = 'expanded';
  }

  if (!tracks.length) return undefined;

  let index = Math.min(preferences.index, tracks.length - 1);
  let mode = preferences.mode;
  audio ??= new Audio();
  audio.volume = preferences.volume;

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

  const render = (): void => {
    if (modeButton) {
      modeButton.dataset.mode = mode;
      modeButton.setAttribute(
        'aria-label',
        `播放模式：${mode === 'shuffle' ? '随机播放' : mode === 'single' ? '单曲循环' : '列表循环'}`,
      );
    }

    savePreferences({ ...readPreferences(), volume: audio?.volume ?? 0.7, mode, index });
  };

  const load = (nextIndex: number): void => {
    index = (nextIndex + tracks.length) % tracks.length;
    const track = tracks[index]!;

    audio!.src = track.src;
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
    render();
  };

  const select = (delta: number): void => {
    const nextIndex = mode === 'shuffle' ? Math.floor(Math.random() * tracks.length) : index + delta;
    load(nextIndex);
    void audio!.play().catch(() => undefined);
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
    audio!.volume = Number(volume.value);
    render();
  });

  playButton?.addEventListener('click', () => {
    if (audio!.paused) void audio!.play().catch(() => undefined);
    else audio!.pause();
  });

  previous?.addEventListener('click', () => select(-1));
  next?.addEventListener('click', () => select(1));
  modeButton?.addEventListener('click', () => {
    mode = nextMode(mode);
    render();
  });

  audio.addEventListener('play', () => {
    player.dataset.playbackState = 'playing';
    playButton?.setAttribute('aria-pressed', 'true');
    playButton?.setAttribute('aria-label', '暂停');
    syncProgress();
  });

  audio.addEventListener('pause', () => {
    player.dataset.playbackState = 'paused';
    playButton?.setAttribute('aria-pressed', 'false');
    playButton?.setAttribute('aria-label', '播放');
    syncProgress();
  });

  audio.addEventListener('loadedmetadata', syncProgress);
  audio.addEventListener('durationchange', syncProgress);
  audio.addEventListener('timeupdate', syncProgress);
  audio.addEventListener('seeked', syncProgress);
  audio.addEventListener('ended', () => {
    if (mode === 'single') {
      audio!.currentTime = 0;
      void audio!.play().catch(() => undefined);
    } else {
      select(1);
    }
  });

  load(index);
  return audio;
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', () => {
    void initializeMusicPlayer();
  });
  initializeMusicPlayer();
}
