import { describe, expect, it } from 'vitest';
import { sanctuarySchema } from '../../src/lib/sanctuary-schema';
import { IMMUTABLE_IMAGE_PREFIX } from '../../src/lib/safe-url';

const pinnedCover =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@102d16687d19b8ba0b77fe930830465245d78294/img/sanctuary-covers/example.webp';
const fixture = {
  title: 'Sanctuary fixture',
  summary: '用于检查秘境封面的示例。',
  pubDate: '2026-10-26'
};

describe('sanctuary covers', () => {
  it('accepts an omitted cover and existing site-local covers', () => {
    expect(sanctuarySchema.safeParse(fixture).success).toBe(true);
    expect(sanctuarySchema.safeParse({
      ...fixture, cover: '/assets/sanctuary-covers/example.webp'
    }).success).toBe(true);
  });

  it.each([pinnedCover, `${IMMUTABLE_IMAGE_PREFIX}example.webp`])(
    'accepts an approved immutable image repository cover: %s', (cover) => {
      expect(sanctuarySchema.safeParse({ ...fixture, cover }).success).toBe(true);
    }
  );

  it.each([
    '',
    'https://example.com/cover.webp',
    pinnedCover.replace('102d16687d19b8ba0b77fe930830465245d78294', 'master'),
    pinnedCover.replace('Hatrix-s-Blog-Image@', 'another-repository@'),
    pinnedCover.replace('/img/', '/private/'),
    pinnedCover.replace('https:', 'http:'),
    pinnedCover.replace('https://', 'https://user:password@'),
    '//cdn.jsdelivr.net/cover.webp',
    'javascript:alert(1)'
  ])('rejects unapproved remote covers: %s', (cover) => {
    expect(sanctuarySchema.safeParse({ ...fixture, cover }).success).toBe(false);
  });
});
