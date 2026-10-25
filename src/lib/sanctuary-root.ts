import { resolve } from 'node:path';

export function sanctuaryRoot(...segments: string[]): string {
  const configuredRoot = process.env.HATRIX_SANCTUARY_DIR;
  if (configuredRoot !== undefined && configuredRoot.trim() === '') {
    throw new Error('HATRIX_SANCTUARY_DIR must not be empty');
  }
  return resolve(configuredRoot ?? '.private-sanctuary', ...segments);
}
