import { posix } from 'node:path';

const PREFIX = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/';

export function decodeRepoPath(rawUrl) {
  if (!rawUrl.startsWith(PREFIX)) return null;
  const rawPath = rawUrl.slice(PREFIX.length).split(/[?#]/u, 1)[0];
  try {
    return decodeURIComponent(rawPath).replaceAll('\\', '/').replace(/^\/+/, '');
  } catch {
    return rawPath.replaceAll('\\', '/').replace(/^\/+/, '');
  }
}

const suffix = (path) => `${posix.basename(path)}.webp`;
export const fullOutputPath = (path) => `img/optimized/${suffix(path)}`;
export const thumbnailOutputPath = (path) => `img/thumbnails/${suffix(path)}`;
export const cdnUrl = (path) => PREFIX + path.split('/').map(encodeURIComponent).join('/');
