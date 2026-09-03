import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '../src/config/security';

const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;
const SITE_ORIGIN = 'https://hatrix.site';
const EXPECTED_LOCAL_LINKS = 3961;
const IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/';

export interface BuiltSiteCheckOptions {
  sourceCnamePath?: string;
  expectedLocalLinks?: number;
}

export interface ProjectBuiltSiteCheckOptions {
  expectedLocalLinks?: number;
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

function htmlElements(html: string): DefaultTreeAdapterTypes.Element[] {
  const elements: DefaultTreeAdapterTypes.Element[] = [];
  const document = parse(html, { sourceCodeLocationInfo: true });

  function visit(node: DefaultTreeAdapterTypes.Node): void {
    if ('tagName' in node) elements.push(node);
    if ('content' in node) visit(node.content);
    if ('childNodes' in node) {
      for (const child of node.childNodes) visit(child);
    }
  }

  visit(document);
  return elements;
}

function attributeValue(element: DefaultTreeAdapterTypes.Element, name: string): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value;
}

function externalUrl(value: string, route: string): URL | undefined {
  try {
    const url = new URL(value, `${SITE_ORIGIN}${route}`);
    return url.origin === SITE_ORIGIN ? undefined : url;
  } catch {
    return undefined;
  }
}

function isDangerousDataUrl(value: string): boolean {
  return /^data:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)(?:[;,]|$)/i.test(value.trim());
}

export function securityErrorsForHtml(html: string, route: string): string[] {
  const errors: string[] = [];
  const elements = htmlElements(html);
  const metaElements = elements.filter((element) => element.tagName === 'meta');
  const cspTags = metaElements.filter(
    (element) => attributeValue(element, 'http-equiv')?.toLowerCase() === 'content-security-policy'
  );
  const referrerTags = metaElements.filter(
    (element) => attributeValue(element, 'name')?.toLowerCase() === 'referrer'
  );

  const cspTag = cspTags[0];
  const referrerTag = referrerTags[0];
  if (cspTags.length !== 1 || !cspTag || attributeValue(cspTag, 'content') !== CONTENT_SECURITY_POLICY) {
    errors.push(`Invalid Content Security Policy in ${route}.`);
  }
  if (referrerTags.length !== 1 || !referrerTag || attributeValue(referrerTag, 'content') !== REFERRER_POLICY) {
    errors.push(`Invalid Referrer Policy in ${route}.`);
  }

  const cspOffset = cspTags.length === 1 ? cspTag?.sourceCodeLocation?.startTag?.startOffset : undefined;
  if (
    elements.some(
      (element) =>
        element.tagName === 'script' &&
        (cspOffset === undefined || (element.sourceCodeLocation?.startTag?.startOffset ?? Infinity) < cspOffset)
    )
  ) {
    errors.push(`CSP must appear before every script in ${route}.`);
  }

  for (const element of elements) {
    for (const attribute of element.attrs) {
      if (/^on[a-z0-9_-]+$/i.test(attribute.name)) {
        errors.push(`Found inline event attribute in ${route}.`);
      }
      if (
        /^(?:href|src|action|formaction)$/i.test(attribute.name) &&
        /^\s*(?:javascript|vbscript):/i.test(attribute.value)
      ) {
        errors.push(`Found unsafe URL scheme in ${route}.`);
      }
      if (/^(?:href|src|action|formaction)$/i.test(attribute.name) && isDangerousDataUrl(attribute.value)) {
        errors.push(`Found dangerous data document in ${route}.`);
      }
    }
  }

  for (const anchor of elements.filter((element) => element.tagName === 'a')) {
    if (attributeValue(anchor, 'target')?.toLowerCase() !== '_blank') continue;
    const rel = new Set((attributeValue(anchor, 'rel') ?? '').toLowerCase().split(/\s+/));
    if (!rel.has('noopener') && !rel.has('noreferrer')) {
      errors.push(`External-window link is missing noopener protection in ${route}.`);
    }
  }
  for (const script of elements.filter((element) => element.tagName === 'script')) {
    const src = attributeValue(script, 'src');
    const url = src ? externalUrl(src, route) : undefined;
    if (url && url.href !== 'https://giscus.app/client.js') {
      errors.push(`Unapproved external script in ${route}: ${url.origin}`);
    }
  }
  for (const iframe of elements.filter((element) => element.tagName === 'iframe')) {
    const src = attributeValue(iframe, 'src');
    const url = src ? externalUrl(src, route) : undefined;
    if (url && url.origin !== 'https://giscus.app') {
      errors.push(`Unapproved external frame in ${route}: ${url.origin}`);
    }
  }
  for (const image of elements.filter((element) => element.tagName === 'img')) {
    const src = attributeValue(image, 'src')?.trim();
    if (src && /^https?:\/\//i.test(src) && !src.startsWith(IMMUTABLE_IMAGE_PREFIX)) {
      errors.push(`Found unapproved remote image in ${route}.`);
    }
  }
  return errors;
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
    const html = await readFile(htmlFile, 'utf8');
    errors.push(...securityErrorsForHtml(html, sourceRoute));
    for (const link of localLinks(html)) {
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
  const postsDirectory = resolve(projectRoot, 'src/content/posts');
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
    expectedLocalLinks: EXPECTED_LOCAL_LINKS
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
