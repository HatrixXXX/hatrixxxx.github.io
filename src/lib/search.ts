import type { PostEntry } from './content';
import { postPath } from './urls';

export interface SearchDocument {
  id: string;
  url: string;
  title: string;
  locked: boolean;
  text: string;
  paragraphs: string[];
}

const HAN_SEGMENT = /^\p{Script=Han}+$/u;

export function normalizeSearchText(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase();
}

export function searchTerms(query: string): string[] {
  return normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
}

export function tokenizeSearchText(text: string): string[] {
  const segments = normalizeSearchText(text).match(/\p{Script=Han}+|[\p{L}\p{N}_]+/gu) ?? [];
  const tokens: string[] = [];

  for (const segment of segments) {
    if (!HAN_SEGMENT.test(segment)) {
      tokens.push(segment);
      continue;
    }
    tokens.push(...segment.split(''));
    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.push(segment.slice(index, index + 2));
    }
  }

  return tokens;
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

export function markdownToParagraphs(markdown: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === '') {
      if (current.length > 0) blocks.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join('\n'));

  return blocks
    .map((paragraph) => markdownToPlainText(paragraph))
    .filter(Boolean);
}

export function excerptForMatch(paragraphs: string[], query: string, maxLength = 180): string {
  const terms = searchTerms(query);
  const normalizedQuery = terms[0] ?? '';
  const paragraph = paragraphs.find((item) => terms.every((term) => normalizeSearchText(item).includes(term)))
    ?? paragraphs.find((item) => terms.some((term) => normalizeSearchText(item).includes(term)))
    ?? paragraphs[0]
    ?? '';
  if (paragraph.length <= maxLength || !normalizedQuery) return paragraph;

  const matchIndex = normalizeSearchText(paragraph).indexOf(normalizedQuery);
  if (normalizedQuery.length >= maxLength - 2) return paragraph.slice(0, maxLength);
  const contextLength = Math.max(0, maxLength - normalizedQuery.length - 2);
  const snippetLength = Math.min(paragraph.length, contextLength + normalizedQuery.length);
  let start = Math.max(0, Math.min(matchIndex - Math.floor(contextLength / 2), paragraph.length - snippetLength));
  let end = Math.min(paragraph.length, start + snippetLength);
  const prefix = start > 0 ? 1 : 0;
  const suffix = end < paragraph.length ? 1 : 0;
  const availableLength = Math.max(normalizedQuery.length, maxLength - prefix - suffix);
  if (end - start > availableLength) {
    start = Math.max(0, Math.min(matchIndex - Math.floor((availableLength - normalizedQuery.length) / 2), paragraph.length - availableLength));
    end = Math.min(paragraph.length, start + availableLength);
  }
  return `${start > 0 ? '…' : ''}${paragraph.slice(start, end)}${end < paragraph.length ? '…' : ''}`;
}

export function toSearchDocument(post: PostEntry): SearchDocument {
  const metadata = markdownToPlainText(post.data.title);
  const paragraphs = post.data.locked
    ? []
    : markdownToParagraphs((post as PostEntry & { body?: string }).body ?? '');

  return {
    id: post.id,
    url: postPath(post.data.legacySlug),
    title: post.data.title,
    locked: post.data.locked,
    text: [metadata, ...paragraphs].filter(Boolean).join(' '),
    paragraphs
  };
}
