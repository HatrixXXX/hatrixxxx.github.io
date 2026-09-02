import type { CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

export interface Page<T> {
  items: T[];
  current: number;
  total: number;
}

export interface ArchiveMonth {
  year: number;
  month: number;
  posts: PostEntry[];
}

export interface AdjacentPosts {
  previous?: PostEntry;
  next?: PostEntry;
}

export function sortPosts(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export function paginatePosts(posts: PostEntry[], current: number, size = 6): Page<PostEntry> {
  const total = Math.max(1, Math.ceil(posts.length / size));
  if (!Number.isInteger(current) || current < 1 || current > total) {
    throw new RangeError('invalid page');
  }
  return { items: posts.slice((current - 1) * size, current * size), current, total };
}

export function buildArchives(posts: PostEntry[]): ArchiveMonth[] {
  const groups = new Map<string, ArchiveMonth>();
  for (const post of sortPosts(posts)) {
    const year = post.data.pubDate.getFullYear();
    const month = post.data.pubDate.getMonth() + 1;
    const key = `${year}-${month}`;
    const group: ArchiveMonth = groups.get(key) ?? { year, month, posts: [] };
    group.posts.push(post);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function getAdjacentPosts(posts: PostEntry[], currentId: string): AdjacentPosts {
  const index = posts.findIndex((post) => post.id === currentId);
  if (index < 0) return {};
  return { previous: posts[index - 1], next: posts[index + 1] };
}
