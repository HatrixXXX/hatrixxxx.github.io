import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkImages, collectImageSources, coverFailuresFor, extractImageUrls } from '../../scripts/check-images';
import remarkImageStatus from '../../src/plugins/remark-image-status';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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

  it('accepts a jsDelivr image transform suffix after a static image extension', () => {
    const transformedCover = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/994.jpg!list1x.v2';

    expect(extractImageUrls(`![](${transformedCover})`)).toEqual([transformedCover]);
  });

  it('extracts an angle-bracket Markdown destination containing spaces and parentheses', () => {
    const url = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/servlet%20(1).png';

    expect(extractImageUrls(`![](<${url}>)`)).toEqual([url]);
  });

  it('includes the transformed cover from the real post source', async () => {
    const transformedCover = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/994.jpg!list1x.v2';
    const sources = await collectImageSources('src/content/posts');

    expect(sources.coverUrls.has(transformedCover)).toBe(true);
    expect(sources.urls).toContain(transformedCover);
  });

  it('marks an unavailable transformed cover as a build-blocking cover failure', async () => {
    const transformedCover = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/994.jpg!list1x.v2';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));

    const result = await checkImages([transformedCover], 12);

    expect(coverFailuresFor(result, new Set([transformedCover]))).toEqual([transformedCover]);
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

  it('caps concurrent requests at twelve', async () => {
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response(null, { status: 200 });
    }));

    await checkImages(Array.from({ length: 13 }, (_, index) => `https://x/${index}.png`), 99);

    expect(maxActive).toBe(12);
  });

  it('aborts a hanging request after ten seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<never>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('request timed out', 'AbortError')));
    })));

    const result = checkImages(['https://x/hangs.png'], 12);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toMatchObject({ failed: new Map([['https://x/hangs.png', 'request timed out']]) });
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

  it('replaces the angle-bracket Markdown destination from the real post', () => {
    const failedUrl = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/servlet%20(1).png';
    const tree = { type: 'root', children: [{ type: 'image', url: failedUrl, alt: '' }] };

    remarkImageStatus(new Set([failedUrl]))(tree);

    expect(tree.children[0]).toMatchObject({
      url: '/images/image-unavailable.svg',
      alt: '',
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
