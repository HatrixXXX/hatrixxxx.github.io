import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostEntry } from '../../src/lib/content';
import {
  decryptEnvelope,
  deriveContentKeyBytes,
  importContentKey,
  type EncryptedEnvelope
} from '../../src/lib/protected-content/crypto';
import { base64 } from '../../src/lib/protected-content/encoding';

const contentState = vi.hoisted(() => ({ posts: [] as PostEntry[] }));

vi.mock('astro:content', () => ({
  getCollection: async (_collection: string, filter?: (post: PostEntry) => unknown) =>
    filter ? contentState.posts.filter(filter) : contentState.posts
}));

vi.mock('astro:env/server', () => ({
  getSecret: (name: string) => process.env[name]
}));

import { GET, getStaticPaths } from '../../src/pages/protected-content/assets/[id].bin';

const fixtureImage = resolve('tests/fixtures/protected-content/private-image.png');
let temporaryRoot: string;
let postPath: string;
let imagePath: string;
let previousContentDir: string | undefined;
let previousAdminKey: string | undefined;

function fixturePost(id: string, locked = true, draft = false): PostEntry {
  return {
    id,
    collection: 'posts',
    body: '![secret](./private-image.png)',
    filePath: postPath,
    data: {
      title: id,
      description: 'Public description',
      pubDate: new Date('2026-09-03'),
      cover: '/cover.svg',
      type: '技术笔记',
      draft,
      locked,
      math: false,
      mermaid: false,
      legacySlug: id
    }
  } as PostEntry;
}

beforeEach(async () => {
  previousContentDir = process.env.HATRIX_CONTENT_DIR;
  previousAdminKey = process.env.HATRIX_ADMIN_KEY;
  temporaryRoot = await mkdtemp(join(tmpdir(), 'hatrix-protected-assets-'));
  const postsRoot = join(temporaryRoot, 'posts');
  postPath = join(postsRoot, 'private.md');
  imagePath = join(postsRoot, 'private-image.png');
  process.env.HATRIX_CONTENT_DIR = temporaryRoot;
  process.env.HATRIX_ADMIN_KEY = 'test-admin';
  await mkdir(postsRoot, { recursive: true });
  await copyFile(fixtureImage, imagePath);
  await writeFile(postPath, '# fixture', 'utf8');
});

afterEach(async () => {
  contentState.posts = [];
  if (previousContentDir === undefined) delete process.env.HATRIX_CONTENT_DIR;
  else process.env.HATRIX_CONTENT_DIR = previousContentDir;
  if (previousAdminKey === undefined) delete process.env.HATRIX_ADMIN_KEY;
  else process.env.HATRIX_ADMIN_KEY = previousAdminKey;
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe('protected asset endpoint', () => {
  it('emits one opaque static route for each distinct published locked image', async () => {
    contentState.posts = [
      fixturePost('locked'),
      fixturePost('duplicate'),
      fixturePost('public', false),
      fixturePost('draft', true, true)
    ];

    const paths = await getStaticPaths();

    expect(paths).toHaveLength(1);
    expect(paths[0].params.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(paths[0].params)).not.toContain('private-image.png');
  });

  it('returns an AES-GCM envelope that decrypts only with the asset AAD', async () => {
    contentState.posts = [fixturePost('locked')];
    const [path] = await getStaticPaths();
    const response = await GET({ props: path.props } as never);
    const responseText = await response.text();
    const envelope = JSON.parse(responseText) as EncryptedEnvelope;
    const keyBytes = await deriveContentKeyBytes('test-admin');
    const key = await importContentKey(keyBytes, ['decrypt']);
    const aad = `asset:${path.params.id}`;
    const sourceBytes = new Uint8Array(await readFile(imagePath));

    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(responseText).not.toContain('private-image.png');
    expect(envelope.ciphertext).not.toBe(base64(sourceBytes));
    await expect(decryptEnvelope(envelope, key, aad)).resolves.toEqual(sourceBytes);
    await expect(decryptEnvelope(envelope, key, 'asset:wrong')).rejects.toMatchObject({
      name: 'OperationError'
    });
  });

  it('emits a new decryptable URL when an image is replaced at the same path', async () => {
    contentState.posts = [fixturePost('locked')];
    const [firstPath] = await getStaticPaths();
    const firstResponse = await GET({ props: firstPath.props } as never);
    const firstEnvelope = await firstResponse.json() as EncryptedEnvelope;
    const replacementBytes = new Uint8Array([9, 8, 7, 6, 5]);
    await writeFile(imagePath, replacementBytes);

    const [replacementPath] = await getStaticPaths();
    const replacementResponse = await GET({ props: replacementPath.props } as never);
    const replacementEnvelope = await replacementResponse.json() as EncryptedEnvelope;
    const keyBytes = await deriveContentKeyBytes('test-admin');
    const key = await importContentKey(keyBytes, ['decrypt']);

    expect(replacementPath.params.id).not.toBe(firstPath.params.id);
    expect(`/protected-content/assets/${replacementPath.params.id}.bin`).not.toBe(
      `/protected-content/assets/${firstPath.params.id}.bin`
    );
    await expect(
      decryptEnvelope(firstEnvelope, key, `asset:${firstPath.params.id}`)
    ).resolves.not.toEqual(replacementBytes);
    await expect(
      decryptEnvelope(replacementEnvelope, key, `asset:${replacementPath.params.id}`)
    ).resolves.toEqual(replacementBytes);
  });
});
