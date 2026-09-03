import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import sitemap from '@astrojs/sitemap';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { siteMarkdownConfig } from './src/config/markdown';
import { LOCKED_PAGE_PATHS, normalizeRoutePath } from './src/config/protected-content';
import { postPath } from './src/lib/urls';

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return /\.mdx?$/i.test(entry.name) ? [path] : [];
  });
}

function sitemapExcludedRoutes(): Set<string> {
  const configuredContentRoot = process.env.HATRIX_CONTENT_DIR;
  const privatePostsRoot = resolve(configuredContentRoot ?? '.private-content', 'posts');
  const postsRoot = existsSync(privatePostsRoot)
    ? privatePostsRoot
    : resolve('src/content/posts');
  const routes = new Set(LOCKED_PAGE_PATHS.map(normalizeRoutePath));

  if (!existsSync(postsRoot)) return routes;
  for (const file of markdownFiles(postsRoot)) {
    const { data } = matter(readFileSync(file, 'utf8'));
    if (data.locked === true && data.draft !== true && typeof data.legacySlug === 'string') {
      routes.add(normalizeRoutePath(postPath(data.legacySlug)));
    }
  }
  return routes;
}

const excludedFromSitemap = sitemapExcludedRoutes();

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
  integrations: [
    sitemap({
      filter: (page) => !excludedFromSitemap.has(normalizeRoutePath(page))
    }),
    ...(process.env.PLAYWRIGHT_TEST === '1' ? [playwrightTestRoutes] : [])
  ],
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
