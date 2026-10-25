import { z } from 'zod';
import { isApprovedRemoteImageUrl } from './safe-url';

const sanctuaryCover = z.string().refine((value) => {
  if (value.startsWith('/assets/')) return true;
  try {
    return isApprovedRemoteImageUrl(new URL(value));
  } catch {
    return false;
  }
}, { message: 'sanctuary cover must use /assets/ or an approved immutable image repository URL' });

export const sanctuarySchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(100),
  pubDate: z.coerce.date(),
  cover: sanctuaryCover.optional()
});
