import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('search index includes public pages and individual cards without locked content', async ({ request }) => {
  const response = await request.get('/search-index.json');
  expect(response.ok()).toBe(true);
  const documents = await response.json() as Array<{
    url: string;
    title: string;
    text: string;
    locked: boolean;
  }>;

  for (const url of ['/', '/blogs/', '/creation/', '/about/', '/about/research/', '/favorites/', '/toolbox/', '/friends/', '/guestbook/', '/playground/', '/archives/']) {
    expect(documents.some((document) => document.url === url), `${url} should be searchable`).toBe(true);
  }
  expect(documents.some((document) => document.title === 'HDL Bits' && document.url.startsWith('/favorites/?bookmark='))).toBe(true);
  expect(documents.some((document) => document.title === 'Vivado' && document.url.startsWith('/toolbox/?tool='))).toBe(true);
  expect(documents.some((document) => document.title === 'CoNet 在线笔记' && document.url.startsWith('/creation/?project='))).toBe(true);
  expect(documents.some((document) => document.title === 'Polaris' || document.url === 'https://polaris.xn--6qq986b3xl/')).toBe(false);
  expect(documents.every((document) => document.url.startsWith('/'))).toBe(true);
  expect(documents.some((document) => document.url === '/snippets/' || document.url === '/plans/' || document.url === '/digest/')).toBe(false);
  expect(documents.some((document) => document.locked)).toBe(false);
});

test('a bookmark result selects its entry on the favorites page', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.getByRole('searchbox', { name: '搜索全站' }).fill('HDL Bits');

  const result = page.locator('[data-search-result]').filter({ has: page.locator('strong', { hasText: /^HDL Bits$/ }) });
  await expect(result).toHaveAttribute('href', /\/favorites\/\?bookmark=\d+/);
  await result.click();
  await expect(page).toHaveURL(/\/favorites\/\?bookmark=\d+/);
  await expect(page.locator('[data-favorites-selected]')).toHaveText('HDL Bits');
  await expect(page.locator('[data-favorites-item][data-selected="true"]')).toHaveAttribute('data-title', 'HDL Bits');
  await expect(page.locator('[data-favorites-item][data-selected="true"]')).toHaveAttribute('data-url', 'https://hdlbits.01xz.net/wiki/Problem_sets');
});

test('a tool result highlights its card briefly on the toolbox page', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.getByRole('searchbox', { name: '搜索全站' }).fill('Vivado');
  const result = page.locator('[data-search-result]').filter({ has: page.locator('strong', { hasText: /^Vivado$/ }) });
  await expect(result).toHaveAttribute('href', /\/toolbox\/\?tool=\d+/);
  await result.click();

  await expect(page).toHaveURL(/\/toolbox\/\?tool=\d+/);
  const card = page.locator('[data-tool-module][data-search-highlight]');
  await expect(card.locator('[data-tool-title]')).toHaveText('Vivado');
  await expect(card).toBeInViewport();
  await expect(card).toHaveCSS('outline-style', 'solid');
  await expect(card).toHaveCount(0, { timeout: 5000 });
});

test('search never creates a clickable result for an unsafe destination', async ({ page }) => {
  await page.route('**/search-index.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'unsafe-destination',
      url: 'javascript:alert(1)',
      title: 'Unsafe destination',
      locked: false,
      text: 'Unsafe destination',
      paragraphs: []
    }])
  }));
  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.getByRole('searchbox', { name: '搜索全站' }).fill('Unsafe destination');
  await expect(page.locator('[data-search-result]')).toHaveCount(0);
});

test('a project search result opens the selected project detail', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.getByRole('searchbox', { name: '搜索全站' }).fill('CoNet 在线笔记');
  await page.locator('[data-search-result]', { hasText: 'CoNet 在线笔记' }).click();

  await expect(page).toHaveURL(/\/creation\/\?project=/);
  await expect(page.locator('[data-project-dialog]')).toBeVisible();
  await expect(page.locator('[data-project-dialog]')).toHaveAttribute('aria-label', '作品详情：CoNet 在线笔记');
});
