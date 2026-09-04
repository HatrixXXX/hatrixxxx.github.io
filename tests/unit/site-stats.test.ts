import readingTime from 'reading-time';
import { describe, expect, it } from 'vitest';
import { buildSiteStats, formatSiteDate, runningDaysAt } from '../../src/lib/site-stats';
import type { PostEntry } from '../../src/lib/content';

function post(body: string, pubDate: string, updatedDate?: string): PostEntry {
  return {
    body,
    data: {
      pubDate: new Date(pubDate),
      updatedDate: updatedDate ? new Date(updatedDate) : undefined
    }
  } as PostEntry;
}

describe('site statistics', () => {
  it('sums words and uses the latest effective update', () => {
    const posts = [
      post('中文 text', '2025-02-17T00:00:00+08:00'),
      post('another article', '2025-02-18T00:00:00+08:00', '2025-03-01T00:00:00+08:00')
    ];
    expect(buildSiteStats(posts)).toEqual({
      postCount: 2,
      wordCount: posts.reduce((sum, item) => sum + readingTime(item.body ?? '').words, 0),
      lastUpdated: new Date('2025-03-01T00:00:00+08:00')
    });
  });

  it('rejects an empty published collection', () => {
    expect(() => buildSiteStats([])).toThrowError('published posts must not be empty');
  });

  it('uses Shanghai calendar days and counts launch day as day one', () => {
    expect(runningDaysAt(new Date('2025-02-16T15:59:59Z'))).toBe(0);
    expect(runningDaysAt(new Date('2025-02-16T16:00:00Z'))).toBe(1);
    expect(runningDaysAt(new Date('2025-02-17T16:00:00Z'))).toBe(2);
  });

  it('formats dates as YYYY-MM-DD in Shanghai', () => {
    expect(formatSiteDate(new Date('2025-02-28T16:00:00Z'))).toBe('2025-03-01');
  });
});
