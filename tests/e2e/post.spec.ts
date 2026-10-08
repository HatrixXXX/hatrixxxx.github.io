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
  const response = await page.goto('/posts/Infra-线性代数/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('article[data-post] h1')).toContainText('线性代数');
  await expect(page.locator('.katex').first()).toBeVisible();

  const firstTocLink = page.locator('[data-table-of-contents] a').first();
  await expect(firstTocLink).toHaveAttribute('href', /^#.+/);
  const firstHeadingId = (await firstTocLink.getAttribute('href'))?.slice(1);
  await expect(page.locator(`#${firstHeadingId}`)).toBeAttached();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new URL('/posts/Infra-线性代数/', 'https://hatrix.site').href
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
  await expect(page.locator('[data-back-button]')).toHaveAttribute('href', '/blog/');
  await expect(page.locator('.breadcrumbs')).toHaveCount(0);
  await expect(page.locator('.post-tags')).toHaveCount(0);
  await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);
});

test('blog navigation and the home entry target the blog index', async ({ page }) => {
  await page.goto('/');
  const homeEntry = page.locator('[data-home-blog]');
  await expect(homeEntry).toHaveAttribute('href', '/blog/');
  await homeEntry.click();
  await expect(page).toHaveURL('/blog/');

  const blogNavigation = page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '博客文章', exact: true });
  await expect(blogNavigation).toHaveAttribute('href', '/blog/');
  await expect(blogNavigation).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-post-coverflow]')).toBeVisible();
});
test('all legacy slugs resolve and the merged FPGA route stays available', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  const slugs = await legacySlugs();
  expect(slugs).toHaveLength(15);

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

  await page.goto('/blog/');
  const mergedFpgaCard = page.locator('[data-post-card]', {
    has: page.locator('h2 a[href="/posts/Xilinx FPGA开发/"]')
  });
  const mergedFpgaLink = mergedFpgaCard.locator('h2 a');
  await mergedFpgaCard.dispatchEvent('click');
  await expect(mergedFpgaCard).toHaveAttribute('data-active', 'true');
  await mergedFpgaLink.click();
  await expect(page).toHaveURL(
    new RegExp(`${encodeURI('/posts/Xilinx FPGA开发/').replace(/[+()]/g, '\\$&')}$`)
  );
  await expect(page.locator('article[data-post] h1')).toContainText('Xilinx FPGA开发');
});

test('Mermaid loader renders targets on astro page-load', async ({ page }) => {
  await page.goto('/posts/Xilinx FPGA开发/');
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
  await page.goto('/posts/Infra-线性代数/');
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(sizes.scroll).toBe(sizes.client);
});

test('post layout places the sidebar, article and TOC in responsive reading order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/Infra-线性代数/');

  const desktopStack = await page.locator('.post-sidebar').boundingBox();
  const desktopPost = await page.locator('.post-column').boundingBox();
  const desktopToc = await page.locator('[data-toc-desktop]').boundingBox();
  expect((desktopPost?.x ?? Infinity) + (desktopPost?.width ?? 0)).toBeLessThanOrEqual(
    desktopStack?.x ?? -Infinity
  );
  expect(desktopToc?.x).toBeGreaterThanOrEqual(desktopStack?.x ?? Infinity);
  expect((desktopToc?.x ?? Infinity) + (desktopToc?.width ?? 0)).toBeLessThanOrEqual(
    (desktopStack?.x ?? -Infinity) + (desktopStack?.width ?? 0)
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileToc = await page.locator('[data-table-of-contents]').boundingBox();
  const mobilePost = await page.locator('.post-column').boundingBox();
  const mobileStack = await page.locator('.post-sidebar').boundingBox();
  expect((mobilePost?.y ?? Infinity) + (mobilePost?.height ?? 0)).toBeLessThanOrEqual(
    mobileStack?.y ?? -Infinity
  );
  expect(mobileToc?.y).toBeGreaterThanOrEqual(mobileStack?.y ?? Infinity);
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(sizes.scroll).toBe(sizes.client);
});

