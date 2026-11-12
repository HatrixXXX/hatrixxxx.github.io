export const SITE_ORIGIN = 'https://hatrix.site';
export const IMAGE_REPOSITORY = 'HatrixXXX/Hatrix-s-Blog-Image';
const DEFAULT_IMAGE_REF = '85bc7b2b63bcf294f1079a98edf79ee1c9f41606';
export const APPROVED_IMAGE_REFS = [
  '8edfe3abf3ecb2438e74b9e3bfc6d0a41303597b',
  'cb37da0a31aa4e0c05213f522ebb409d9c7592cd',
  '0a16756c71f3e8a5cd14009cf78008891c0ef1f0',
  '9d12b0f1f2dde739c60c32198580155fbee3d425',
  'e1af43b0b1a55b22abbd0e2b5ea4462f39ebbd5f',
  'bd11445cc9e2c936b541ddba344fdec5626af760',
  'a15a30bfcfce393c3d8becb3e30f5c522a5d4a39',
  'ca57384431a84f631bed0b81ec3c650d41d236d9',
  'cac3bf8760863aaedf7123c5ddb89a467ff50563',
  '4407a4d00112cc1f72c23da96a210de91efab3b0',
  DEFAULT_IMAGE_REF,
  'b4dd348363960f7d4b41f3cd95d9c6f00a02fe48',
  '102d16687d19b8ba0b77fe930830465245d78294',
  'a34cd33600165dd0b2b40e041434f85c54aaed07',
  'ecfcb3dda864171cefb1378d825d72b8dfb888b1',
  '862364364b52dea2a7cbecbd05366384062a72a8',
  '14fb8e3c7367606ca612ff86dba8dbcb2c6ffdf3',
  'f8a3ab002fda4774f2bfe343a7d815aa71b3f8d7',
  'ad3ce28aaf48bb45f2b0c3564259bb39026d936f',
  '340c74e3150add75e7a97976a595e042f78f005f',
  'a7255199e50b515b4bd5524938b2e66f4dd02985',
  '0f5ede863cbb8f2fad5eaf2c84bab90ef19140ed',
  'e24163cebfe5e007f018f59c0599c0650ddf7fa9'
] as const;

const imagePrefix = (ref: string) => `https://cdn.jsdelivr.net/gh/${IMAGE_REPOSITORY}@${ref}/img/`;
export const IMMUTABLE_IMAGE_PREFIX = imagePrefix(DEFAULT_IMAGE_REF);
const IMMUTABLE_IMAGE_BASES = APPROVED_IMAGE_REFS.map((ref) => new URL(imagePrefix(ref)));
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
