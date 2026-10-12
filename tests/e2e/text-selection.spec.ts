import { expect, test, type Locator, type Page } from '@playwright/test';

async function dragAcrossText(page: Page, target: Locator): Promise<string> {
  const rect = await target.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent?.trim()) node = walker.nextNode();
    if (!node?.textContent) throw new Error('Text target has no selectable text');

    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, Math.min(node.textContent.length, 12));
    const { left, right, top, bottom } = range.getClientRects()[0];
    window.getSelection()?.removeAllRanges();
    return { left, right, top, bottom };
  });

  const y = (rect.top + rect.bottom) / 2;
  await page.mouse.move(rect.left + 1, y);
  await page.mouse.down();
  await page.mouse.move(Math.min(rect.right - 1, rect.left + 90), y, { steps: 8 });
  await page.mouse.up();
  return page.evaluate(() => window.getSelection()?.toString() ?? '');
}

test('dragging selects article body text but not surrounding page text', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  expect(await dragAcrossText(page, page.locator('.about-main h1'))).toBe('');

  await page.goto('/posts/Infra-线性代数/');
  await expect(page.locator('#page-loader')).toBeHidden();
  expect(await dragAcrossText(page, page.locator('.post-intro h1'))).toBe('');
  expect(await dragAcrossText(page, page.locator('article[data-post] .prose p').first())).not.toBe('');

  await page.locator('article[data-post]').evaluate((article) => {
    const mount = document.createElement('div');
    mount.dataset.protectedMount = '';
    mount.innerHTML = '<div class="prose"><p><code>selectable code</code> <a href="#article-link">selectable link</a></p></div>';
    article.append(mount);
  });
  const mountedBody = page.locator('article[data-post] [data-protected-mount] .prose');
  expect(await dragAcrossText(page, mountedBody.locator('code'))).not.toBe('');
  await expect(mountedBody.locator('a')).toHaveCSS('user-select', 'text');
});

test('search input and dynamically added editable text remain selectable', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();

  await page.keyboard.press('Control+K');
  const search = page.locator('[data-search-input]');
  await search.fill('searchable');
  await search.press('Control+A');
  expect(await search.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([0, 10]);
  await page.keyboard.press('Escape');

  const editable = page.locator('.about-main [contenteditable]');
  await page.locator('.about-main').evaluate((main) => {
    const element = document.createElement('div');
    element.contentEditable = 'true';
    element.textContent = 'editable content';
    main.append(element);
  });
  expect(await dragAcrossText(page, editable)).not.toBe('');
});