test('desktop post sidebar stays fixed when the full stack fits the viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/Infra-概率论/');

  const stack = page.locator('.post-sidebar');
  await expect(stack).toHaveAttribute('data-sidebar-fixed', 'true');
  await expect(stack).toHaveCSS('position', 'fixed');
  await expect(stack).toHaveCSS('overflow-y', 'visible');
  const before = await stack.boundingBox();
  if (!before) throw new Error('Missing post sidebar bounds');

  await page.evaluate(() => window.scrollTo(0, 1_200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1_200);
  const [after, scrollY] = await Promise.all([
    stack.boundingBox(),
    page.evaluate(() => window.scrollY)
  ]);
  if (!after) throw new Error('Missing scrolled post layout bounds');

  expect(scrollY).toBe(1_200);
  expect(after.y).toBeCloseTo(before.y, 0);
});

test('post back-to-top button appears after scrolling and returns to the page start', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/Infra-概率论/');

  const backToTop = page.locator('[data-back-to-top]');
  await expect(backToTop).toHaveCount(1);
  await expect(backToTop).toHaveAttribute('aria-label', '回到顶部');
  await expect(backToTop).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, 1_200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1_200);
  await expect(backToTop).toBeVisible();
  const buttonBox = await backToTop.boundingBox();
  if (!buttonBox) throw new Error('Missing back-to-top button bounds');
  expect(buttonBox.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox.height).toBeGreaterThanOrEqual(44);

  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(backToTop).toBeHidden();

  await page.goto('/blog/');
  await expect(page.getByRole('button', { name: '回到顶部' })).toHaveCount(0);
});

test('mobile post back button stays between the fixed navigation and article title', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/posts/Infra-线性代数/');

    const [headerBox, backButtonBox, titleBox] = await Promise.all([
      page.locator('[data-site-header]').boundingBox(),
      page.locator('[data-back-button]').boundingBox(),
      page.locator('.post-intro h1').boundingBox()
    ]);
    if (!headerBox || !backButtonBox || !titleBox) throw new Error('Missing mobile post bounds');

    expect(backButtonBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    expect(backButtonBox.y + backButtonBox.height).toBeLessThanOrEqual(titleBox.y);
  }
});

test('table of contents keeps every heading visible on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/Infra-线性代数/');

  const toc = page.locator('[data-toc-desktop]');
  const items = toc.locator('li[data-depth]');
  const initialState = await items.evaluateAll((elements) => elements.map((element) => ({
    depth: Number((element as HTMLElement).dataset.depth),
    hidden: (element as HTMLElement).hidden
  })));
  expect(initialState.some(({ depth }) => depth > 2)).toBe(true);
  expect(initialState.every(({ hidden }) => !hidden)).toBe(true);
  await expect(toc.locator('a[aria-expanded]')).toHaveCount(0);

  const firstNestedLink = toc.locator('li[data-depth="3"] a').first();
  const targetId = (await firstNestedLink.getAttribute('href'))?.slice(1);
  if (!targetId) throw new Error('Missing nested TOC target');

  await page.evaluate((slug) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const heading = document.getElementById(slug);
    if (heading) window.scrollTo(0, heading.offsetTop);
  }, targetId);
  await expect(firstNestedLink).toHaveAttribute('aria-current', 'location');
  await expect(firstNestedLink).toBeVisible();

  const mobileState = await page.locator(
    '[data-toc-mobile] li[data-depth="3"], [data-toc-mobile] li[data-depth="4"]'
  ).evaluateAll((elements) => elements.map((element) => (element as HTMLElement).hidden));
  expect(mobileState.length).toBeGreaterThan(0);
  expect(mobileState.every((hidden) => !hidden)).toBe(true);
});

