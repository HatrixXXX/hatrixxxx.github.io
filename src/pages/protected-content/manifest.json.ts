import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  LOCKED_PAGE_PATHS,
  PROTECTED_CONTENT,
  PROTECTED_VERIFIER_AAD,
  normalizeRoutePath
} from '../../config/protected-content';
import type { PostEntry } from '../../lib/content';
import {
  deriveContentKeyBytes,
  encryptEnvelope,
  importContentKey
} from '../../lib/protected-content/crypto';
import { utf8 } from '../../lib/protected-content/encoding';
import { adminKeyFromEnvironment } from '../../lib/protected-content/server';
import { postPath } from '../../lib/urls';

const VERIFIER_TEXT = 'hatrix-protected-content';

export const prerender = true;

export function publicProtectedRoutes(posts: PostEntry[]): string[] {
  const routes = [
    ...LOCKED_PAGE_PATHS,
    ...posts
      .filter(({ data }) => data.locked && !data.draft)
      .map(({ data }) => postPath(data.legacySlug))
  ];

  return [...new Set(routes.map(normalizeRoutePath))].sort();
}

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');
  const routes = publicProtectedRoutes(posts);
  let verifier = null;

  if (routes.length > 0) {
    const keyBytes = await deriveContentKeyBytes(adminKeyFromEnvironment());
    const key = await importContentKey(keyBytes, ['encrypt']);
    verifier = await encryptEnvelope(utf8(VERIFIER_TEXT), key, PROTECTED_VERIFIER_AAD);
  }

  return new Response(JSON.stringify({
    version: PROTECTED_CONTENT.formatVersion,
    salt: PROTECTED_CONTENT.saltBase64,
    argon2: PROTECTED_CONTENT.argon2,
    rememberForMs: PROTECTED_CONTENT.rememberForMs,
    routes,
    verifier
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
};
