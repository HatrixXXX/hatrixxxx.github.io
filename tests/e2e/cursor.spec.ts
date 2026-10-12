import { expect, test } from '@playwright/test';

test('blank blog space keeps the site cursor', async ({ page }) => {
  await page.goto('/blog/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const cursor = await page.evaluate(() => {
    const target = document.elementFromPoint(80, 450);
    if (!target?.classList.contains('coverflow-scene')) throw new Error('Expected blank blog space');
    return getComputedStyle(target).cursor;
  });
  expect(cursor).toContain('/cursors/pointer.cur');
});

test('top header controls use the normal-sized diagonal link crosshair across their full hit areas', async ({ page }) => {
  await page.goto('/blog/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const cursors = await page.evaluate(() => [
    ...document.querySelectorAll<HTMLElement>('.desktop-nav > ul > li, .header-actions button')
  ].flatMap((item) => {
    const rect = item.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    const x = rect.left + rect.width / 2;
    return [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2].map((y) => {
      const target = document.elementFromPoint(x, y);
      return { label: item.textContent?.trim() || item.getAttribute('aria-label'), cursor: target ? getComputedStyle(target).cursor : '' };
    });
  }));
  expect(cursors).not.toHaveLength(0);
  const normalPointer = await page.evaluate(() => getComputedStyle(document.body).cursor.split(', auto')[0]);
  for (const { label, cursor } of cursors) {
    expect(cursor, label ?? undefined).toContain('/cursors/link-nav.png');
    expect(cursor, label ?? undefined).toContain('2dppx) 24 24');
    expect(cursor, label ?? undefined).toContain(normalPointer);
  }
  const size = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/cursors/link-nav.png';
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(size).toEqual({ width: 96, height: 96 });
});
