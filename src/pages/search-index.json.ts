import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sortPosts } from '@/lib/content';
import { toSearchDocument, type SearchDocument } from '@/lib/search';
import { publicSiteSearchDocuments } from '@/lib/site-search';

export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection('posts'));
  const documents: SearchDocument[] = [
    ...posts.map(toSearchDocument),
    ...publicSiteSearchDocuments(await getCollection('projects'))
  ];

  return new Response(JSON.stringify(documents), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
};
