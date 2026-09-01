import type { PostEntry } from './content';
import { postPath } from './urls';

export interface SearchDocument {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  text: string;
}

export function toSearchDocument(post: PostEntry): SearchDocument {
  const body = (post as PostEntry & { body?: string }).body ?? '';
  return {
    id: post.id,
    url: postPath(post.data.legacySlug),
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    text: `${post.data.title} ${post.data.description} ${post.data.category} ${post.data.tags.join(' ')} ${body.slice(0, 2000)}`
  };
}
