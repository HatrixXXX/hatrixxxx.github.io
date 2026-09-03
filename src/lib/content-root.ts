import { resolve } from 'node:path';

export function contentRoot(...segments: string[]): string {
  const configuredRoot = process.env.HATRIX_CONTENT_DIR;

  if (configuredRoot !== undefined && configuredRoot.trim() === '') {
    throw new Error('HATRIX_CONTENT_DIR must not be empty');
  }

  return resolve(configuredRoot ?? '.private-content', ...segments);
}
