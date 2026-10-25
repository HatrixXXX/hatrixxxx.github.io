import { expect, test } from '@playwright/test';

const generatedRoutes = [
  '/blogs/',
  '/blog/all/',
  '/creation/',
  '/about/hobbies/',
  '/about/research/',
  '/about/reading/',
  '/about/games/',
  '/about/albums/',
  '/snippets/',
  '/toolbox/',
  '/favorites/',
  '/friends/',
  '/playground/',
  '/guestbook/'
];

for (const route of generatedRoutes) {
  test(`${route} is generated`, async ({ request }) => {
    expect((await request.get(route)).status()).toBe(200);
  });
}

for (const [legacyRoute, canonicalRoute] of [
  ['/blog/', '/blogs/'],
  ['/blog/all/', '/blogs/'],
  ['/projects/', '/creation/'],
  ['/about/bookmarks/', '/favorites/'],
  ['/about/software/', '/toolbox/'],
  ['/about/friends/', '/friends/'],
  ['/lab/', '/playground/']
] as const) {
  test(`${legacyRoute} redirects to ${canonicalRoute}`, async ({ page }) => {
    await page.goto(legacyRoute);
    await expect(page).toHaveURL(canonicalRoute);
  });
}

test('/about/tools/ is no longer generated', async ({ request }) => {
  expect((await request.get('/about/tools/')).status()).toBe(404);
});

test('/about/gear/ is no longer generated', async ({ request }) => {
  expect((await request.get('/about/gear/')).status()).toBe(404);
});

test('content index pages reflect migrated data', async ({ page, request }) => {
  await page.goto('/archives/');
  await expect(page.locator('[data-archive-total]')).toHaveText('14');

  for (const route of ['/categories/', '/tags/']) {
    expect((await request.get(route)).status()).toBe(404);
  }

  await page.goto('/creation/');
  await expect(page.getByText('作品内容还没添加')).toHaveCount(0);
  await expect(page.locator('[data-project-badge]')).toHaveCount(15);

  await page.goto('/about/hobbies/');
  await expect(page.locator('main').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /HatrixXXX/);

  const rss = await (await request.get('/rss.xml')).text();
  expect((rss.match(/<item>/g) ?? []).length).toBe(14);
  expect(rss).not.toContain('<content:encoded');

  const searchResponse = await request.get('/search-index.json');
  expect(searchResponse.headers()['content-type']).toMatch(/^application\/json/);
  const search = await searchResponse.json();
  expect(search.filter((document: { url: string }) => document.url.startsWith('/posts/'))).toHaveLength(14);
  for (const document of search) {
    expect(document).not.toHaveProperty('category');
    expect(document).not.toHaveProperty('tags');
    expect(document.text).not.toMatch(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\s*\/?>|<!--[\s\S]*?-->|```|!\[|\]\([^)]*\)/);
  }
});

test('ordinary index pages omit contextual sidebars and keep the docked player', async ({ page }) => {
  for (const path of [
    '/blogs/',
    '/blog/all/',
    '/archives/',
    '/creation/',
    '/guestbook/',
    '/404.html'
  ]) {
    await page.goto(path);
    await expect(page.locator('[data-sidebar-stack]')).toHaveCount(0);
    await expect(page.locator('[data-music-player]')).toHaveCount(1);
  }
});

test('blog cards and links stay public after legacy locked metadata is removed', async ({ page }) => {
  await page.goto('/__tests__/locked-index/');

  const cardLink = page.locator('[data-post-card] h2 a');
  await expect(cardLink).not.toHaveAttribute('data-locked-link', '');
  await expect(cardLink.getByRole('img', { name: '加锁内容' })).toHaveCount(0);

  for (const surface of ['footer', 'archive', 'adjacent']) {
    const fixture = page.locator(`[data-post-link-surface="${surface}"]`);
    const legacyLink = fixture.locator('[data-fixture-state="legacy"]');
    const publicLink = fixture.locator('[data-fixture-state="public"]');
    await expect(legacyLink).not.toHaveAttribute('data-locked-link', '');
    await expect(legacyLink.getByRole('img', { name: '加锁内容' })).toHaveCount(0);
    await expect(publicLink).not.toHaveAttribute('data-locked-link', '');
    await expect(publicLink.getByRole('img', { name: '加锁内容' })).toHaveCount(0);
    if (surface === 'adjacent') {
      await expect(legacyLink.locator(':scope > span')).toHaveText('上一篇');
      await expect(legacyLink.locator('strong')).toContainText('旧字段公开文章标题');
      await expect(legacyLink.locator('strong').getByRole('img', { name: '加锁内容' })).toHaveCount(0);
      await expect(publicLink.locator(':scope > span')).toHaveText('上一篇');
      await expect(publicLink.locator('strong').getByRole('img', { name: '加锁内容' })).toHaveCount(0);
    }
  }

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('documents explicitly marked protected are excluded from public search results', async ({ page }) => {
  await page.route('**/search-index.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'protected-search-fixture',
        url: '/sanctuary/protected-search-fixture/',
        title: 'Protected fixture title',
        description: 'Protected fixture summary',
        locked: true,
        text: 'Protected fixture title Protected fixture summary'
      }])
    });
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('searchbox', { name: '搜索全站' }).fill('Protected fixture title');

  await expect(page.locator('[data-search-result]')).toHaveCount(0);
  await expect(page.locator('[data-search-status]')).toHaveText('没有找到相关内容');
});

test('404 retains site navigation', async ({ page }) => {
  const response = await page.goto('/missing-index-page-task-8/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/404\.html$/);
});
