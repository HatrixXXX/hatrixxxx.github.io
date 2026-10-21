export const planPath = (id: string) => `/plans/${encodeURIComponent(id)}/`;

export function sortPlans<T extends { id: string; data: { pubDate: Date } }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) =>
    b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.id.localeCompare(b.id, 'zh-CN')
  );
}
