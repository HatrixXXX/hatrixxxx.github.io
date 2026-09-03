import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encryptEnvelope, importContentKey } from '../../src/lib/protected-content/crypto';
import { utf8 } from '../../src/lib/protected-content/encoding';
import { inspectProtectedOutput } from '../../scripts/check-protected-output';

const PRIVATE_BODY = 'distinctive-private-body-marker-for-output-audit';
const PRIVATE_ASSET = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 71, 91, 173, 240, 14, 89, 201, 34,
  163, 61, 119, 8, 214, 49, 179, 76, 201, 16, 82, 108, 233, 7, 166, 219
]);

let temporaryRoot: string;
let contentRoot: string;
let distRoot: string;

async function writeFixture(markdownBody = `${PRIVATE_BODY}\n\n![private](./private-image.png)`): Promise<void> {
  await mkdir(join(contentRoot, 'posts'), { recursive: true });
  await mkdir(join(distRoot, 'posts', 'locked-post'), { recursive: true });
  await mkdir(join(distRoot, 'assets'), { recursive: true });
  await mkdir(join(distRoot, 'protected-content', 'assets'), { recursive: true });
  await writeFile(
    join(contentRoot, 'posts', 'locked-post.md'),
    `---\ntitle: Public title\ndescription: Public description\npubDate: 2026-09-03\ncover: /cover.svg\ntype: 技术笔记\ndraft: false\nlocked: true\nlegacySlug: locked-post\n---\n${markdownBody}`,
    'utf8'
  );
  await writeFile(join(contentRoot, 'posts', 'private-image.png'), PRIVATE_ASSET);
  await writeFile(
    join(distRoot, 'protected-content', 'manifest.json'),
    JSON.stringify({ routes: ['/posts/locked-post/'] }),
    'utf8'
  );
  await writeFile(
    join(distRoot, 'posts', 'locked-post', 'index.html'),
    '<meta name="robots" content="noindex, nofollow"><div data-protected-envelope></div>',
    'utf8'
  );
  await writeFile(join(distRoot, 'sitemap-0.xml'), '<urlset></urlset>', 'utf8');
}

beforeEach(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'hatrix-protected-output-'));
  contentRoot = join(temporaryRoot, 'content');
  distRoot = join(temporaryRoot, 'dist');
  await mkdir(join(distRoot, 'protected-content'), { recursive: true });
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe('protected output audit', () => {
  it('reports private Markdown body plaintext without echoing it', async () => {
    await writeFixture();
    await writeFile(join(distRoot, 'leaked.html'), `<p>${PRIVATE_BODY}</p>`, 'utf8');

    const result = await inspectProtectedOutput(contentRoot, distRoot);

    expect(result.errors).toContain('leaked.html: protected Markdown body plaintext');
    expect(result.errors.join('\n')).not.toContain(PRIVATE_BODY);
  });

  it.each([
    ['quoted', (value: string) => `<aside data-private-note="${value}">short</aside>`],
    ['unquoted', (value: string) => `<aside data-private-note=${value}>short</aside>`],
    ['MDX expression', (value: string) => `<Aside data-private-note={"${value}"}>short</Aside>`]
  ])('reports a private %s attribute value without echoing it', async (_kind, sourceMarkup) => {
    const privateAttribute = `distinctive-private-attribute-${_kind.replace(/\s/g, '-')}-marker`;
    await writeFixture(sourceMarkup(privateAttribute));
    await writeFile(
      join(distRoot, 'leaked-attribute.html'),
      `<aside data-private-note="${privateAttribute}">short</aside>`,
      'utf8'
    );

    const result = await inspectProtectedOutput(contentRoot, distRoot);

    expect(result.errors).toContain('leaked-attribute.html: protected Markdown body plaintext');
    expect(result.errors.join('\n')).not.toContain(privateAttribute);
  });

  it('ignores public metadata and common structural attribute values', async () => {
    await writeFixture(
      '<Aside title="Public description" className="long-common-structural-component-class">short</Aside>'
    );
    await writeFile(
      join(distRoot, 'public-shell.html'),
      '<aside title="Public description" class="long-common-structural-component-class">short</aside>',
      'utf8'
    );

    await expect(inspectProtectedOutput(contentRoot, distRoot)).resolves.toEqual({ errors: [] });
  });

  it('reports original protected resource bytes without echoing them', async () => {
    await writeFixture();
    await writeFile(join(distRoot, 'assets', 'leaked.bin'), PRIVATE_ASSET);

    const result = await inspectProtectedOutput(contentRoot, distRoot);

    expect(result.errors).toContain('assets/leaked.bin: original protected resource bytes');
  });

  it('reports original protected resource names without echoing them', async () => {
    await writeFixture();
    await writeFile(join(distRoot, 'asset-index.json'), JSON.stringify({ source: 'private-image.png' }), 'utf8');

    const result = await inspectProtectedOutput(contentRoot, distRoot);

    expect(result.errors).toContain('asset-index.json: original protected resource name');
    expect(result.errors.join('\n')).not.toContain('private-image.png');
  });

  it('rejects remote images in a locked Markdown body without echoing the URL', async () => {
    const remoteUrl = 'https://private.example.test/distinctive-secret-image.png';
    await writeFixture(`Private paragraph long enough for scanning.\n\n![private](${remoteUrl})`);

    const result = await inspectProtectedOutput(contentRoot, distRoot);

    expect(result.errors).toContain('posts/locked-post.md: locked Markdown contains a remote body image');
    expect(result.errors.join('\n')).not.toContain(remoteUrl);
  });

  it('reports protected routes in sitemap or without noindex metadata', async () => {
    await writeFixture();
    await writeFile(
      join(distRoot, 'posts', 'locked-post', 'index.html'),
      '<div data-protected-envelope></div>',
      'utf8'
    );
    await writeFile(
      join(distRoot, 'sitemap-0.xml'),
      '<urlset><url><loc>https://hatrix.site/posts/locked-post/</loc></url></urlset>',
      'utf8'
    );

    const result = await inspectProtectedOutput(contentRoot, distRoot);

    expect(result.errors).toEqual(expect.arrayContaining([
      'posts/locked-post/index.html: protected route is missing noindex, nofollow',
      'sitemap-0.xml: protected route is present in sitemap'
    ]));
  });

  it('accepts output containing only AES-GCM ciphertext and public metadata', async () => {
    await writeFixture();
    const key = await importContentKey(new Uint8Array(32).fill(9), ['encrypt']);
    const [pageEnvelope, assetEnvelope] = await Promise.all([
      encryptEnvelope(utf8(PRIVATE_BODY), key, 'page:/posts/locked-post/'),
      encryptEnvelope(PRIVATE_ASSET, key, 'asset:test')
    ]);
    await writeFile(
      join(distRoot, 'posts', 'locked-post', 'index.html'),
      `<meta name="robots" content="noindex, nofollow"><script data-protected-envelope>${JSON.stringify(pageEnvelope)}</script>`,
      'utf8'
    );
    await writeFile(
      join(distRoot, 'protected-content', 'assets', 'opaque.bin'),
      JSON.stringify(assetEnvelope),
      'utf8'
    );

    await expect(inspectProtectedOutput(contentRoot, distRoot)).resolves.toEqual({ errors: [] });
  });
});
