import { z } from 'astro/zod';
import { isApprovedRemoteImageUrl } from './safe-url';

const snippetCover = z.string().min(1).refine((value) => {
  if (/^\/(?!\/)[^\s?#\\"'()<>%]+$/.test(value) &&
    !value.split('/').some((segment) => segment === '.' || segment === '..')) return true;
  try {
    return isApprovedRemoteImageUrl(new URL(value));
  } catch {
    return false;
  }
}, { message: 'snippet cover must use a site-local path or an approved immutable image repository URL' });

export const snippetSchema = z.strictObject({
  title: z.string().min(1),
  date: z.coerce.date().refine(
    (date) => date.getUTCHours() === 0 && date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0,
    { message: 'snippet date must be a calendar date without time or timezone' }
  ),
  description: z.string().min(1).optional(),
  cover: snippetCover.optional()
});
