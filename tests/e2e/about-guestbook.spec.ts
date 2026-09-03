import { expect, test } from '@playwright/test';
import { ABOUT_SECTION_LINKS } from '../../src/config/navigation';

test('about section routes render their labels and empty states', async ({ page }) => {
  for (const section of ABOUT_SECTION_LINKS) {
    const response = await page.goto(section.href);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(section.label);
    await expect(page.getByText('内容还在整理')).toBeVisible();
  }
});

test('guestbook uses pathname-mapped Giscus comments', async ({ page }) => {
  await page.route('https://giscus.app/**', (route) => route.abort());
  const response = await page.goto('/guestbook/');

  expect(response?.status()).toBe(200);
  const comments = page.locator('[data-giscus-comments]');
  await expect(comments.getByRole('heading', { name: '留言' })).toBeVisible();
  await expect(comments).toHaveAttribute('data-giscus-mapping', 'pathname');
});
