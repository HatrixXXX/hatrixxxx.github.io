import { z } from 'astro/zod';

const siteCover = z.string().min(1).refine((path) =>
  /^\/(?!\/)[^\s?#\\"'()<>%]+$/.test(path) &&
  !path.split('/').some((segment) => segment === '.' || segment === '..'),
  { message: 'snippet cover must be a site-local path' }
);

export const snippetSchema = z.strictObject({
  title: z.string().min(1),
  date: z.coerce.date().refine(
    (date) => date.getUTCHours() === 0 && date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0,
    { message: 'snippet date must be a calendar date without time or timezone' }
  ),
  description: z.string().min(1).optional(),
  cover: siteCover.optional()
});
