export function getPostExcerpt(body: string, locked: boolean, limit = 88): string | null {
  if (locked) return null;

  const paragraphs = body.split(/\r?\n\s*\r?\n/);
  for (const paragraph of paragraphs) {
    const source = paragraph.trim();
    if (!source || /^(?:#{1,6}\s|!\[|```|~~~|\||<|\$\$|>|[-*+]\s|\d+\.\s)/.test(source)) continue;

    const text = source
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[\*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/([\p{Script=Han}，。！？]) +(?=[\p{Script=Han}，。！？])/gu, '$1')
      .trim();
    if (text.length < 8) continue;
    if (text.length <= limit) return text;

    const candidate = text.slice(0, limit);
    const sentenceEnd = Math.max(...[...candidate.matchAll(/[。！？.!?]/g)].map((match) => (match.index ?? 0) + 1), 0);
    return sentenceEnd >= limit / 2 ? candidate.slice(0, sentenceEnd) : `${candidate.trimEnd()}…`;
  }
  return null;
}
