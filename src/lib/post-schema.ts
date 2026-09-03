import { z } from 'zod';
import { POST_TYPES } from '../config/navigation';

export const postSchema = z
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
    locked: z.boolean().default(false),
    math: z.boolean().default(false),
    mermaid: z.boolean().default(false),
    legacySlug: z.string().min(1)
  })
  .superRefine((value, ctx) => {
    if ((value.series === undefined) !== (value.seriesOrder === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'series and seriesOrder must be set together' });
    }
  });
