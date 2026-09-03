import { expect, test } from '@playwright/test';

test('home shell omits the removed site footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('[data-hero]')).toBeVisible();
  await expect(page.locator('[data-wave-divider]')).toBeVisible();
  await expect(page.locator('footer[data-site-footer]')).toHaveCount(0);
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
