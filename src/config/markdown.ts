import type { AstroMarkdownOptions } from '@astrojs/markdown-remark';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkContentSecurity from '../plugins/remark-content-security';
import remarkImageStatus from '../plugins/remark-image-status';

export const siteMarkdownConfig = {
  remarkPlugins: [remarkMath, remarkContentSecurity, remarkImageStatus],
  rehypePlugins: [rehypeKatex],
  shikiConfig: { theme: 'github-dark' }
} satisfies AstroMarkdownOptions;
