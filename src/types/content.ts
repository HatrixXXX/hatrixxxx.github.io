import type { POST_CATEGORIES } from '../config/site';

export type PostCategory = (typeof POST_CATEGORIES)[number];

export interface PostData {
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  cover: string;
  category: PostCategory;
  tags: string[];
  series?: string;
  seriesOrder?: number;
  draft: boolean;
  math: boolean;
  mermaid: boolean;
  legacySlug: string;
}

export interface ProjectData {
  title: string;
  description: string;
  status: 'idea' | 'active' | 'done' | 'archived';
  cover?: string;
  tech: string[];
  links: Array<{ label: string; url: string }>;
  featured: boolean;
  order: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
  cover?: string;
}
