import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLACEHOLDER_URL = '/images/image-unavailable.svg';
const UNSUPPORTED_EXTENSION = /\.(?:gif|svg)(?:$|[?#])/i;
const REMOTE_IMAGE_URL = /^https?:\/\//i;
let cachedFailedUrls: Set<string> | undefined;
let warnedAboutMissingReport = false;

type ImageNode = {
  type: string;
  url?: string;
  value?: string;
  alt?: string | null;
  data?: { hProperties?: Record<string, unknown> };
  children?: ImageNode[];
};

function replaceFailedHtmlImages(value: string, failedUrls: ReadonlySet<string>): string {
  return value.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\ssrc=(["'])([^"']+)\1/i);
    if (!source || !REMOTE_IMAGE_URL.test(source[2])) return tag;
    if (!failedUrls.has(source[2]) || UNSUPPORTED_EXTENSION.test(source[2])) return nativeImageTag(tag);

    const originalUrl = source[2];
    const placeholderSource = `src=${source[1]}${PLACEHOLDER_URL}${source[1]}`;
    return appendImageAttributes(
      tag.replace(source[0], ` ${placeholderSource}`).replace(/\sdata-original-src=(["'])[^"']*\1/i, ''),
      [`data-original-src=${source[1]}${escapeAttribute(originalUrl)}${source[1]}`]
    );
  });
}

function nativeImageTag(tag: string): string {
  const additions = [
    /\sloading(?:\s|=|>|\/)/i.test(tag) ? '' : 'loading="lazy"',
    /\sdecoding(?:\s|=|>|\/)/i.test(tag) ? '' : 'decoding="async"'
  ].filter(Boolean);
  return appendImageAttributes(tag, additions);
}

function appendImageAttributes(tag: string, attributes: string[]): string {
  if (attributes.length === 0) return tag;
  return tag.replace(/(\s*\/?>)$/, ` ${attributes.join(' ')}$1`);
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function failedUrlsFromReport(): Set<string> {
  if (cachedFailedUrls) return cachedFailedUrls;

  const reportPath = resolve(process.cwd(), 'reports/image-check.json');
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { failed?: Record<string, string> };
    cachedFailedUrls = new Set(Object.keys(report.failed ?? {}));
  } catch (error) {
    cachedFailedUrls = new Set();
    if (!warnedAboutMissingReport) {
      const message = error instanceof Error && 'code' in error && error.code === 'ENOENT'
        ? 'reports/image-check.json is missing'
        : 'reports/image-check.json could not be read';
      console.warn(`[remark-image-status] ${message}; leaving inline remote images unchanged. Run pnpm check:images first.`);
      warnedAboutMissingReport = true;
    }
  }
  return cachedFailedUrls;
}

function visit(node: ImageNode, failedUrls: ReadonlySet<string>): void {
  if (node.type === 'image' && node.url && REMOTE_IMAGE_URL.test(node.url)) {
    const originalUrl = node.url;
    const isReplaceableFailure = failedUrls.has(originalUrl) && !UNSUPPORTED_EXTENSION.test(originalUrl);
    if (isReplaceableFailure) {
      node.url = PLACEHOLDER_URL;
      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, 'data-original-src': originalUrl }
      };
    }
  }
  if (node.type === 'html' && node.value) node.value = replaceFailedHtmlImages(node.value, failedUrls);
  for (const child of node.children ?? []) visit(child, failedUrls);
}

/** Replaces checked-failed inline raster images and leaves missing reports non-fatal. */
export default function remarkImageStatus(failedUrls: ReadonlySet<string> = failedUrlsFromReport()) {
  return (tree: ImageNode) => visit(tree, failedUrls);
}
