import { z } from 'zod';

export const postSchema = z.object({
  title: z.string().min(1),
  summary: z.string().trim().min(1).max(100),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  cover: z.string().min(1).optional(),
  legacySlug: z.string().min(1)
});
