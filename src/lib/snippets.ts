import { slug } from 'github-slugger';

export function snippetIdFromFile(filename: string): string {
  return slug(filename.replace(/\.md$/i, ''));
}

export function sortSnippets<T extends { data: { date: Date } }>(snippets: readonly T[]): T[] {
  return [...snippets].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const snippetPath = (id: string) => `/snippets/${id}/`;
