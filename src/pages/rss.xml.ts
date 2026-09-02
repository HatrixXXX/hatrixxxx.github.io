import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE } from '@/config/site';
import { sortPosts, type PostEntry } from '@/lib/content';
import { postPath } from '@/lib/urls';

export const GET: APIRoute = async (context) => {
  const posts = sortPosts(await getCollection('posts', ({ data }: PostEntry) => !data.draft));

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postPath(post.data.legacySlug)
    }))
  });
};
