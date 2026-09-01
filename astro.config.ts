import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkImageStatus from './src/plugins/remark-image-status';

export default defineConfig({
  site: 'https://hatrix.site',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  image: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '/gh/HatrixXXX/Hatrix-s-Blog-Image/**'
      }
    ]
  },
  markdown: {
    remarkPlugins: [remarkMath, remarkImageStatus],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'github-dark' }
  }
});
