import { pathToFileURL } from 'node:url';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { contentRoot } from './lib/content-root';
import { postSchema } from './lib/post-schema';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: pathToFileURL(contentRoot('posts')).href }),
  schema: postSchema
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['idea', 'active', 'done', 'archived']),
    cover: z.string().optional(),
    tech: z.array(z.string()).default([]),
    links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
    featured: z.boolean().default(false),
    order: z.number().int().default(0)
  })
});

export const collections = { posts, projects };
