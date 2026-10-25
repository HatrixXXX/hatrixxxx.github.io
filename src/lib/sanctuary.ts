export const sanctuaryPath = (id: string) => `/sanctuary/${encodeURIComponent(id)}/`;

export function sortSanctuary<T extends { id: string; data: { pubDate: Date } }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) =>
    b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.id.localeCompare(b.id, 'zh-CN')
  );
}
