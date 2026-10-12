import { resolve } from 'node:path';

export function snippetRoot(...segments: string[]): string {
  const configuredRoot = process.env.HATRIX_SNIPPETS_DIR;

  if (configuredRoot !== undefined && configuredRoot.trim() === '') {
    throw new Error('HATRIX_SNIPPETS_DIR must not be empty');
  }

  return resolve(configuredRoot ?? '.private-snippets', ...segments);
}
