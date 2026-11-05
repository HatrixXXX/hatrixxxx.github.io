export const SITE_ORIGIN = 'https://hatrix.site';
export const IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/';
const NEW_IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@b4dd348363960f7d4b41f3cd95d9c6f00a02fe48/img/';
const SANCTUARY_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@102d16687d19b8ba0b77fe930830465245d78294/img/';
const ARTICLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@a34cd33600165dd0b2b40e041434f85c54aaed07/img/';
const HIGHLIGHTS_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@ecfcb3dda864171cefb1378d825d72b8dfb888b1/img/';
const BANGUMI_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@862364364b52dea2a7cbecbd05366384062a72a8/img/';
const TECHNICAL_ARTICLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@14fb8e3c7367606ca612ff86dba8dbcb2c6ffdf3/img/';
const ROOFLINE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@f8a3ab002fda4774f2bfe343a7d815aa71b3f8d7/img/';
const DIGITAL_CIRCUIT_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@ad3ce28aaf48bb45f2b0c3564259bb39026d936f/img/';

const IMMUTABLE_IMAGE_BASES = [
  new URL(IMMUTABLE_IMAGE_PREFIX),
  new URL(NEW_IMMUTABLE_IMAGE_PREFIX),
  new URL(SANCTUARY_IMAGE_PREFIX),
  new URL(ARTICLE_IMAGE_PREFIX),
  new URL(HIGHLIGHTS_IMAGE_PREFIX),
  new URL(BANGUMI_IMAGE_PREFIX),
  new URL(TECHNICAL_ARTICLE_IMAGE_PREFIX),
  new URL(ROOFLINE_IMAGE_PREFIX),
  new URL(DIGITAL_CIRCUIT_IMAGE_PREFIX)
];
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
  return IMMUTABLE_IMAGE_BASES.some(
    (base) =>
      url.protocol === base.protocol &&
      url.username === '' &&
      url.password === '' &&
      url.host === base.host &&
      url.pathname.startsWith(base.pathname)
  );
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
