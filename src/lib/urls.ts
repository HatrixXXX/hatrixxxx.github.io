export const postPath = (legacySlug: string) => `/posts/${legacySlug}/`;
export const categoryPath = (category: string) => `/categories/${encodeURIComponent(category)}/`;
export const tagPath = (tag: string) => `/tags/${encodeURIComponent(tag)}/`;
