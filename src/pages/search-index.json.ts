import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sortPosts, type PostEntry } from '@/lib/content';
import { toSearchDocument, type SearchDocument } from '@/lib/search';

export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection('posts'));
  const documents: SearchDocument[] = posts.filter(({ data }: PostEntry) => !data.locked).map(toSearchDocument);

  return new Response(JSON.stringify(documents), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
};
