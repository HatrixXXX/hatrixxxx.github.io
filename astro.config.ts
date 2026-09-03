import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkContentSecurity from './src/plugins/remark-content-security';
import remarkImageStatus from './src/plugins/remark-image-status';

export default defineConfig({
  site: 'https://hatrix.site',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: process.env.PLAYWRIGHT_TEST !== '1' },
  integrations: [sitemap()],
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
  markdown: {
    remarkPlugins: [remarkMath, remarkContentSecurity, remarkImageStatus],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'github-dark' }
  }
});
