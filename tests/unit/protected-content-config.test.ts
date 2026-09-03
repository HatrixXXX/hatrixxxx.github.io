import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LOCKED_PAGE_PATHS,
  PROTECTED_CONTENT,
  PROTECTED_VERIFIER_AAD,
  isConfiguredLockedPage,
  isLockedPage,
  normalizeRoutePath
} from '../../src/config/protected-content';
import { contentRoot } from '../../src/lib/content-root';

describe('protected content config', () => {
  it('uses the agreed password and KDF floors', () => {
    expect(PROTECTED_CONTENT.minimumKeyLength).toBe(8);
    expect(PROTECTED_CONTENT.argon2.memorySizeKiB).toBeGreaterThanOrEqual(19_456);
    expect(PROTECTED_CONTENT.argon2.iterations).toBeGreaterThanOrEqual(2);
    expect(PROTECTED_CONTENT.rememberForMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('normalizes configured routes without decoding legacy slugs', () => {
    expect(normalizeRoutePath('/about/research')).toBe('/about/research/');
    expect(normalizeRoutePath('/')).toBe('/');
    expect(normalizeRoutePath('/posts/a%2Fb')).toBe('/posts/a%2Fb/');
    expect(LOCKED_PAGE_PATHS.every(isConfiguredLockedPage)).toBe(true);
  });

  it('normalizes both configured paths and request paths when enforcing a lock', () => {
    expect(isLockedPage('/about/', ['/about'])).toBe(true);
    expect(isLockedPage('/about?from=home', ['/about/'])).toBe(true);
    expect(isLockedPage('/about/research/', ['/about'])).toBe(false);
  });

  it('keeps the verifier AAD fixed independently of runtime configuration', () => {
    expect(PROTECTED_VERIFIER_AAD).toBe('verifier:1');
  });

  it('resolves private content from the default or configured root', () => {
    const previousRoot = process.env.HATRIX_CONTENT_DIR;

    try {
      delete process.env.HATRIX_CONTENT_DIR;
      expect(contentRoot('posts')).toBe(resolve('.private-content', 'posts'));

      process.env.HATRIX_CONTENT_DIR = 'tests/fixtures/private-content';
      expect(contentRoot('posts')).toBe(resolve('tests/fixtures/private-content', 'posts'));

      process.env.HATRIX_CONTENT_DIR = '';
      expect(() => contentRoot()).toThrow();
    } finally {
      if (previousRoot === undefined) {
        delete process.env.HATRIX_CONTENT_DIR;
      } else {
        process.env.HATRIX_CONTENT_DIR = previousRoot;
      }
    }
  });
});
