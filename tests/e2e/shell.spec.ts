import { expect, test } from '@playwright/test';

test('home shell renders the compact legal footer', async ({ page }) => {
  await page.goto('/');
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
