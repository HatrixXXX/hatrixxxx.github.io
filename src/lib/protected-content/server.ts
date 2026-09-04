import { getSecret } from 'astro:env/server';
import { PROTECTED_CONTENT } from '../../config/protected-content';

export function adminKeyFromEnvironment(): string {
  const key = getSecret('HATRIX_ADMIN_KEY');

  if (key === undefined || key.length < PROTECTED_CONTENT.minimumKeyLength) {
    throw new Error(`HATRIX_ADMIN_KEY must be at least ${PROTECTED_CONTENT.minimumKeyLength} characters`);
  }

  return key;
}
