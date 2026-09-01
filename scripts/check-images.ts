import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const DEFAULT_CONCURRENCY = 12;
const REQUEST_TIMEOUT_MS = 10_000;
const JSD_DELIVR_HOST = 'cdn.jsdelivr.net';
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#]|![A-Za-z0-9._-]+(?:$|[?#]))/i;

export interface ImageCheckResult {
  ok: Set<string>;
  failed: Map<string, string>;
}

export interface ImageSources {
  urls: string[];
  coverUrls: Set<string>;
}

interface ImageCheckReport {
  checkedAt: string;
  total: number;
  ok: string[];
  failed: Record<string, string>;
  coverFailures: string[];
}

function isJsDelivrUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === JSD_DELIVR_HOST && IMAGE_EXTENSION.test(url.pathname);
  } catch {
    return false;
  }
}

/** Returns unique jsDelivr image URLs from Markdown image syntax and HTML img tags. */
export function extractImageUrls(markdown: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (url: string) => {
    if (isJsDelivrUrl(url) && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  for (const match of markdown.matchAll(/!\[[^\]]*\]\((https:\/\/cdn\.jsdelivr\.net\/[^\s)]+)(?:\s+[^)]*)?\)/g)) {
    add(match[1]);
  }
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*<(https:\/\/cdn\.jsdelivr\.net\/[^>\r\n]+)>\s*(?:[^)]*)\)/g)) {
    add(match[1]);
  }
  for (const match of markdown.matchAll(/<img\b[^>]*?\bsrc=["'](https:\/\/cdn\.jsdelivr\.net\/[^"']+)["'][^>]*>/gi)) {
    add(match[1]);
  }

  return urls;
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(path);
      return /\.mdx?$/i.test(entry.name) ? [path] : [];
    })
  );
  return files.flat();
}

export async function collectImageSources(postsDirectory: string): Promise<ImageSources> {
  const urls: string[] = [];
  const seen = new Set<string>();
  const coverUrls = new Set<string>();
  const add = (url: string, isCover = false) => {
    if (!isJsDelivrUrl(url)) return;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
    if (isCover) coverUrls.add(url);
  };

  for (const file of await markdownFiles(postsDirectory)) {
    const parsed = matter(await readFile(file, 'utf8'));
    if (typeof parsed.data.cover === 'string') add(parsed.data.cover, true);
    for (const url of extractImageUrls(parsed.content)) add(url);
  }

  return { urls, coverUrls };
}

function fallbackToRangeGet(status: number): boolean {
  return status === 403 || status === 405 || status === 501;
}

async function checkUrl(url: string): Promise<string | undefined> {
  const fetchWithTimeout = async (init: RequestInit) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
  };

  try {
    const head = await fetchWithTimeout({ method: 'HEAD' });
    if (head.ok) return undefined;
    if (!fallbackToRangeGet(head.status)) return `HEAD ${head.status} ${head.statusText}`.trim();

    const rangedGet = await fetchWithTimeout({ method: 'GET', headers: { Range: 'bytes=0-0' } });
    return rangedGet.ok ? undefined : `GET ${rangedGet.status} ${rangedGet.statusText}`.trim();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Checks each unique URL using at most 12 concurrent, ten-second requests. */
export async function checkImages(urls: string[], concurrency = DEFAULT_CONCURRENCY): Promise<ImageCheckResult> {
  const uniqueUrls = [...new Set(urls)];
  const workerCount = Math.min(DEFAULT_CONCURRENCY, Math.max(1, Math.floor(concurrency)));
  const ok = new Set<string>();
  const failed = new Map<string, string>();
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < uniqueUrls.length) {
      const url = uniqueUrls[nextIndex++];
      const failure = await checkUrl(url);
      if (failure) failed.set(url, failure);
      else ok.add(url);
    }
  }

  await Promise.all(Array.from({ length: Math.min(workerCount, uniqueUrls.length) }, worker));
  return { ok, failed };
}

async function writeReport(reportPath: string, total: number, result: ImageCheckResult, coverUrls: Set<string>): Promise<string[]> {
  const coverFailures = coverFailuresFor(result, coverUrls);
  const report: ImageCheckReport = {
    checkedAt: new Date().toISOString(),
    total,
    ok: [...result.ok],
    failed: Object.fromEntries(result.failed),
    coverFailures
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return coverFailures;
}

/** Returns failed URLs that are article covers and therefore block the production build. */
export function coverFailuresFor(result: ImageCheckResult, coverUrls: ReadonlySet<string>): string[] {
  return [...result.failed.keys()].filter((url) => coverUrls.has(url));
}

async function main(): Promise<void> {
  const root = process.cwd();
  const { urls, coverUrls } = await collectImageSources(resolve(root, 'src/content/posts'));
  const result = await checkImages(urls, DEFAULT_CONCURRENCY);
  const coverFailures = await writeReport(resolve(root, 'reports/image-check.json'), urls.length, result, coverUrls);

  console.log(`Checked ${urls.length} unique jsDelivr image URLs: ${result.ok.size} ok, ${result.failed.size} failed.`);
  if (coverFailures.length > 0) {
    console.error(`${coverFailures.length} article cover image(s) failed; see reports/image-check.json.`);
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  void main();
}
