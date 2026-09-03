import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import sitemap from '@astrojs/sitemap';
import { siteMarkdownConfig } from './src/config/markdown';

const playwrightTestRoutes: AstroIntegration = {
  name: 'playwright-test-routes',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({
        pattern: '/__tests__/[slug]',
        entrypoint: new URL('./src/pages/__tests__/[slug].astro', import.meta.url),
        prerender: true
      });
    }
  }
};

export default defineConfig({
  site: 'https://hatrix.site',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: process.env.PLAYWRIGHT_TEST !== '1' },
  integrations: [sitemap(), ...(process.env.PLAYWRIGHT_TEST === '1' ? [playwrightTestRoutes] : [])],
  image: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/**'
      }
    ]
  },
  markdown: siteMarkdownConfig
});
