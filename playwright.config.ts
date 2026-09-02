import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
  webServer: {
    command: 'corepack pnpm dev --host 127.0.0.1',
    env: { ASTRO_DEV_BACKGROUND: '0', PLAYWRIGHT_TEST: '1' },
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'tablet-768',
      testMatch: ['**/visual.spec.ts', '**/accessibility.spec.ts'],
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } }
    },
    {
      name: 'mobile-390',
      testMatch: ['**/visual.spec.ts', '**/accessibility.spec.ts'],
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 } }
    }
  ]
});
