import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { contentRoot } from '../src/lib/content-root';

const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;
const SITE_ORIGIN = 'https://hatrix.site';
const EXPECTED_LOCAL_LINKS = 5352;

export interface BuiltSiteCheckOptions {
  sourceCnamePath?: string;
  expectedLocalLinks?: number;
}

export interface ProjectBuiltSiteCheckOptions {
  expectedLocalLinks?: number;
  sourceContentRoot?: string;
}

export interface BuiltSiteCheckResult {
  errors: string[];
  outputBytes: number;
  checkedLinks: number;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      return entry.isDirectory() ? filesIn(entryPath) : [entryPath];
    })
  );
  return files.flat();
}

async function filesInOrEmpty(directory: string, errors: string[], error: string): Promise<string[]> {
  try {
    return await filesIn(directory);
  } catch {
    errors.push(error);
    return [];
  }
}

function decodePathname(pathname: string): string | undefined {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
}

function routeForHtmlFile(root: string, file: string): string {
  const relativePath = relative(root, file).replaceAll('\\', '/');
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) return `/${relativePath.slice(0, -'index.html'.length)}`;
  return `/${relativePath}`;
}

function localTargetPath(link: string, sourceRoute: string): string | undefined {
  const value = link.trim();
  if (!value || value.startsWith('#') || /^(?:data|mailto|tel|javascript):/i.test(value) || value.startsWith('//')) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(value, `${SITE_ORIGIN}${sourceRoute}`);
  } catch {
    return undefined;
  }
  if (url.origin !== SITE_ORIGIN) return undefined;

  const decodedPath = decodePathname(url.pathname);
  if (!decodedPath || !decodedPath.startsWith('/')) return undefined;
  return posix.normalize(decodedPath);
}

async function resolvesToOutput(root: string, targetPath: string): Promise<boolean> {
  const withoutLeadingSlash = targetPath.replace(/^\/+/, '');
  const candidates = targetPath.endsWith('/')
    ? [join(root, withoutLeadingSlash, 'index.html')]
    : [join(root, withoutLeadingSlash), join(root, `${withoutLeadingSlash}.html`), join(root, withoutLeadingSlash, 'index.html')];
  return (await Promise.all(candidates.map(pathExists))).some(Boolean);
}

function localLinks(html: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) links.push(match[2]);
  return links;
}

async function requiredFile(root: string, path: string, errors: string[]): Promise<void> {
  if (!(await pathExists(join(root, path)))) errors.push(`Missing required output: /${path.replaceAll('\\', '/')}`);
}

export async function inspectBuiltSite(
  root: string,
  expectedPostRoutes: string[],
  options: BuiltSiteCheckOptions = {}
): Promise<BuiltSiteCheckResult> {
  const errors: string[] = [];
  let outputBytes = 0;
  let checkedLinks = 0;
  const files = await filesInOrEmpty(root, errors, `Unable to read built site directory: ${root}`);

  for (const file of files) outputBytes += (await stat(file)).size;
  if (outputBytes >= MAX_OUTPUT_BYTES) errors.push(`Built site is ${outputBytes} bytes; limit is ${MAX_OUTPUT_BYTES} bytes.`);

  await Promise.all([
    requiredFile(root, 'index.html', errors),
    requiredFile(root, '404.html', errors),
    requiredFile(root, 'CNAME', errors),
    requiredFile(root, 'rss.xml', errors),
    requiredFile(root, 'search-index.json', errors),
    requiredFile(root, 'third-party-notices.txt', errors)
  ]);
  if (!files.some((file) => /^sitemap(?:-.*)?\.xml$/i.test(relative(root, file)))) {
    errors.push('Missing sitemap output.');
  }

  if (options.sourceCnamePath) {
    try {
      const [sourceCname, outputCname] = await Promise.all([
        readFile(options.sourceCnamePath, 'utf8'),
        readFile(join(root, 'CNAME'), 'utf8')
      ]);
      if (sourceCname !== outputCname) errors.push('dist/CNAME does not match public/CNAME.');
    } catch {
      errors.push('Unable to verify public/CNAME was copied to dist/CNAME.');
    }
  }

  for (const route of expectedPostRoutes) {
    const normalizedRoute = localTargetPath(route, '/') ?? route;
    if (!(await resolvesToOutput(root, normalizedRoute))) errors.push(`Missing expected post route: ${route}`);
  }

  for (const htmlFile of files.filter((file) => file.endsWith('.html'))) {
    const sourceRoute = routeForHtmlFile(root, htmlFile);
    for (const link of localLinks(await readFile(htmlFile, 'utf8'))) {
      const targetPath = localTargetPath(link, sourceRoute);
      if (!targetPath) continue;
      checkedLinks += 1;
      if (!(await resolvesToOutput(root, targetPath))) {
        errors.push(`Broken local link in ${sourceRoute}: ${link}`);
      }
    }
  }

  if (options.expectedLocalLinks !== undefined && checkedLinks !== options.expectedLocalLinks) {
    errors.push(`Expected ${options.expectedLocalLinks} local links, found ${checkedLinks}.`);
  }

  return { errors, outputBytes, checkedLinks };
}

