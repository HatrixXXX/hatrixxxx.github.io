import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkImages, extractImageUrls } from '../../scripts/check-images';
import remarkImageStatus from '../../src/plugins/remark-image-status';

afterEach(() => vi.unstubAllGlobals());

describe('remote image checking', () => {
  it('deduplicates jsDelivr Markdown and HTML image URLs', () => {
    const markdown = [
      '![](https://cdn.jsdelivr.net/a.png)',
      '![](https://cdn.jsdelivr.net/a.png)',
      '<img src="https://cdn.jsdelivr.net/b.png" alt="B">',
      '[not an image](https://cdn.jsdelivr.net/link)'
    ].join('\n');

    expect(extractImageUrls(markdown)).toEqual([
      'https://cdn.jsdelivr.net/a.png',
      'https://cdn.jsdelivr.net/b.png'
    ]);
  });

  it('records failed responses without losing successful URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => new Response(null, { status: url.endsWith('ok.png') ? 200 : 404 }))
    );

    const result = await checkImages(['https://x/ok.png', 'https://x/missing.png'], 12);

    expect([...result.ok]).toEqual(['https://x/ok.png']);
    expect(result.failed.get('https://x/missing.png')).toContain('404');
  });

  it('uses a ranged GET when HEAD is rejected', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 405 });
      return new Response(null, { status: 206 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkImages(['https://x/head-rejected.png'], 12);

    expect(result.ok.has('https://x/head-rejected.png')).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://x/head-rejected.png',
      expect.objectContaining({ method: 'GET', headers: { Range: 'bytes=0-0' } })
    );
  });
});

describe('remark image status', () => {
  it('replaces a failed image while preserving its alt text and original URL', () => {
    const failedUrl = 'https://cdn.jsdelivr.net/missing.png';
    const tree = {
      type: 'root',
      children: [{ type: 'image', url: failedUrl, alt: 'diagram' }]
    };

    const transformer = remarkImageStatus(new Set([failedUrl]));
    transformer(tree);

    expect(tree.children[0]).toMatchObject({
      type: 'image',
      url: '/images/image-unavailable.svg',
      alt: 'diagram',
      data: { hProperties: { 'data-original-src': failedUrl } }
    });
  });

  it('replaces a failed raw HTML image while preserving its alt attribute', () => {
    const failedUrl = 'https://cdn.jsdelivr.net/missing.png';
    const tree = {
      type: 'root',
      children: [{ type: 'html', value: `<img src="${failedUrl}" alt="diagram">` }]
    };

    remarkImageStatus(new Set([failedUrl]))(tree);

    expect(tree.children[0]).toMatchObject({
      value: '<img src="/images/image-unavailable.svg" alt="diagram" data-original-src="https://cdn.jsdelivr.net/missing.png">'
    });
  });

  it.each(['https://cdn.jsdelivr.net/missing.gif', 'https://cdn.jsdelivr.net/missing.svg'])(
    'does not replace unsupported image format %s',
    (failedUrl) => {
      const tree = { type: 'root', children: [{ type: 'image', url: failedUrl, alt: 'animated' }] };

      remarkImageStatus(new Set([failedUrl]))(tree);

      expect(tree.children[0]).toMatchObject({ url: failedUrl, alt: 'animated' });
    }
  );
});
