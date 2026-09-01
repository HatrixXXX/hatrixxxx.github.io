import { playlist } from '@/data/playlist';
import type { Track } from '@/types/content';

const STORAGE_KEY = 'hatrix-player';

interface PlayerPreferences {
  volume: number;
  expanded: boolean;
}

function readPreferences(): PlayerPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<PlayerPreferences>;
    return {
      volume: typeof stored.volume === 'number' ? stored.volume : 0.7,
      expanded: stored.expanded !== false
    };
  } catch {
    return { volume: 0.7, expanded: true };
  }
}

function storePreferences(preferences: PlayerPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function initializeMusicPlayer(tracks: readonly Track[] = playlist): void {
  const player = document.querySelector<HTMLElement>('[data-music-player]');
  const volume = player?.querySelector<HTMLInputElement>('[data-player-volume]');
  if (!player || !volume) return;

  const preferences = readPreferences();
  volume.value = String(preferences.volume);
  player.dataset.uiState = preferences.expanded ? 'expanded' : 'collapsed';
  if (volume.dataset.bound !== 'true') {
    volume.dataset.bound = 'true';
    volume.addEventListener('input', () => {
      const next = readPreferences();
      next.volume = Number(volume.value);
      storePreferences(next);
    });
  }

  if (tracks.length === 0) return;

  const audio = new Audio(tracks[0].src);
  audio.volume = preferences.volume;
}

document.addEventListener('astro:page-load', () => initializeMusicPlayer());
initializeMusicPlayer();
