import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PostEntry } from '../../src/lib/content';
import {
  decryptEnvelope,
  deriveContentKeyBytes,
  importContentKey
} from '../../src/lib/protected-content/crypto';
import { utf8Decode } from '../../src/lib/protected-content/encoding';
import { encryptProtectedPageHtml } from '../../src/lib/protected-content/page';

const contentState = vi.hoisted(() => ({ posts: [] as PostEntry[] }));
const configState = vi.hoisted(() => ({ lockedPagePaths: [] as string[] }));
const previousAdminKey = process.env.HATRIX_ADMIN_KEY;

vi.mock('astro:content', () => ({
  getCollection: async () => contentState.posts
}));

vi.mock('astro:env/server', () => ({
  getSecret: (name: string) => process.env[name]
}));

vi.mock('../../src/config/protected-content', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/config/protected-content')>()),
  LOCKED_PAGE_PATHS: configState.lockedPagePaths
}));

import {
  GET,
  publicProtectedRoutes
} from '../../src/pages/protected-content/manifest.json';

afterEach(() => {
  contentState.posts = [];
  configState.lockedPagePaths.splice(0);
  if (previousAdminKey === undefined) delete process.env.HATRIX_ADMIN_KEY;
  else process.env.HATRIX_ADMIN_KEY = previousAdminKey;
});

function fixturePost(
  legacySlug: string,
  { locked = true, draft = false }: { locked?: boolean; draft?: boolean } = {}
): PostEntry {
  return {
    id: legacySlug,
    collection: 'posts',
    data: {
      title: legacySlug,
      description: 'Public description',
      pubDate: new Date('2026-09-03'),
      cover: '/cover.svg',
      type: '技术笔记',
      draft,
      locked,
      math: false,
      mermaid: false,
      legacySlug
    }
  } as PostEntry;
}

describe('protected page routes', () => {
  it('returns normalized unique configured pages and published locked post paths', () => {
    configState.lockedPagePaths.splice(0, Infinity, '/about', '/about/', '/posts/private');
    const posts = [
      fixturePost('private'),
      fixturePost('nested/path/'),
      fixturePost('public', { locked: false }),
      fixturePost('draft', { draft: true })
    ];

    expect(publicProtectedRoutes(posts)).toEqual([
      '/about/',
      '/posts/nested/path/',
      '/posts/private/'
    ]);
  });

  it('publishes an inert manifest without requiring a key when no route is protected', async () => {
    configState.lockedPagePaths.splice(0);
    contentState.posts = [fixturePost('public', { locked: false })];
    delete process.env.HATRIX_ADMIN_KEY;

    const response = await GET({} as never);
    const manifest = await response.json();

    expect(manifest).toMatchObject({ routes: [], verifier: null });
    expect(Object.keys(manifest).sort()).toEqual(
      ['argon2', 'rememberForMs', 'routes', 'salt', 'verifier', 'version'].sort()
    );
  });
});

describe('protected rendering source contracts', () => {
  it('keeps distinctive body, image alt and title text out of the emitted envelope', async () => {
    const renderedSlot = [
      '<div class="post-grid">distinctive private body',
      '<img alt="distinctive private alt" title="distinctive private title">',
      '</div>'
    ].join('');
    const keyBytes = await deriveContentKeyBytes('test-admin');
    const envelope = await encryptProtectedPageHtml(renderedSlot, '/posts/private', keyBytes);
    const emittedHtml = [
      '<section data-protected-gate>',
      `<script data-protected-envelope>${JSON.stringify(envelope)}</script>`,
      '<div data-protected-mount></div>',
      '</section>'
    ].join('');

    expect(emittedHtml).not.toContain('distinctive private body');
    expect(emittedHtml).not.toContain('distinctive private alt');
    expect(emittedHtml).not.toContain('distinctive private title');

    const key = await importContentKey(keyBytes, ['decrypt']);
    const decrypted = utf8Decode(
      await decryptEnvelope(envelope, key, 'page:/posts/private/')
    );
    expect(decrypted).toBe(renderedSlot);
  });

  it('encrypts the complete rendered slot and emits only the protected shell when locked', () => {
    const source = readFileSync('src/components/ProtectedContent.astro', 'utf8');

    expect(source).toContain("Astro.slots.render('default')");
    expect(source).toContain('encryptProtectedPageHtml(renderedSlot, route, keyBytes)');
    expect(source).toContain('data-protected-gate');
    expect(source).toContain('data-protected-envelope');
    expect(source).toContain('data-protected-mount');
    expect(source).toContain('data-unlock-form');
    expect(source).toMatch(/locked[\s\S]*<slot\s*\/>/);
  });

  it('locks configured ordinary pages at BaseLayout and only the post grid at PostLayout', () => {
    const baseLayout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    const postLayout = readFileSync('src/layouts/PostLayout.astro', 'utf8');
    const gateStart = postLayout.indexOf('<ProtectedContent');

    expect(baseLayout).toContain('isConfiguredLockedPage(Astro.url.pathname)');
    expect(baseLayout).toContain('<ProtectedContent');
    expect(postLayout.indexOf('<header class="post-hero">')).toBeLessThan(gateStart);
    expect(postLayout.indexOf('<div class="post-grid container">')).toBeGreaterThan(gateStart);
    expect(postLayout).toContain('locked={post.data.locked}');
  });

  it('uses protected Markdown only for locked post bodies', () => {
    const route = readFileSync('src/pages/posts/[slug].astro', 'utf8');

    expect(route).toContain('renderProtectedMarkdown');
    expect(route).toContain('post.data.locked');
    expect(route).toContain('<Content />');
    expect(route).toMatch(/set:html=\{protectedHtml\}/);
    expect(route).toMatch(/post\.data\.locked\s*\?\s*undefined\s*:\s*await render\(post\)/);
  });
});
