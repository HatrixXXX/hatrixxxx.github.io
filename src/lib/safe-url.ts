export const SITE_ORIGIN = 'https://hatrix.site';
export const IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/';

const IMMUTABLE_IMAGE_BASE = new URL(IMMUTABLE_IMAGE_PREFIX);
const DANGEROUS_DATA_MEDIA_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml'
]);
const ASCII_WHITESPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

export type DangerousBrowserUrlKind = 'executable-scheme' | 'dangerous-data-document';

export function resolveBrowserUrl(value: string, pageBase: string | URL): URL | undefined {
  try {
    return new URL(value, pageBase);
  } catch {
    return undefined;
  }
}

function dataMediaType(url: URL): string {
  const commaIndex = url.pathname.indexOf(',');
  const metadata = url.pathname.slice(0, commaIndex === -1 ? undefined : commaIndex);
  const parameterIndex = metadata.indexOf(';');
  return metadata
    .slice(0, parameterIndex === -1 ? undefined : parameterIndex)
    .replace(ASCII_WHITESPACE, '')
    .toLowerCase();
}

export function dangerousBrowserUrlKind(
  value: string | URL,
  pageBase: string | URL
): DangerousBrowserUrlKind | undefined {
  const url = value instanceof URL ? value : resolveBrowserUrl(value, pageBase);
  if (!url) return undefined;
  if (url.protocol === 'javascript:' || url.protocol === 'vbscript:') return 'executable-scheme';
  if (url.protocol === 'data:' && DANGEROUS_DATA_MEDIA_TYPES.has(dataMediaType(url))) {
    return 'dangerous-data-document';
  }
  return undefined;
}

export function isApprovedRemoteImageUrl(url: URL): boolean {
  return (
    url.protocol === IMMUTABLE_IMAGE_BASE.protocol &&
    url.username === '' &&
    url.password === '' &&
    url.host === IMMUTABLE_IMAGE_BASE.host &&
    url.pathname.startsWith(IMMUTABLE_IMAGE_BASE.pathname)
  );
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
