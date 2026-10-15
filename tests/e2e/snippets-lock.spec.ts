import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import matter from 'gray-matter';
import { snippetRoot } from '../../src/lib/snippet-root';
import { snippetIdFromFile, snippetPath } from '../../src/lib/snippets';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('snippet overview and detail require the existing admin key', async ({ page, request }) => {
  const root = snippetRoot('snippets');
  const files = (await readdir(root)).filter((name) => name.endsWith('.md'));
  const first = files[0];
  const source = first ? matter(await readFile(join(root, first), 'utf8')) : undefined;
  const title = source?.data.title as string | undefined;
  const description = source?.data.description as string | undefined;
  const snippetRoute = first ? snippetPath(snippetIdFromFile(first)) : undefined;

  for (const route of ['/snippets/', ...(snippetRoute ? [snippetRoute] : [])]) {
    const html = await (await request.get(route)).text();
    expect(html).toContain('data-protected-gate');
    if (title) expect(html).not.toContain(title);
    if (description) expect(html).not.toContain(description);
  }

  await page.goto('/snippets/');
  await expect(page.locator('.snippet-card')).toHaveCount(0);
  await expect(page.locator('[data-unlock-form]')).toBeVisible();
  await page.locator('[data-unlock-form] input[name="key"]').fill('wrong-key');
  await page.locator('[data-unlock-form] button[type="submit"]').click();
  await expect(page.locator('[data-unlock-status]')).toHaveText('Key 不正确，请重试');
  await expect(page.locator('.snippet-card')).toHaveCount(0);
  await page.locator('[data-unlock-form] input[name="key"]').fill('test-admin');
  await page.locator('[data-unlock-form] button[type="submit"]').click();
  await expect(page.locator('[data-protected-gate]')).toHaveAttribute('data-protected-state', 'ready');
  await expect(page.locator('.snippet-card')).toHaveCount(files.length);
  await expect(page.locator('[data-timeline-body]')).toHaveAttribute('data-motion', /active|reduced/);

  if (!snippetRoute || !title) return;
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' }));
  const savedScroll = await page.evaluate(() => window.scrollY);
  expect(savedScroll).toBeGreaterThan(100);
  await page.locator(`.snippet-card[href="${snippetRoute}"]`).evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page).toHaveURL(snippetRoute);
  await expect(page.locator('[data-protected-gate]')).toHaveAttribute('data-protected-state', 'ready');
  await expect(page.locator('.snippet-entry-header h1')).toHaveText(title);
  await page.locator('[data-back-button]').click();
  await expect(page).toHaveURL('/snippets/');
  await expect(page.locator('[data-protected-gate]')).toHaveAttribute('data-protected-state', 'ready');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(savedScroll - 60);
});
