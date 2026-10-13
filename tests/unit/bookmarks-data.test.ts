import { describe, expect, it } from 'vitest';
import { BOOKMARKS } from '../../src/data/bookmarks';

describe('public bookmark archive', () => {
  it('contains distinct, described HTTPS destinations', () => {
    expect(BOOKMARKS.length).toBeGreaterThan(12);
    expect(new Set(BOOKMARKS.map((bookmark) => bookmark.url)).size).toBe(BOOKMARKS.length);
    for (const bookmark of BOOKMARKS) {
      expect(bookmark.title.trim()).not.toBe('');
      expect(bookmark.category.trim()).not.toBe('');
      expect(bookmark.description.trim()).not.toBe('');
      expect(new URL(bookmark.url).protocol).toBe('https:');
    }
  });
});
