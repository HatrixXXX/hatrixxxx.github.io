import { resolve } from 'node:path';

export function blogRoot(...segments: string[]): string {
  const configuredRoot = process.env.HATRIX_BLOGS_DIR;

  if (configuredRoot !== undefined && configuredRoot.trim() === '') {
    throw new Error('HATRIX_BLOGS_DIR must not be empty');
  }

  return resolve(configuredRoot ?? '.private-blogs', ...segments);
}
