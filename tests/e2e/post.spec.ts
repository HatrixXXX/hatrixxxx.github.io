import { expect, test, type APIResponse } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contentRoot } from '../../src/lib/content-root';

const postsDirectory = contentRoot('posts');

async function legacySlugs(): Promise<string[]> {
  const files = (await readdir(postsDirectory)).filter((file) => file.endsWith('.md'));
  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(postsDirectory, file), 'utf8');
      const slug = source.match(/^legacySlug:\s*(.+)$/m)?.[1]?.trim();
      if (!slug) throw new Error(`Missing legacySlug in ${file}`);
      return slug;
    })
  );
}

test('legacy post route renders enhanced article content', async ({ page }) => {
  const response = await page.goto('/posts/本科数学大杂烩/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('article[data-post] h1')).toContainText('本科数学');
  await expect(page.locator('.katex').first()).toBeVisible();

  const firstTocLink = page.locator('[data-table-of-contents] a').first();
  await expect(firstTocLink).toHaveAttribute('href', /^#.+/);
  const firstHeadingId = (await firstTocLink.getAttribute('href'))?.slice(1);
  await expect(page.locator(`#${firstHeadingId}`)).toBeAttached();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new URL('/posts/本科数学大杂烩/', 'https://hatrix.site').href
  );
  const giscus = page.locator('script[src="https://giscus.app/client.js"]');
  await expect(giscus).toHaveAttribute('data-repo', 'hatrixxxx/hatrixxxx.github.io');
  await expect(giscus).toHaveAttribute('data-repo-id', 'R_kgDORB9GlQ');
  await expect(giscus).toHaveAttribute('data-category', 'Comments');
  await expect(giscus).toHaveAttribute('data-category-id', 'DIC_kwDORB9Glc4DACF_');
  await expect(giscus).toHaveAttribute('data-mapping', 'pathname');
  await expect(giscus).toHaveAttribute('data-strict', '0');
  await expect(page.locator('[data-adjacent-posts] a').first()).toHaveAttribute(
    'href',
    /^\/posts\//
  );
  await expect(page.locator('.breadcrumbs li')).toHaveCount(2);
  await expect(page.locator('.post-tags')).toHaveCount(0);
  await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);
});

test('blog navigation and the home entry target the blog index', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: '博客文章', exact: true }).first()).toHaveAttribute('href', '/blog/');
  await expect(page.locator('main#articles')).toBeVisible();
  await expect(page.locator('article[data-post-card]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '浏览全部博客文章' })).toHaveAttribute('href', '/blog/');
});

test('all legacy slugs resolve, including the spaced slug clicked from pagination', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  const slugs = await legacySlugs();
  expect(slugs).toHaveLength(40);

  const responses: Array<{ slug: string; response: APIResponse }> = [];
  for (let offset = 0; offset < slugs.length; offset += 4) {
    const batch = slugs.slice(offset, offset + 4);
    responses.push(
      ...(await Promise.all(
        batch.map(async (slug) => ({ slug, response: await request.get(`/posts/${slug}/`) }))
      ))
    );
  }
  for (const { slug, response } of responses) {
    expect(response.status(), slug).toBe(200);
  }

  await page.goto('/page/3/');
  const spacedSlugLink = page
    .locator('a[href="/posts/FPGA开发(1)Vivado+Vitis 使用/"]')
    .first();
  await spacedSlugLink.click();
  await expect(page).toHaveURL(
    new RegExp(`${encodeURI('/posts/FPGA开发(1)Vivado+Vitis 使用/').replace(/[+()]/g, '\\$&')}$`)
  );
  await expect(page.locator('article[data-post] h1')).toContainText('Vivado + Vitis');
});

test('Mermaid loader renders targets on astro page-load', async ({ page }) => {
  await page.goto('/posts/FPGA开发(3)AXI协议/');
  await expect(page.locator('.language-mermaid')).toHaveCount(0);

  await page.locator('.prose').evaluate((prose) => {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-mermaid';
    code.textContent = 'flowchart LR\n  A --> B';
    pre.append(code);
    prose.append(pre);
    document.dispatchEvent(new Event('astro:page-load'));
  });

  await expect(page.locator('[data-mermaid] svg, .mermaid svg').first()).toBeAttached();
});

test('post layout has no mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/posts/本科数学大杂烩/');
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(sizes.scroll).toBe(sizes.client);
});

test('post layout places the sidebar, article and TOC in responsive reading order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/本科数学大杂烩/');

  const desktopStack = await page.locator('[data-sidebar-stack]').boundingBox();
  const desktopPost = await page.locator('.post-column').boundingBox();
  const desktopToc = await page.locator('[data-toc-desktop]').boundingBox();
  expect((desktopStack?.x ?? Infinity) + (desktopStack?.width ?? 0)).toBeLessThanOrEqual(
    desktopPost?.x ?? -Infinity
  );
  expect((desktopPost?.x ?? Infinity) + (desktopPost?.width ?? 0)).toBeLessThanOrEqual(
    desktopToc?.x ?? -Infinity
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileToc = await page.locator('[data-table-of-contents]').boundingBox();
  const mobilePost = await page.locator('.post-column').boundingBox();
  const mobileStack = await page.locator('[data-sidebar-stack]').boundingBox();
  expect((mobileToc?.y ?? Infinity) + (mobileToc?.height ?? 0)).toBeLessThanOrEqual(
    mobilePost?.y ?? -Infinity
  );
  expect((mobilePost?.y ?? Infinity) + (mobilePost?.height ?? 0)).toBeLessThanOrEqual(
    mobileStack?.y ?? -Infinity
  );
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(sizes.scroll).toBe(sizes.client);
});

