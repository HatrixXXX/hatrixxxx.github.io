import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import {
  decryptEnvelope,
  deriveContentKeyBytes,
  importContentKey,
  type EncryptedEnvelope
} from '../../src/lib/protected-content/crypto';
import { base64 } from '../../src/lib/protected-content/encoding';

const contentState = vi.hoisted(() => ({ snippets: [] as CollectionEntry<'snippets'>[], sanctuary: [] as CollectionEntry<'sanctuary'>[], requestedCollections: [] as string[] }));

vi.mock('astro:content', () => ({
  getCollection: async (collection: string, filter?: (entry: CollectionEntry<'sanctuary'>) => unknown) => {
    contentState.requestedCollections.push(collection);
    if (collection === 'snippets') return contentState.snippets;
    if (collection === 'sanctuary') return contentState.sanctuary.filter((entry) => !filter || filter(entry));
    throw new Error(`Unexpected protected collection: ${collection}`);
  }
}));

vi.mock('astro:env/server', () => ({
  getSecret: (name: string) => process.env[name]
}));

import { GET, getStaticPaths } from '../../src/pages/protected-content/assets/[id].bin';

const fixtureImage = resolve('tests/fixtures/protected-content/private-image.png');
let temporaryRoot: string;
let entryPath: string;
let imagePath: string;
let previousAdminKey: string | undefined;
let previousSnippetsDir: string | undefined;
let previousSanctuaryDir: string | undefined;

function fixtureSanctuary(id: string): CollectionEntry<'sanctuary'> {
  return {
    id,
    collection: 'sanctuary',
    body: '![secret](./private-image.png)',
    filePath: entryPath,
    data: {
      title: id,
      summary: 'Public summary',
      pubDate: new Date('2026-09-03'),
      cover: '/cover.svg',
    }
  } as CollectionEntry<'sanctuary'>;
}

beforeEach(async () => {
  previousAdminKey = process.env.HATRIX_ADMIN_KEY;
  previousSnippetsDir = process.env.HATRIX_SNIPPETS_DIR;
  previousSanctuaryDir = process.env.HATRIX_SANCTUARY_DIR;
  temporaryRoot = await mkdtemp(join(tmpdir(), 'hatrix-protected-assets-'));
  const protectedRoot = join(temporaryRoot, 'sanctuary');
  entryPath = join(protectedRoot, 'private.md');
  imagePath = join(protectedRoot, 'private-image.png');
  process.env.HATRIX_SANCTUARY_DIR = temporaryRoot;
  process.env.HATRIX_ADMIN_KEY = 'test-admin';
  await mkdir(protectedRoot, { recursive: true });
  await copyFile(fixtureImage, imagePath);
  await writeFile(entryPath, '# fixture', 'utf8');
});

afterEach(async () => {
  contentState.snippets = [];
  contentState.sanctuary = [];
  contentState.requestedCollections = [];
  if (previousAdminKey === undefined) delete process.env.HATRIX_ADMIN_KEY;
  else process.env.HATRIX_ADMIN_KEY = previousAdminKey;
  if (previousSnippetsDir === undefined) delete process.env.HATRIX_SNIPPETS_DIR;
  else process.env.HATRIX_SNIPPETS_DIR = previousSnippetsDir;
  if (previousSanctuaryDir === undefined) delete process.env.HATRIX_SANCTUARY_DIR;
  else process.env.HATRIX_SANCTUARY_DIR = previousSanctuaryDir;
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe('protected asset endpoint', () => {
  it('publishes snippet body images only through encrypted opaque assets', async () => {
    const snippetsRoot = join(temporaryRoot, 'snippets');
    const snippetFile = join(snippetsRoot, 'private.md');
    await mkdir(snippetsRoot, { recursive: true });
    await writeFile(snippetFile, '# fixture', 'utf8');
    await copyFile(fixtureImage, join(snippetsRoot, 'private-image.png'));
    process.env.HATRIX_SNIPPETS_DIR = temporaryRoot;
    contentState.snippets = [{
      id: 'private', collection: 'snippets', filePath: snippetFile,
      body: '![secret](./private-image.png)',
      data: { title: 'Private snippet', date: new Date('2026-10-12') }
    }] as CollectionEntry<'snippets'>[];

    const [path] = await getStaticPaths();
    const response = await GET({ props: path.props } as never);
    const envelope = await response.json() as EncryptedEnvelope;
    const key = await importContentKey(await deriveContentKeyBytes('test-admin'), ['decrypt']);

    expect(path.params.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await decryptEnvelope(envelope, key, `asset:${path.params.id}`))
      .toEqual(new Uint8Array(await readFile(join(snippetsRoot, 'private-image.png'))));
  });
  it('emits one opaque static route for each distinct protected sanctuary image', async () => {
    contentState.sanctuary = [
      fixtureSanctuary('locked'),
      fixtureSanctuary('duplicate')
    ];

    const paths = await getStaticPaths();

    expect(paths).toHaveLength(1);
    expect(contentState.requestedCollections).toEqual(['snippets', 'sanctuary']);
    expect(paths[0].params.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(paths[0].params)).not.toContain('private-image.png');
  });

  it('returns an AES-GCM envelope that decrypts only with the asset AAD', async () => {
    contentState.sanctuary = [fixtureSanctuary('private')];
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
    contentState.sanctuary = [fixtureSanctuary('private')];
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
