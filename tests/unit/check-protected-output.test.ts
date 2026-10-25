import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptEnvelope, importContentKey } from '../../src/lib/protected-content/crypto';
import { utf8 } from '../../src/lib/protected-content/encoding';
import { inspectProtectedOutput } from '../../scripts/check-protected-output';

const PRIVATE_BODY = 'distinctive-private-body-marker-for-output-audit';
const PUBLIC_IMAGE_URL =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/public-body-image.png';
const PRIVATE_ASSET = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 71, 91, 173, 240, 14, 89, 201, 34,
  163, 61, 119, 8, 214, 49, 179, 76, 201, 16, 82, 108, 233, 7, 166, 219
]);

let temporaryRoot: string;
let distRoot: string;
let snippetsRoot: string;
let sanctuaryRootPath: string;

async function writeFixture(markdownBody = `${PRIVATE_BODY}\n\n![private](./private-image.png)`): Promise<void> {
  await mkdir(join(distRoot, 'sanctuary', 'private-entry'), { recursive: true });
  await mkdir(join(distRoot, 'assets'), { recursive: true });
  await mkdir(join(distRoot, 'protected-content', 'assets'), { recursive: true });
  await writeFile(
    join(sanctuaryRootPath, 'private-entry.md'),
    `---\ntitle: Sanctuary title\nsummary: Sanctuary summary\npubDate: 2026-09-03\n---\n${markdownBody}`,
    'utf8'
  );
  await writeFile(join(sanctuaryRootPath, 'private-image.png'), PRIVATE_ASSET);
  await writeFile(
    join(distRoot, 'protected-content', 'manifest.json'),
    JSON.stringify({ routes: ['/sanctuary/private-entry/'] }),
    'utf8'
  );
  await writeFile(
    join(distRoot, 'sanctuary', 'private-entry', 'index.html'),
    '<meta name="robots" content="noindex, nofollow"><div data-protected-envelope></div>',
    'utf8'
  );
  await writeFile(join(distRoot, 'sitemap-0.xml'), '<urlset></urlset>', 'utf8');
}

