import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import {
  decryptEnvelope,
  deriveContentKeyBytes,
  importContentKey
} from '../../src/lib/protected-content/crypto';
import { utf8Decode } from '../../src/lib/protected-content/encoding';
import { encryptProtectedPageHtml } from '../../src/lib/protected-content/page';
import { PROTECTED_VERIFIER_AAD } from '../../src/config/protected-content';
import { sanctuaryPath } from '../../src/lib/sanctuary';

const contentState = vi.hoisted(() => ({ snippets: [] as CollectionEntry<'snippets'>[], sanctuary: [] as CollectionEntry<'sanctuary'>[], requestedCollections: [] as string[] }));
const configState = vi.hoisted(() => ({ lockedPagePaths: [] as string[] }));
const previousAdminKey = process.env.HATRIX_ADMIN_KEY;

vi.mock('astro:content', () => ({
  getCollection: async (collection: string) => {
    contentState.requestedCollections.push(collection);
    if (collection === 'snippets') return contentState.snippets;
    if (collection === 'sanctuary') return contentState.sanctuary;
    throw new Error(`Unexpected protected collection: ${collection}`);
  }
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
  contentState.snippets = [];
  contentState.sanctuary = [];
  contentState.requestedCollections = [];
  configState.lockedPagePaths.splice(0);
  if (previousAdminKey === undefined) delete process.env.HATRIX_ADMIN_KEY;
  else process.env.HATRIX_ADMIN_KEY = previousAdminKey;
});

describe('protected page routes', () => {
  it('uses the fixed verifier protocol AAD', () => {
    expect(PROTECTED_VERIFIER_AAD).toBe('verifier:1');
  });

  it('returns normalized unique configured pages and protected collection paths', () => {
    configState.lockedPagePaths.splice(0, Infinity, '/snippets', '/snippets/', '/sanctuary');
    const snippets = [{ id: 'private' }, { id: 'private' }] as CollectionEntry<'snippets'>[];

    expect(publicProtectedRoutes(snippets, [])).toEqual([
      '/sanctuary/',
      '/snippets/',
      '/snippets/private/'
    ]);
  });

  it('registers every snippet detail with the protected overview', async () => {
    configState.lockedPagePaths.push('/snippets/');
    contentState.snippets = [{ id: 'quiet-note' }, { id: 'another-note' }] as CollectionEntry<'snippets'>[];
    process.env.HATRIX_ADMIN_KEY = 'test-admin';

    const response = await GET({} as never);
    const manifest = await response.json();

    expect(manifest.routes).toEqual(['/snippets/', '/snippets/another-note/', '/snippets/quiet-note/']);
  });

  it('registers empty and populated sanctuary as protected article routes', async () => {
    configState.lockedPagePaths.push('/sanctuary/');
    contentState.sanctuary = [
      { id: '选购清单', body: '已有正文' },
      { id: '作息规律', body: '' }
    ] as CollectionEntry<'sanctuary'>[];
    process.env.HATRIX_ADMIN_KEY = 'test-admin';

    const response = await GET({} as never);
    const manifest = await response.json();

    expect(manifest.routes).toEqual(['/sanctuary/', sanctuaryPath('作息规律'), sanctuaryPath('选购清单')].sort());
  });

  it('publishes an inert manifest without requiring a key when no route is protected', async () => {
    configState.lockedPagePaths.splice(0);
    delete process.env.HATRIX_ADMIN_KEY;

    const response = await GET({} as never);
    const manifest = await response.json();

    expect(manifest).toMatchObject({ routes: [], verifier: null });
    expect(contentState.requestedCollections).toEqual(['snippets', 'sanctuary']);
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
    const envelope = await encryptProtectedPageHtml(renderedSlot, '/snippets/private', keyBytes);
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
      await decryptEnvelope(envelope, key, 'page:/snippets/private/')
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
    expect(source).toContain('autocomplete="off"');
    expect(source.match(/\bdisabled\b/g)).toHaveLength(4);
    expect(source).not.toContain('autocomplete="current-password"');
    expect(source).toMatch(/locked[\s\S]*<slot\s*\/>/);
  });

  it('loads the protected runtime only through the small conditional bootstrap', () => {
    const bootstrapPath = 'src/scripts/protected-content-bootstrap.ts';
    const baseLayout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');

    expect(existsSync(bootstrapPath)).toBe(true);
    if (!existsSync(bootstrapPath)) return;

    const bootstrap = readFileSync(bootstrapPath, 'utf8');
    expect(baseLayout).toContain("import '@/scripts/protected-content-bootstrap';");
    expect(baseLayout).not.toContain("import '@/scripts/protected-content';");
    expect(bootstrap).toContain("import('@/scripts/protected-content')");
    expect(bootstrap).toContain('[data-protected-gate]');
    expect(bootstrap).toContain('hatrix-admin-session');
    expect(bootstrap).toContain('hatrix-admin-remembered');
    expect(bootstrap).toContain('runtime = undefined');
    expect(bootstrap).toContain("document.addEventListener('astro:page-load'");
  });

  it('locks configured ordinary pages while keeping the complete blog layout public', () => {
    const baseLayout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    const postLayout = readFileSync('src/layouts/PostLayout.astro', 'utf8');

    expect(baseLayout).toContain('isConfiguredLockedPage(Astro.url.pathname)');
    expect(baseLayout).toContain('<ProtectedContent');
    expect(postLayout).toContain('<div class="post-grid container">');
    expect(postLayout).not.toContain('ProtectedContent');
    expect(postLayout).not.toContain('post.data.locked');
    expect(postLayout).not.toContain('noindex=');
  });

  it('keeps adjacent link label styles across the PostLink component boundary', () => {
    const postLayout = readFileSync('src/layouts/PostLayout.astro', 'utf8');

    expect(postLayout).toContain('.adjacent-posts :global(a > span)');
    expect(postLayout).toContain('.adjacent-posts :global(a > strong)');
    expect(postLayout).toContain('.adjacent-posts :global(a:hover > strong)');
  });

  it('renders every blog body natively without an administrator key', () => {
    const route = readFileSync('src/pages/posts/[slug].astro', 'utf8');

    expect(route).toContain('await render(post)');
    expect(route).toContain('<Content />');
    expect(route).not.toContain('post.data.locked');
    expect(route).not.toContain('renderProtectedMarkdown');
    expect(route).not.toContain('adminKeyFromEnvironment');
  });
});
