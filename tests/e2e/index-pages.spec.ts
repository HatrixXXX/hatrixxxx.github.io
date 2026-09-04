import { expect, test } from '@playwright/test';

const generatedRoutes = [
  '/blog/',
  '/blog/tech-notes/',
  '/blog/troubleshooting/',
  '/blog/life/',
  '/blog/recommendations/',
  '/blog/essays/',
  '/about/hobbies/',
  '/about/research/',
  '/about/reading/',
  '/about/games/',
  '/about/albums/',
  '/about/gear/',
  '/about/tools/',
  '/about/bookmarks/',
  '/about/friends/',
  '/guestbook/'
];

for (const route of generatedRoutes) {
  test(`${route} is generated`, async ({ request }) => {
    expect((await request.get(route)).status()).toBe(200);
  });
}

test('content index pages reflect migrated data', async ({ page, request }) => {
  await page.goto('/archives/');
  await expect(page.locator('[data-archive-total]')).toHaveText('40');

  for (const route of ['/categories/', '/tags/']) {
    expect((await request.get(route)).status()).toBe(404);
  }

  await page.goto('/projects/');
  await expect(page.getByText('作品内容还没添加')).toBeVisible();

  await page.goto('/about/');
  await expect(page.locator('main').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /HatrixXXX/);

  const rss = await (await request.get('/rss.xml')).text();
  expect((rss.match(/<item>/g) ?? []).length).toBe(40);
  expect(rss).not.toContain('<content:encoded');

  const searchResponse = await request.get('/search-index.json');
  expect(searchResponse.headers()['content-type']).toMatch(/^application\/json/);
  const search = await searchResponse.json();
  expect(search).toHaveLength(40);
  for (const document of search) {
    expect(document).not.toHaveProperty('category');
    expect(document).not.toHaveProperty('tags');
    expect(document.text).not.toMatch(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\s*\/?>|<!--[\s\S]*?-->|```|!\[|\]\([^)]*\)/);
  }
});

test('blog and archive indexes omit contextual sidebar cards', async ({ page }) => {
  for (const path of ['/blog/', '/archives/']) {
    await page.goto(path);
    await expect(page.locator('[data-sidebar-stack], [data-music-player]')).toHaveCount(0);
  }
});

test('locked public surfaces expose only public metadata and an accessible lock marker', async ({ page }) => {
  await page.goto('/__tests__/locked-index/');

  const cardLink = page.locator('[data-post-card] h2 a');
  await expect(cardLink).toHaveAttribute('data-locked-link', '');
  await expect(cardLink.getByRole('img', { name: '加锁内容' })).toBeVisible();

  for (const surface of ['footer', 'archive', 'adjacent']) {
    const fixture = page.locator(`[data-lock-surface="${surface}"]`);
    const lockedLink = fixture.locator('[data-fixture-state="locked"]');
    const publicLink = fixture.locator('[data-fixture-state="public"]');
    await expect(lockedLink).toHaveAttribute('data-locked-link', '');
    await expect(lockedLink.getByRole('img', { name: '加锁内容' })).toBeVisible();
    await expect(publicLink).not.toHaveAttribute('data-locked-link', '');
    await expect(publicLink.getByRole('img', { name: '加锁内容' })).toHaveCount(0);
    if (surface === 'adjacent') {
      await expect(lockedLink.locator(':scope > span')).toHaveText('上一篇');
      await expect(lockedLink.locator('strong')).toContainText('公开的加锁文章标题');
      await expect(lockedLink.locator('strong').getByRole('img', { name: '加锁内容' })).toBeVisible();
      await expect(publicLink.locator(':scope > span')).toHaveText('上一篇');
      await expect(publicLink.locator('strong').getByRole('img', { name: '加锁内容' })).toHaveCount(0);
    }
  }

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('locked search results contain a public summary and lock marker', async ({ page }) => {
  await page.route('**/search-index.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'locked-search-fixture',
        url: '/posts/locked-search-fixture/',
        title: 'Public locked title',
        description: 'Public locked summary',
        locked: true,
        text: 'Public locked title Public locked summary'
      }])
    });
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('searchbox', { name: '搜索文章' }).fill('Public locked title');

  const result = page.locator('[data-search-result]');
  await expect(result).toHaveAttribute('data-locked-link', '');
  await expect(result).toContainText('Public locked summary');
  await expect(result).not.toContainText('distinctive-private-body-marker');
  await expect(result.getByRole('img', { name: '加锁内容' })).toBeVisible();
});

test('404 retains site navigation', async ({ page }) => {
  const response = await page.goto('/missing-index-page-task-8/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/404\.html$/);
});