beforeEach(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'hatrix-protected-output-'));
  distRoot = join(temporaryRoot, 'dist');
  snippetsRoot = join(temporaryRoot, 'snippets');
  sanctuaryRootPath = join(temporaryRoot, 'sanctuary');
  await mkdir(snippetsRoot, { recursive: true });
  await mkdir(sanctuaryRootPath, { recursive: true });
  await mkdir(join(distRoot, 'protected-content'), { recursive: true });
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe('protected output audit', () => {
  it('detects private sanctuary body text in generated output', async () => {
    await writeFixture();
    const sanctuaryBody = 'private-sanctuary-body-marker-that-must-stay-encrypted';
    await writeFile(join(sanctuaryRootPath, '选购清单.md'), sanctuaryBody, 'utf8');
    await writeFile(join(distRoot, 'leaked-sanctuary.html'), `<p>${sanctuaryBody}</p>`, 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('leaked-sanctuary.html: protected Markdown body plaintext');
  });
  it('reports leaked snippet metadata and body without echoing either', async () => {
    await writeFixture();
    await writeFile(join(snippetsRoot, 'quiet-note.md'),
      '---\ntitle: Quiet private note\ndate: 2026-10-12\ndescription: A private summary for this note\n---\nA private paragraph that must stay encrypted.', 'utf8');
    await writeFile(join(distRoot, 'snippets.html'),
      '<h1>Quiet private note</h1><p>A private paragraph that must stay encrypted.</p>', 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('snippets.html: protected snippet metadata plaintext');
    expect(result.errors).toContain('snippets.html: protected Markdown body plaintext');
    expect(result.errors.join('\n')).not.toContain('Quiet private note');
  });

  it('detects an original snippet image copied into public output', async () => {
    await writeFixture();
    const snippetAsset = Buffer.from('distinctive-private-snippet-image-for-output-audit');
    await writeFile(join(snippetsRoot, 'private.md'),
      '---\ntitle: Private image note\ndate: 2026-10-12\n---\n![private](./private-image.png)', 'utf8');
    await writeFile(join(snippetsRoot, 'private-image.png'), snippetAsset);
    await writeFile(join(distRoot, 'assets', 'leaked.bin'), snippetAsset);

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('assets/leaked.bin: original protected resource bytes');
  });
  it('reports private Markdown body plaintext without echoing it', async () => {
    await writeFixture();
    await writeFile(join(distRoot, 'leaked.html'), `<p>${PRIVATE_BODY}</p>`, 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('leaked.html: protected Markdown body plaintext');
    expect(result.errors.join('\n')).not.toContain(PRIVATE_BODY);
  });

  it('detects private body text embedded in a binary output', async () => {
    await writeFixture();
    await writeFile(join(distRoot, 'assets', 'leaked-text.bin'), Buffer.concat([
      Buffer.from([0, 255, 0]), Buffer.from(PRIVATE_BODY), Buffer.from([255, 0])
    ]));

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('assets/leaked-text.bin: protected Markdown body plaintext');
  });

  it('treats private punctuation as literal text', async () => {
    const privatePhrase = 'Private [formula] (a+b) costs $42 and stays protected.';
    await writeFixture(privatePhrase);
    await writeFile(join(distRoot, 'leaked-punctuation.html'), `<p>${privatePhrase}</p>`, 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('leaked-punctuation.html: protected Markdown body plaintext');
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

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('leaked-attribute.html: protected Markdown body plaintext');
    expect(result.errors.join('\n')).not.toContain(privateAttribute);
  });

  it('ignores unrelated public shell text and common structural attribute values', async () => {
    await writeFixture(
      '<Aside title="Public description" className="long-common-structural-component-class">short</Aside>'
    );
    await writeFile(
      join(distRoot, 'public-shell.html'),
      '<aside title="Public description" class="long-common-structural-component-class">short</aside>',
      'utf8'
    );

    await expect(inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath)).resolves.toEqual({ errors: [] });
  });

  it('reports original protected resource bytes without echoing them', async () => {
    await writeFixture();
    await writeFile(join(distRoot, 'assets', 'leaked.bin'), PRIVATE_ASSET);

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('assets/leaked.bin: original protected resource bytes');
  });

  it('reports original protected resource names without echoing them', async () => {
    await writeFixture();
    await writeFile(join(distRoot, 'asset-index.json'), JSON.stringify({ source: 'private-image.png' }), 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('asset-index.json: original protected resource name');
    expect(result.errors.join('\n')).not.toContain('private-image.png');
  });

  it.each([
    ['inline', `![public](${PUBLIC_IMAGE_URL})`],
    ['full reference', `![public][PiC]\n\n[pIc]: ${PUBLIC_IMAGE_URL}`],
    ['collapsed reference', `![public][]\n\n[PUBLIC]: ${PUBLIC_IMAGE_URL}`],
    ['shortcut reference', `![public]\n\n[PUBLIC]: ${PUBLIC_IMAGE_URL}`]
  ])('accepts an approved public %s image without reading a local original or treating its URL as secret', async (_kind, markdown) => {
    await writeFixture(`${PRIVATE_BODY}\n\n${markdown}`);
    await rm(join(sanctuaryRootPath, 'private-image.png'));
    await writeFile(join(distRoot, 'public-image-index.json'), JSON.stringify({
      url: PUBLIC_IMAGE_URL,
      filename: 'public-body-image.png'
    }), 'utf8');

    await expect(inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath)).resolves.toEqual({ errors: [] });
  });

  it('still detects local image bytes and filenames alongside approved public images', async () => {
    await writeFixture(`![public](${PUBLIC_IMAGE_URL})\n\n![private](./private-image.png)`);
    await writeFile(join(distRoot, 'assets', 'leaked.bin'), PRIVATE_ASSET);
    await writeFile(join(distRoot, 'asset-index.json'), JSON.stringify({ source: 'private-image.png' }), 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toEqual([
      'asset-index.json: original protected resource name',
      'assets/leaked.bin: original protected resource bytes'
    ]);
  });

  it('rejects raw HTML images even when the public source is approved', async () => {
    await writeFixture(`<img src="${PUBLIC_IMAGE_URL}" alt="public">`);

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toEqual(['sanctuary/private-entry.md: locked Markdown contains a raw HTML image']);
  });

  it.each([
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/private.png',
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@0000000000000000000000000000000000000000/img/private.png',
    'https://cdn.jsdelivr.net.evil.example/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/private.png',
    'data:image/png;base64,AAAA',
    '//cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/private.png'
  ])('rejects an unapproved public image reference without echoing it: %s', async (url) => {
    await writeFixture(`![private][asset]\n\n[asset]: ${url}`);

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('sanctuary/private-entry.md: locked Markdown contains a remote body image');
    expect(result.errors.join('\n')).not.toContain(url);
  });

  it.each([
    ['full', '![private][asset]\n\n[asset]: ./private-image.png'],
    ['collapsed', '![asset][]\n\n[asset]: ./private-image.png'],
    ['shortcut', '![asset]\n\n[asset]: ./private-image.png'],
    ['case-insensitive', '![private][AsSeT]\n\n[asset]: ./private-image.png'],
    ['normalized whitespace', '![private][private  asset]\n\n[PRIVATE asset]: ./private-image.png']
  ])('detects original bytes and filenames from %s image references with later definitions', async (_kind, markdown) => {
    await writeFixture(markdown);
    await writeFile(join(distRoot, 'assets', 'referenced-leak.bin'), PRIVATE_ASSET);
    await writeFile(join(distRoot, 'reference-index.json'), JSON.stringify({ source: 'private-image.png' }), 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toEqual(expect.arrayContaining([
      'assets/referenced-leak.bin: original protected resource bytes',
      'reference-index.json: original protected resource name'
    ]));
    expect(result.errors.join('\n')).not.toContain('private-image.png');
  });

  it('rejects remote images supplied by reference definitions without echoing the URL', async () => {
    const remoteUrl = 'https://private.example.test/referenced-secret-image.png';
    await writeFixture(`![private][asset]\n\n[asset]: ${remoteUrl}`);

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('sanctuary/private-entry.md: locked Markdown contains a remote body image');
    expect(result.errors.join('\n')).not.toContain(remoteUrl);
  });

  it('rejects remote images in a locked Markdown body without echoing the URL', async () => {
    const remoteUrl = 'https://private.example.test/distinctive-secret-image.png';
    await writeFixture(`Private paragraph long enough for scanning.\n\n![private](${remoteUrl})`);

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toContain('sanctuary/private-entry.md: locked Markdown contains a remote body image');
    expect(result.errors.join('\n')).not.toContain(remoteUrl);
  });

  it('reports protected routes in sitemap or without noindex metadata', async () => {
    await writeFixture();
    await writeFile(
      join(distRoot, 'sanctuary', 'private-entry', 'index.html'),
      '<div data-protected-envelope></div>',
      'utf8'
    );
    await writeFile(
      join(distRoot, 'sitemap-0.xml'),
      '<urlset><url><loc>https://hatrix.site/sanctuary/private-entry/</loc></url></urlset>',
      'utf8'
    );

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toEqual(expect.arrayContaining([
      'sanctuary/private-entry/index.html: protected route is missing noindex, nofollow',
      'sitemap-0.xml: protected route is present in sitemap'
    ]));
  });

  it('accepts output containing only AES-GCM ciphertext and public metadata', async () => {
    await writeFixture();
    const key = await importContentKey(new Uint8Array(32).fill(9), ['encrypt']);
    const [pageEnvelope, assetEnvelope] = await Promise.all([
      encryptEnvelope(utf8(PRIVATE_BODY), key, 'page:/sanctuary/private-entry/'),
      encryptEnvelope(PRIVATE_ASSET, key, 'asset:test')
    ]);
    await writeFile(
      join(distRoot, 'sanctuary', 'private-entry', 'index.html'),
      `<meta name="robots" content="noindex, nofollow"><script data-protected-envelope>${JSON.stringify(pageEnvelope)}</script>`,
      'utf8'
    );
    await writeFile(
      join(distRoot, 'protected-content', 'assets', 'opaque.bin'),
      JSON.stringify(assetEnvelope),
      'utf8'
    );

    await expect(inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath)).resolves.toEqual({ errors: [] });
  });

  it('accepts published blog bodies and original images even with legacy locked metadata', async () => {
    await writeFixture();
    const blogsRoot = join(temporaryRoot, 'blogs');
    const publicBody = 'distinctive-public-blog-body-that-is-now-readable-by-everyone';
    const publicAsset = Buffer.from('distinctive-public-blog-image-that-does-not-need-encryption');
    vi.stubEnv('HATRIX_BLOGS_DIR', blogsRoot);
    vi.stubEnv('HATRIX_SNIPPETS_DIR', temporaryRoot);
    vi.stubEnv('HATRIX_SANCTUARY_DIR', temporaryRoot);
    await mkdir(join(blogsRoot, 'posts'), { recursive: true });
    await mkdir(join(distRoot, 'posts', 'public-post'), { recursive: true });
    await writeFile(join(blogsRoot, 'posts', 'public-post.md'),
      `---\ntitle: Public blog title\nsummary: Public blog summary\nlocked: true\nlegacySlug: public-post\n---\n${publicBody}\n\n![public](./public-blog-image.png)`, 'utf8');
    await writeFile(join(blogsRoot, 'posts', 'public-blog-image.png'), publicAsset);
    await writeFile(join(distRoot, 'assets', 'public-blog-image.png'), publicAsset);
    await writeFile(join(distRoot, 'posts', 'public-post', 'index.html'),
      `<h1>Public blog title</h1><p>${publicBody}</p><img src="/assets/public-blog-image.png" alt="public">`, 'utf8');
    await writeFile(join(distRoot, 'search.json'), JSON.stringify([{ title: 'Public blog title', body: publicBody }]), 'utf8');
    await writeFile(join(distRoot, 'sitemap-0.xml'),
      '<urlset><url><loc>https://hatrix.site/posts/public-post/</loc></url></urlset>', 'utf8');

    await expect(inspectProtectedOutput(distRoot)).resolves.toEqual({ errors: [] });
  });

  it('rejects protected snippet metadata and body in the search index', async () => {
    await writeFixture();
    const privateTitle = 'Private searchable note';
    const privateBody = 'Private search text must remain encrypted in every generated index.';
    await writeFile(join(snippetsRoot, 'search-note.md'),
      `---\ntitle: ${privateTitle}\ndate: 2026-10-12\n---\n${privateBody}`, 'utf8');
    await writeFile(join(distRoot, 'search.json'), JSON.stringify([{ title: privateTitle, body: privateBody }]), 'utf8');

    const result = await inspectProtectedOutput(distRoot, snippetsRoot, sanctuaryRootPath);

    expect(result.errors).toEqual(expect.arrayContaining([
      'search.json: protected snippet metadata plaintext',
      'search.json: protected Markdown body plaintext'
    ]));
    expect(result.errors.join('\n')).not.toContain(privateTitle);
    expect(result.errors.join('\n')).not.toContain(privateBody);
  });
});
