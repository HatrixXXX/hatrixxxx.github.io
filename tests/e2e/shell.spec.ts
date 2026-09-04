import { expect, test } from '@playwright/test';

test('all pages share the brandless right-aligned header', async ({ page }) => {
  for (const path of ['/', '/blog/', '/projects/', '/about/', '/posts/本科数学大杂烩/']) {
    await page.goto(path);
    await expect(page.locator('header[data-site-header] .brand')).toHaveCount(0);
    const controls = page.locator('[data-header-controls]');
    await expect(controls).toBeVisible();
    const box = await controls.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect((viewport?.width ?? 0) - ((box?.x ?? 0) + (box?.width ?? 0))).toBeLessThanOrEqual(37);
    await expect(controls.locator('[data-open-search], [data-theme-toggle]')).toHaveCount(2);
  }
});

test('standard shell renders the compact legal footer', async ({ page }) => {
  await page.goto('/projects/');
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('[data-hero]')).toBeVisible();
  await expect(page.locator('[data-wave-divider]')).toHaveCount(0);

  const footer = page.locator('footer[data-site-footer]');
  await expect(footer).toHaveCount(1);
  await expect(footer).toContainText(`© 2025–${new Date().getFullYear()} Hatrix`);
  await expect(footer.locator('a')).toHaveCount(0);
  const notices = await page.request.get('/third-party-notices.txt');
  expect(notices.ok()).toBe(true);
});

test('favicon metadata is valid in static output', async ({ request }) => {
  const manifestResponse = await request.get('/site.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: '/web-app-manifest-192x192.png' }),
      expect.objectContaining({ src: '/web-app-manifest-512x512.png' })
    ])
  );

  const browserConfigResponse = await request.get('/browserconfig.xml');
  expect(browserConfigResponse.ok()).toBe(true);
  const browserConfig = await browserConfigResponse.text();
  expect(browserConfig).toMatch(/^<\?xml/);
  expect(browserConfig).not.toContain('{{');
});
