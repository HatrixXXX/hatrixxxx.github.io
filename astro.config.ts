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
  const routes = new Set([...LOCKED_PAGE_PATHS, ...legacyRedirectPaths].map(normalizeRoutePath));

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
  devToolbar: { enabled: process.env.PLAYWRIGHT_TEST !== '1' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
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
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@e1af43b0b1a55b22abbd0e2b5ea4462f39ebbd5f/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/e1af43b0b1a55b22abbd0e2b5ea4462f39ebbd5f/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@bd11445cc9e2c936b541ddba344fdec5626af760/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/bd11445cc9e2c936b541ddba344fdec5626af760/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@a15a30bfcfce393c3d8becb3e30f5c522a5d4a39/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/a15a30bfcfce393c3d8becb3e30f5c522a5d4a39/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@ca57384431a84f631bed0b81ec3c650d41d236d9/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/ca57384431a84f631bed0b81ec3c650d41d236d9/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@cac3bf8760863aaedf7123c5ddb89a467ff50563/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/cac3bf8760863aaedf7123c5ddb89a467ff50563/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@4407a4d00112cc1f72c23da96a210de91efab3b0/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/4407a4d00112cc1f72c23da96a210de91efab3b0/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@b4dd348363960f7d4b41f3cd95d9c6f00a02fe48/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@102d16687d19b8ba0b77fe930830465245d78294/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@a34cd33600165dd0b2b40e041434f85c54aaed07/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@ecfcb3dda864171cefb1378d825d72b8dfb888b1/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@862364364b52dea2a7cbecbd05366384062a72a8/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@14fb8e3c7367606ca612ff86dba8dbcb2c6ffdf3/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@f8a3ab002fda4774f2bfe343a7d815aa71b3f8d7/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@ad3ce28aaf48bb45f2b0c3564259bb39026d936f/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@340c74e3150add75e7a97976a595e042f78f005f/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@a7255199e50b515b4bd5524938b2e66f4dd02985/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@0f5ede863cbb8f2fad5eaf2c84bab90ef19140ed/img/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname:
          '/gh/HatrixXXX/Hatrix-s-Blog-Image@e24163cebfe5e007f018f59c0599c0650ddf7fa9/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/b4dd348363960f7d4b41f3cd95d9c6f00a02fe48/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/102d16687d19b8ba0b77fe930830465245d78294/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/a34cd33600165dd0b2b40e041434f85c54aaed07/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/ecfcb3dda864171cefb1378d825d72b8dfb888b1/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/862364364b52dea2a7cbecbd05366384062a72a8/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/14fb8e3c7367606ca612ff86dba8dbcb2c6ffdf3/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/f8a3ab002fda4774f2bfe343a7d815aa71b3f8d7/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/ad3ce28aaf48bb45f2b0c3564259bb39026d936f/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/340c74e3150add75e7a97976a595e042f78f005f/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/a7255199e50b515b4bd5524938b2e66f4dd02985/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/0f5ede863cbb8f2fad5eaf2c84bab90ef19140ed/img/**'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname:
          '/HatrixXXX/Hatrix-s-Blog-Image/e24163cebfe5e007f018f59c0599c0650ddf7fa9/img/**'
      }
    ]
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