test('table of contents updates after a heading jumps across the observer band', async ({ page }) => {
  await page.addInitScript(() => {
    class SilentIntersectionObserver {
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
      disconnect() {}
      observe() {}
      takeRecords() { return []; }
      unobserve() {}
    }
    window.IntersectionObserver = SilentIntersectionObserver as unknown as typeof IntersectionObserver;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/Infra-线性代数/');

  const nestedLink = page.locator('[data-toc-desktop] li[data-depth="3"] a').first();
  const targetId = (await nestedLink.getAttribute('href'))?.slice(1);
  if (!targetId) throw new Error('Missing nested TOC target');

  await page.evaluate((slug) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const heading = document.getElementById(slug);
    if (heading) window.scrollTo(0, heading.offsetTop);
  }, targetId);

  await expect(nestedLink).toHaveAttribute('aria-current', 'location');
  await expect(nestedLink).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  const firstDesktopLevelTwo = page.locator('[data-toc-desktop] a[data-toc-depth="2"]').first();
  const firstMobileLevelTwo = page.locator('[data-toc-mobile] a[data-toc-depth="2"]').first();
  await expect(firstDesktopLevelTwo).toHaveAttribute('aria-current', 'location');
  await expect(firstMobileLevelTwo).toHaveAttribute('aria-current', 'location');
  await expect(nestedLink).not.toHaveAttribute('aria-current', 'location');
  await expect(nestedLink).toBeVisible();
});

test('post sidebar retains the latest article allocation with a full table of contents', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/posts/Infra-线性代数/');

  await expect(page.locator('[data-latest-posts] .latest-item')).toHaveCount(3);
});

test('short desktop viewports lay out the full sidebar without internal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/posts/Infra-线性代数/');

  const sidebar = page.locator('.post-sidebar');
  await expect(sidebar).not.toHaveAttribute('data-sidebar-fixed');
  await expect(sidebar).toHaveCSS('position', 'static');
  await expect(sidebar).toHaveCSS('max-height', 'none');
  await expect(sidebar).toHaveCSS('overflow-y', 'visible');
  const dimensions = await sidebar.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop
  }));
  expect(dimensions.scrollHeight).toBe(dimensions.clientHeight);
  expect(dimensions.scrollTop).toBe(0);

  await sidebar.evaluate((element) => { element.scrollTop = 200; });
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBe(0);
  const [sidebarBox, lastLatestBox] = await Promise.all([
    sidebar.boundingBox(),
    page.locator('[data-latest-posts] .latest-item').last().boundingBox()
  ]);
  if (!sidebarBox || !lastLatestBox) throw new Error('Missing short viewport sidebar bounds');
  expect(lastLatestBox.y + lastLatestBox.height).toBeLessThanOrEqual(sidebarBox.y + sidebarBox.height + 1);

  const pageStart = await page.evaluate(() => window.scrollY);
  await page.mouse.move(sidebarBox.x + sidebarBox.width / 2, sidebarBox.y + 100);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(pageStart);
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

  await page.goto('/posts/Infra-线性代数/');
  await expect(page.locator('[data-giscus-status]')).toBeHidden();
  const script = page.locator('script[src="https://giscus.app/client.js"]');
  await expect(script).toHaveCount(1);
  const darkTheme = await page.locator('[data-giscus-comments]').getAttribute('data-giscus-dark-theme');
  expect(darkTheme).toMatch(/^data:text\/css/);
  await expect(script).toHaveAttribute('data-theme', 'light');
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

  await page.goto('/guestbook/');
  const guestbookComments = page.locator('[data-giscus-comments]');
  const guestbookDarkTheme = await guestbookComments.getAttribute('data-giscus-dark-theme');
  await expect(guestbookComments).toHaveAttribute('data-giscus-theme-mode', 'dark');
  const guestbookScript = guestbookComments.locator('script[src="https://giscus.app/client.js"]');
  await expect(guestbookScript).toHaveAttribute('data-theme', guestbookDarkTheme!);
  const guestbookFrameHtml = page.frameLocator('iframe.giscus-frame').locator('html');

  await page.getByRole('button', { name: '切换主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(guestbookFrameHtml).toHaveAttribute('data-theme', guestbookDarkTheme!);
  await page.getByRole('button', { name: '切换主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(guestbookFrameHtml).toHaveAttribute('data-theme', guestbookDarkTheme!);
});

test('desktop TOC stays visible while mobile TOC remains collapsible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/Infra-线性代数/');

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
  await page.goto('/posts/Infra-线性代数/');
  await expect(page.locator('[data-giscus-status]')).toHaveText(
    '评论暂时无法加载，正文内容不受影响'
  );
  await expect(page.locator('article[data-post] .prose')).toBeVisible();
});
