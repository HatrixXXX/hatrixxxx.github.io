import type { LoaderContext } from 'astro/loaders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('astro/loaders', () => ({ glob: () => ({ name: 'glob', load: native.load }) }));

import { protectedGlob } from '../../src/lib/protected-glob';

beforeEach(() => vi.clearAllMocks());

describe('protected Markdown collection loader', () => {
  it('retains source data and body without registering native modules or image imports', async () => {
    const entry = {
      id: 'secret',
      data: { title: 'Private title' },
      body: '![Private image](./assets/private.png)',
      filePath: 'private/secret.md',
      digest: 'source-digest',
      deferredRender: true,
      rendered: { html: '<img src="private.png">', metadata: { imagePaths: ['private.png'] } },
      assetImports: ['private.png']
    };
    const set = vi.fn();
    const context = { store: { set } } as unknown as LoaderContext;
    native.load.mockImplementation(async (received: LoaderContext) => received.store.set(entry));

    await protectedGlob({ pattern: '*.md' }).load(context);

    expect(set).toHaveBeenCalledWith({
      ...entry,
      deferredRender: false,
      rendered: undefined,
      assetImports: []
    });
    expect(entry.deferredRender).toBe(true);
    expect(entry.assetImports).toEqual(['private.png']);
  });

  it('invalidates digests created before protected native rendering was disabled', async () => {
    const generateDigest = vi.fn(() => 'old-native-digest');
    const context = { store: {}, generateDigest } as unknown as LoaderContext;
    let digest: string | undefined;
    native.load.mockImplementation(async (received: LoaderContext) => {
      digest = received.generateDigest('same unchanged body');
    });

    await protectedGlob({ pattern: '*.md' }).load(context);

    expect(generateDigest).toHaveBeenCalledWith('same unchanged body');
    expect(digest).not.toBe('old-native-digest');
  });
});
