export const PROTECTED_CONTENT = {
  formatVersion: 1,
  minimumKeyLength: 8,
  rememberForMs: 7 * 24 * 60 * 60 * 1000,
  saltBase64: '0J9wHDhoJFtpjeM+N1PY+w==',
  argon2: { memorySizeKiB: 19_456, iterations: 2, parallelism: 1, hashLength: 32 }
} as const;

export const LOCKED_PAGE_PATHS: readonly string[] = [];
export const PROTECTED_VERIFIER_AAD = 'verifier:1' as const;

export function normalizeRoutePath(path: string): string {
  const pathname = new URL(path, 'https://hatrix.site').pathname;
  return pathname === '/' ? '/' : `${pathname.replace(/\/+$/, '')}/`;
}

export function isLockedPage(path: string, configuredPaths: readonly string[]): boolean {
  const normalizedPath = normalizeRoutePath(path);
  return configuredPaths.some((configuredPath) => normalizeRoutePath(configuredPath) === normalizedPath);
}

export function isConfiguredLockedPage(path: string): boolean {
  return isLockedPage(path, LOCKED_PAGE_PATHS);
}
