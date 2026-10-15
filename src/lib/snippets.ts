import { slug } from 'github-slugger';

export function snippetIdFromFile(filename: string): string {
  return slug(filename.replace(/\.md$/i, ''));
}

export function sortSnippets<T extends { data: { date: Date } }>(snippets: readonly T[]): T[] {
  return [...snippets].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getAdjacentSnippets<T extends { id: string }>(snippets: readonly T[], currentId: string): {
  previous?: T;
  next?: T;
} {
  const index = snippets.findIndex((snippet) => snippet.id === currentId);
  if (index < 0) return {};
  return { previous: snippets[index - 1], next: snippets[index + 1] };
}

export const snippetPath = (id: string) => `/snippets/${id}/`;
