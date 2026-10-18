export const PLAN_VISUALS = [
  { title: '作息规律', image: 'routine' },
  { title: '人脉维护', image: 'contacts' },
  { title: '公司信息', image: 'company' },
  { title: '生活常识', image: 'knowledge' },
  { title: '待办清单', image: 'todo' }
] as const;

export const planPath = (id: string) => `/plans/${encodeURIComponent(id)}/`;

export function planVisual(title: string) {
  return PLAN_VISUALS.find((visual) => visual.title === title);
}

export function sortPlans<T extends { id: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const aIndex = PLAN_VISUALS.findIndex((visual) => visual.title === a.id);
    const bIndex = PLAN_VISUALS.findIndex((visual) => visual.title === b.id);
    return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex) || a.id.localeCompare(b.id, 'zh-CN');
  });
}
