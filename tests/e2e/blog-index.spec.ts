import { expect, test } from '@playwright/test';

test('blog index lists every published post', async ({ page, request }) => {
  expect((await request.get('/blog/')).status()).toBe(200);

  await page.goto('/blog/');
  await expect(page.locator('[data-blog-total]')).toHaveText('40');
  await expect(page.locator('article[data-post-card]')).toHaveCount(40);

  const rail = page.locator('[data-post-rail]');
  await expect(rail).toHaveAttribute('tabindex', '0');
  const layout = await rail.evaluate((element) => {
    const cards = [...element.querySelectorAll<HTMLElement>('article[data-post-card]')];
    const tops = cards.slice(0, 4).map((card) => Math.round(card.getBoundingClientRect().top));
    const firstWidth = cards[0]?.getBoundingClientRect().width ?? 0;
    return {
      overflow: element.scrollWidth > element.clientWidth,
      tops,
      firstWidth,
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(layout.overflow).toBe(true);
  expect(new Set(layout.tops).size).toBe(1);
  expect(layout.firstWidth).toBeGreaterThanOrEqual(272);
  expect(layout.firstWidth).toBeLessThanOrEqual(352);
  expect(layout.rootOverflow).toBe(0);

  const dates = await page.locator('article[data-post-card] time').evaluateAll((times) =>
    times.map((time) => Date.parse(time.getAttribute('datetime') ?? ''))
  );
  expect(dates).toHaveLength(40);
  expect(dates.every((date, index) => index === 0 || dates[index - 1] >= date)).toBe(true);
});

test('blog switches between the default card view and time archive', async ({ page }) => {
  await page.goto('/blog/');
  const toggle = page.locator('[data-blog-view-toggle]');
  const cardView = page.locator('[data-blog-card-view]');
  const archiveView = page.locator('[data-blog-archive-view]');

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText('切换到时间归档');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(cardView).toBeVisible();
  await expect(archiveView).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveText('切换到卡片视图');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(cardView).toBeHidden();
  await expect(archiveView).toBeVisible();
  await expect(archiveView.locator('a[href^="/posts/"]')).toHaveCount(40);

  await toggle.click();
  await expect(cardView).toBeVisible();
  await expect(archiveView).toBeHidden();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(cardView).toBeVisible();
});

for (const { route, title, count } of [
  { route: '/blog/tech-notes/', title: '技术笔记', count: 37 },
  { route: '/blog/troubleshooting/', title: '踩坑记录', count: 1 },
  { route: '/blog/life/', title: '生活动态', count: 0 },
  { route: '/blog/recommendations/', title: '好物推荐', count: 2 },
  { route: '/blog/essays/', title: '随笔杂谈', count: 0 }
]) {
  test(`${title} blog type route lists its posts`, async ({ page, request }) => {
    expect((await request.get(route)).status()).toBe(200);

    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('article[data-post-card]')).toHaveCount(count);
    await expect(page.locator('[data-blog-view-toggle]')).toHaveCount(0);
  });
}

for (const route of ['/blog/life/', '/blog/essays/']) {
  test(`${route} shows the empty blog type state`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 2, name: '这个类型还没有文章', exact: true })).toBeVisible();
    await expect(page.getByText('以后写到这类内容时，会放在这里。', { exact: true })).toBeVisible();
  });
}
