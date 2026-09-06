import readingTime from 'reading-time';
import type { PostEntry } from '@/lib/content';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;
const START_DAY_UTC = Date.UTC(2025, 1, 17);
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});

export interface BuiltSiteStats {
  postCount: number;
  wordCount: number;
  lastUpdated: Date;
}

export interface RunningDuration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function buildSiteStats(posts: readonly PostEntry[]): BuiltSiteStats {
  if (posts.length === 0) throw new RangeError('published posts must not be empty');
  const dates = posts.map((post) => post.data.updatedDate ?? post.data.pubDate);
  return {
    postCount: posts.length,
    wordCount: posts.reduce((sum, post) => sum + readingTime(post.body ?? '').words, 0),
    lastUpdated: new Date(Math.max(...dates.map((date) => date.getTime())))
  };
}

export function runningDaysAt(now: Date): number {
  const parts = dateFormatter.formatToParts(now);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const currentDay = Date.UTC(number('year'), number('month') - 1, number('day'));
  return Math.max(0, Math.floor((currentDay - START_DAY_UTC) / DAY_MS) + 1);
}

export function runningDurationAt(now: Date): RunningDuration {
  const elapsedMs = Math.max(0, now.getTime() - START_DAY_UTC);
  const days = Math.floor(elapsedMs / DAY_MS);
  const hours = Math.floor((elapsedMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((elapsedMs % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((elapsedMs % MINUTE_MS) / SECOND_MS);
  return { days, hours, minutes, seconds };
}

export function formatRunningDurationAt(now: Date): string {
  const { days, hours, minutes, seconds } = runningDurationAt(now);
  return `已运行${days}天${hours}小时${minutes}分钟${seconds}秒`;
}

export function formatSiteDate(date: Date): string {
  return dateFormatter.format(date);
}