test('sidebar stickiness is limited to desktop viewports tall enough for the full stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto('/posts/本科数学大杂烩/');

  const stack = page.locator('[data-sidebar-stack]');
  await expect(stack).toHaveCSS('position', 'relative');
  const finalControl = stack.getByRole('button', { name: '下一首' });
  await finalControl.scrollIntoViewIfNeeded();
  const shortViewportControl = await finalControl.boundingBox();
  expect((shortViewportControl?.y ?? Infinity) + (shortViewportControl?.height ?? 0)).toBeLessThanOrEqual(760);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(stack).toHaveCSS('position', 'sticky');
  await page.evaluate(() => window.scrollTo(0, 2_000));
  const tallViewportStack = await stack.boundingBox();
  expect((tallViewportStack?.y ?? Infinity) + (tallViewportStack?.height ?? 0)).toBeLessThanOrEqual(900);
});

test('Giscus uses the site dark theme and remounts once after client navigation', async ({
  page
}) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.route('https://giscus.app/theme-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `
        <!doctype html>
        <html data-message-count="0">
          <body>
            <script>
              addEventListener('message', (event) => {
                const theme = event.data?.giscus?.setConfig?.theme;
                if (theme !== 'light' && !theme?.startsWith('data:text/css')) return;
                document.documentElement.dataset.theme = theme;
                document.documentElement.dataset.messageCount = String(
                  Number(document.documentElement.dataset.messageCount) + 1
                );
              });
            <\/script>
          </body>
        </html>
      `
    })
  );
  await page.route('https://giscus.app/client.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        (() => {
          const section = document.currentScript?.closest('[data-giscus-comments]');
          const iframe = document.createElement('iframe');
          iframe.className = 'giscus-frame';
          iframe.src = 'https://giscus.app/theme-probe';
          section?.append(iframe);
        })();
      `
    })
  );

  await page.goto('/posts/本科数学大杂烩/');
  await expect(page.locator('[data-giscus-status]')).toBeHidden();
  const script = page.locator('script[src="https://giscus.app/client.js"]');
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute('data-theme', 'light');
  const darkTheme = await page.locator('[data-giscus-comments]').getAttribute('data-giscus-dark-theme');
  expect(darkTheme).toMatch(/^data:text\/css/);
  const giscusFrame = page.locator('iframe.giscus-frame');
  await expect(giscusFrame).toHaveCount(1);
  const frameHtml = page.frameLocator('iframe.giscus-frame').locator('html');
  await expect(frameHtml).toHaveAttribute('data-message-count', '0');

  await page.getByRole('button', { name: '切换主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(frameHtml).toHaveAttribute('data-theme', darkTheme!);
  await expect(frameHtml).toHaveAttribute('data-message-count', '1');

  await page.locator('[data-adjacent-posts] a').first().click();
  await expect(page.locator('article[data-post]')).toBeVisible();
  await expect(page.locator('[data-giscus-status]')).toBeHidden();
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute('data-theme', darkTheme!);
  await expect(page.locator('iframe.giscus-frame')).toHaveCount(1);
  const remountedFrameHtml = page.frameLocator('iframe.giscus-frame').locator('html');
  await expect(remountedFrameHtml).toHaveAttribute('data-message-count', '0');

  await page.getByRole('button', { name: '切换主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(remountedFrameHtml).toHaveAttribute('data-theme', 'light');
  await expect(remountedFrameHtml).toHaveAttribute('data-message-count', '1');
});

test('desktop TOC stays visible while mobile TOC remains collapsible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/本科数学大杂烩/');

  const desktopToc = page.locator('[data-toc-desktop]');
  const mobileToc = page.locator('details[data-toc-mobile]');
  await expect(desktopToc).toBeVisible();
  await expect(desktopToc.locator('details')).toHaveCount(0);
  await expect(desktopToc.locator('a').first()).toBeVisible();
  await expect(mobileToc).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(desktopToc).toBeHidden();
  await expect(mobileToc).toBeVisible();
  await expect(mobileToc).toHaveAttribute('open', '');
  await mobileToc.locator('summary').click();
  await expect(mobileToc).not.toHaveAttribute('open', '');
  await expect(mobileToc.locator('nav')).toBeHidden();
});

test('Giscus failure degrades comments without hiding the article', async ({ page }) => {
  await page.route('https://giscus.app/client.js', (route) => route.abort());
  await page.goto('/posts/本科数学大杂烩/');
  await expect(page.locator('[data-giscus-status]')).toHaveText(
    '评论暂时无法加载，正文内容不受影响'
  );
  await expect(page.locator('article[data-post] .prose')).toBeVisible();
});
