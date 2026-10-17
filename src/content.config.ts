import { pathToFileURL } from 'node:url';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { isHttpsUrl } from './lib/safe-url';
import { contentRoot } from './lib/content-root';
import { postSchema } from './lib/post-schema';
import { snippetRoot } from './lib/snippet-root';
import { snippetSchema } from './lib/snippet-schema';
import { snippetIdFromFile } from './lib/snippets';
import { planRoot } from './lib/plan-root';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: pathToFileURL(contentRoot('posts')).href }),
  schema: postSchema
});

const snippets = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: pathToFileURL(snippetRoot('snippets')).href,
    generateId: ({ entry }) => snippetIdFromFile(entry)
  }),
  schema: snippetSchema
});

const plans = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: pathToFileURL(planRoot('plans')).href,
    generateId: ({ entry }) => entry.replace(/\.md$/i, '')
  }),
  schema: z.object({})
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['idea', 'active', 'done', 'archived']).optional(),
    category: z.string().default('作品'),
    theme: z.enum(['render', 'notes', 'robot', 'dream', 'wall']).default('render'),
    experience: z.string().optional(),
    moment: z.string().optional(),
    gallery: z.array(z.object({
      src: z.string().startsWith('/assets/project-images/'),
      alt: z.string().min(1),
      caption: z.string().optional()
    })).default([]),
    cover: z.string().startsWith('/assets/project-images/').optional(),
    coverAlt: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).default([]),
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
  }).refine((project) => !project.cover || Boolean(project.coverAlt), {
    path: ['coverAlt'],
    message: 'project coverAlt is required when cover is set'
  })
});

export const collections = { posts, snippets, plans, projects };
