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

export function markdownToPlainText(markdown: string, maxLength = Number.POSITIVE_INFINITY): string {
  return markdown
    .replace(/```[^\r\n]*[\r\n]?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\s*\/?>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|[^\w])_([^_]+)_(?!\w)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

export function toSearchDocument(post: PostEntry): SearchDocument {
  const body = (post as PostEntry & { body?: string }).body ?? '';
  const metadata = markdownToPlainText(
    `${post.data.title} ${post.data.description} ${post.data.category} ${post.data.tags.join(' ')}`
  );
  const summary = markdownToPlainText(body, 2000);

  return {
    id: post.id,
    url: postPath(post.data.legacySlug),
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    text: [metadata, summary].filter(Boolean).join(' ')
  };
}
