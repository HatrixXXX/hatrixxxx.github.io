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
import { blogRoot } from '../../src/lib/blog-root';

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

  it('protects sanctuary and digest while leaving neighboring navigation pages public', () => {
    expect(isConfiguredLockedPage('/sanctuary/')).toBe(true);
    expect(isConfiguredLockedPage('/digest/')).toBe(true);
    expect(isConfiguredLockedPage('/favorites/')).toBe(false);
    expect(isConfiguredLockedPage('/toolbox/')).toBe(false);
  });

  it('keeps the verifier AAD fixed independently of runtime configuration', () => {
    expect(PROTECTED_VERIFIER_AAD).toBe('verifier:1');
  });

  it('resolves private blogs from the default or configured root', () => {
    const previousRoot = process.env.HATRIX_BLOGS_DIR;

    try {
      delete process.env.HATRIX_BLOGS_DIR;
      expect(blogRoot('posts')).toBe(resolve('.private-blogs', 'posts'));

      process.env.HATRIX_BLOGS_DIR = 'tests/fixtures/private-blogs';
      expect(blogRoot('posts')).toBe(resolve('tests/fixtures/private-blogs', 'posts'));

      process.env.HATRIX_BLOGS_DIR = '';
      expect(() => blogRoot()).toThrow();
    } finally {
      if (previousRoot === undefined) {
        delete process.env.HATRIX_BLOGS_DIR;
      } else {
        process.env.HATRIX_BLOGS_DIR = previousRoot;
      }
    }
  });
});