function markdownImageUrls(markdown: string): string[] {
  const urls = new Set<string>();
  for (const match of markdown.matchAll(/!\[[^\]]*\]\((https:\/\/cdn\.jsdelivr\.net\/[^\s)]+)(?:\s+[^)]*)?\)/g)) {
    urls.add(match[1]);
  }
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*<(https:\/\/cdn\.jsdelivr\.net\/[^>\r\n]+)>\s*(?:[^)]*)\)/g)) {
    urls.add(match[1]);
  }
  for (const match of markdown.matchAll(/<img\b[^>]*\ssrc=(['"])(https:\/\/cdn\.jsdelivr\.net\/[^'"]+)\1[^>]*>/gi)) {
    urls.add(match[2]);
  }
  return [...urls];
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasNativeImageTag(html: string, url: string): boolean {
  const escapedUrl = escapeRegex(escapeAttribute(url));
  const imageTags = html.match(new RegExp(`<img\\b[^>]*\\bsrc=(["'])${escapedUrl}\\1[^>]*>`, 'gi')) ?? [];
  return imageTags.some(
    (tag) => /\sloading=(["'])lazy\1/i.test(tag) && /\sdecoding=(["'])async\1/i.test(tag)
  );
}

async function nativeMarkdownImageErrors(root: string, postsDirectory: string): Promise<string[]> {
  const errors: string[] = [];
  for (const file of await filesInOrEmpty(postsDirectory, errors, `Unable to read source posts directory: ${postsDirectory}`)) {
    if (!/\.mdx?$/i.test(file)) continue;
    const { content, data } = matter(await readFile(file, 'utf8'));
    if (typeof data.legacySlug !== 'string') continue;
    let postOutput: string;
    try {
      postOutput = await readFile(join(root, 'posts', data.legacySlug, 'index.html'), 'utf8');
    } catch {
      errors.push(`Missing Markdown image output for post route: /posts/${data.legacySlug}/`);
      continue;
    }
    for (const url of markdownImageUrls(content)) {
      if (!hasNativeImageTag(postOutput, url)) {
        errors.push(`Markdown image was optimized instead of emitted as a native image: ${url}`);
      }
    }
  }
  return errors;
}

export async function inspectProjectBuiltSite(
  projectRoot: string,
  options: ProjectBuiltSiteCheckOptions = {}
): Promise<BuiltSiteCheckResult> {
  const errors: string[] = [];
  const sourceContentRoot = resolve(projectRoot, options.sourceContentRoot ?? '.private-content');
  const postsDirectory = resolve(sourceContentRoot, 'posts');
  const postFiles = await filesInOrEmpty(postsDirectory, errors, `Unable to read source posts directory: ${postsDirectory}`);
  const routes: string[] = [];
  for (const file of postFiles) {
    if (!/\.mdx?$/i.test(file)) continue;
    const { data } = matter(await readFile(file, 'utf8'));
    if (typeof data.legacySlug === 'string') routes.push(`/posts/${data.legacySlug}/`);
  }
  if (routes.length !== 40 || new Set(routes).size !== 40) {
    errors.push(`Expected 40 unique legacy post routes, found ${new Set(routes).size}.`);
  }

  const distPath = resolve(projectRoot, 'dist');
  const postOutputFiles = await filesInOrEmpty(
    join(distPath, 'posts'),
    errors,
    'Missing generated posts directory: /posts/'
  );
  const generatedPostCount = postOutputFiles
    .filter((file) => /^[^/]+\/index\.html$/.test(relative(join(distPath, 'posts'), file).replaceAll('\\', '/')))
    .length;
  if (generatedPostCount !== 40) errors.push(`Expected 40 generated post routes, found ${generatedPostCount}.`);

  const result = await inspectBuiltSite(distPath, routes, {
    sourceCnamePath: resolve(projectRoot, 'public/CNAME'),
    expectedLocalLinks: options.expectedLocalLinks
  });
  errors.push(...result.errors, ...(await nativeMarkdownImageErrors(distPath, postsDirectory)));
  return { ...result, errors };
}

async function main(): Promise<void> {
  const result = await inspectProjectBuiltSite(process.cwd(), {
    expectedLocalLinks: EXPECTED_LOCAL_LINKS,
    sourceContentRoot: contentRoot()
  });

  console.log(`Checked ${result.checkedLinks} local links, ${result.outputBytes} output bytes.`);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  void main();
}
