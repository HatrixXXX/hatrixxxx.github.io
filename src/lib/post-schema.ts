import { z } from 'zod';

export const postSchema = z.object({
  title: z.string().min(1),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  cover: z.string().min(1).optional(),
  locked: z.boolean().default(false),
  legacySlug: z.string().min(1)
});
