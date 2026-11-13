import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import sitemap from '@astrojs/sitemap';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { siteMarkdownConfig } from './src/config/markdown';
import { LOCKED_PAGE_PATHS, normalizeRoutePath } from './src/config/protected-content';
import { snippetRoot } from './src/lib/snippet-root';
import { snippetIdFromFile, snippetPath } from './src/lib/snippets';
import { sanctuaryRoot } from './src/lib/sanctuary-root';
import { sanctuaryPath } from './src/lib/sanctuary';
import { APPROVED_IMAGE_REFS, IMAGE_REPOSITORY } from './src/lib/safe-url';
import { postPath, previousPostSlugs } from './src/lib/urls';

const postRedirects = Object.fromEntries(
  Object.entries(previousPostSlugs).map(([current, previous]) => [
    postPath(previous),
    { status: 301 as const, destination: postPath(current) }
  ])
);

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return /\.mdx?$/i.test(entry.name) ? [path] : [];
  });
}

function sitemapExcludedRoutes(): Set<string> {
  const legacyRedirectPaths = [
    '/blog/', '/blog/all/', '/projects/', '/about/bookmarks/',
    '/about/software/', '/about/friends/', '/lab/'
  ];
  const routes = new Set([
    ...LOCKED_PAGE_PATHS, ...legacyRedirectPaths, ...Object.keys(postRedirects)
  ].map(normalizeRoutePath));

  const snippetsRoot = snippetRoot('snippets');
  if (existsSync(snippetsRoot)) {
    for (const file of markdownFiles(snippetsRoot)) {
      routes.add(normalizeRoutePath(snippetPath(snippetIdFromFile(basename(file)))));
    }
  }
  const sanctuaryRootPath = sanctuaryRoot('sanctuary');
  if (existsSync(sanctuaryRootPath)) {
    for (const file of markdownFiles(sanctuaryRootPath)) {
      routes.add(normalizeRoutePath(sanctuaryPath(basename(file).replace(/\.md$/i, ''))));
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
  redirects: postRedirects,
  devToolbar: { enabled: process.env.PLAYWRIGHT_TEST !== '1' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      filter: (page) => !excludedFromSitemap.has(normalizeRoutePath(page))
    }),
    ...(process.env.PLAYWRIGHT_TEST === '1' ? [playwrightTestRoutes] : [])
  ],
  image: {
    remotePatterns: APPROVED_IMAGE_REFS.flatMap((ref) => [
      {
        protocol: 'https' as const,
        hostname: 'cdn.jsdelivr.net',
        pathname: `/gh/${IMAGE_REPOSITORY}@${ref}/img/**`
      },
      {
        protocol: 'https' as const,
        hostname: 'raw.githubusercontent.com',
        pathname: `/${IMAGE_REPOSITORY}/${ref}/img/**`
      }
    ])
  },
  vite: {
    // Concurrent local dev servers must not overwrite one another's optimized deps.
    cacheDir: `node_modules/.vite-${process.pid}`,
    optimizeDeps: { include: ['mermaid', 'sakana'] },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/mermaid') || id.includes('node_modules/cytoscape') || id.includes('node_modules/dagre')) return 'mermaid';
            if (id.includes('node_modules/katex')) return 'katex';
            if (id.includes('node_modules/photoswipe')) return 'photoswipe';
            if (id.includes('node_modules/sakana')) return 'sakana';
          }
        }
      }
    }
  },
  markdown: siteMarkdownConfig
});
