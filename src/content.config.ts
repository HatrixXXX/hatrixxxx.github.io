import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { POST_TYPES } from './config/navigation';
import { isHttpsUrl } from './lib/safe-url';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z
    .object({
      title: z.string().min(1),
      description: z.string().min(1),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      cover: z.string().min(1),
      type: z.enum(POST_TYPES),
      series: z.string().optional(),
      seriesOrder: z.number().int().nonnegative().optional(),
      draft: z.boolean().default(false),
      math: z.boolean().default(false),
      mermaid: z.boolean().default(false),
      legacySlug: z.string().min(1)
    })
    .superRefine((value, ctx) => {
      if ((value.series === undefined) !== (value.seriesOrder === undefined)) {
        ctx.addIssue({ code: 'custom', message: 'series and seriesOrder must be set together' });
      }
    })
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['idea', 'active', 'done', 'archived']),
    cover: z.string().optional(),
    tech: z.array(z.string()).default([]),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().refine(isHttpsUrl, { message: 'project links must use https' })
        })
      )
      .default([]),
    featured: z.boolean().default(false),
    order: z.number().int().default(0)
  })
});

export const collections = { posts, projects };
