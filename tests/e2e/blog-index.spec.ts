import { expect, test } from '@playwright/test';

test('blog index lists every published post', async ({ page, request }) => {
  expect((await request.get('/blog/')).status()).toBe(200);

  await page.goto('/blog/');
  await expect(page.locator('[data-blog-total]')).toHaveText('40');
  await expect(page.locator('article[data-post-card]')).toHaveCount(40);

  const dates = await page.locator('article[data-post-card] time').evaluateAll((times) =>
    times.map((time) => Date.parse(time.getAttribute('datetime') ?? ''))
  );
  expect(dates).toHaveLength(40);
  expect(dates.every((date, index) => index === 0 || dates[index - 1] >= date)).toBe(true);
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
  });
}

for (const route of ['/blog/life/', '/blog/essays/']) {
  test(`${route} shows the empty blog type state`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 2, name: '这个类型还没有文章', exact: true })).toBeVisible();
    await expect(page.getByText('以后写到这类内容时，会放在这里。', { exact: true })).toBeVisible();
  });
}
