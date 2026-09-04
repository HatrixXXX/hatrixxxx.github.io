import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error css-tree@3.2.1 does not publish TypeScript declarations.
import { ident, parse as parseCss, walk as walkCss } from 'css-tree';
import matter from 'gray-matter';
import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '../src/config/security';
import { contentRoot } from '../src/lib/content-root';
import {
  dangerousBrowserUrlKind,
  isApprovedRemoteImageUrl,
  resolveBrowserUrl,
  SITE_ORIGIN
} from '../src/lib/safe-url';
import { parseSrcset } from 'srcset';

const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;
export const EXPECTED_LOCAL_LINKS = 4038;
const APPROVED_EXTERNAL_SCRIPTS = new Set([
  'https://events.vercount.one/js',
  'https://giscus.app/client.js'
]);
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const NOSCRIPT_FORBIDDEN_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'meta',
  'link',
  'style',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'source',
  'svg',
  'math'
]);

export interface BuiltSiteCheckOptions {
  sourceCnamePath?: string;
  expectedLocalLinks?: number;
}

export interface ProjectBuiltSiteCheckOptions {
  expectedLocalLinks?: number;
  expectedPostCount?: number;
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
  if (!value || value.startsWith('#')) return undefined;

  const url = resolveBrowserUrl(value, `${SITE_ORIGIN}${sourceRoute}`);
  if (!url) return undefined;
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

interface ParsedElement {
  element: DefaultTreeAdapterTypes.Element;
  inTemplate: boolean;
  inNoscript: boolean;
}

function htmlElements(html: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const document = parse(html, { scriptingEnabled: false, sourceCodeLocationInfo: true });

  function visit(node: DefaultTreeAdapterTypes.Node, inTemplate = false, inNoscript = false): void {
    const childInNoscript = inNoscript || ('tagName' in node && node.tagName === 'noscript');
    if ('tagName' in node) elements.push({ element: node, inTemplate, inNoscript });
    if ('content' in node) visit(node.content, true, childInNoscript);
    if ('childNodes' in node) {
      for (const child of node.childNodes) visit(child, inTemplate, childInNoscript);
    }
  }

  visit(document);
  return elements;
}

function attributeValue(element: DefaultTreeAdapterTypes.Element | undefined, name: string): string | undefined {
  return element?.attrs.find((attribute) => attribute.name.toLowerCase() === name)?.value;
}

function attributeName(attribute: DefaultTreeAdapterTypes.Element['attrs'][number]): string {
  return attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
}

function parsedUrl(value: string, route: string): URL | undefined {
  return resolveBrowserUrl(value, `${SITE_ORIGIN}${route}`);
}

function externalUrl(value: string, route: string): URL | undefined {
  const url = parsedUrl(value, route);
  return url?.origin === SITE_ORIGIN ? undefined : url;
}

function isHtmlElement(
  node: DefaultTreeAdapterTypes.Node | null | undefined,
  tagName: string
): node is DefaultTreeAdapterTypes.Element {
  return Boolean(node && 'tagName' in node && node.tagName === tagName && node.namespaceURI === HTML_NAMESPACE);
}

function isEffectiveMetadata({ element, inTemplate }: ParsedElement): boolean {
  const head = element.parentNode;
  return !inTemplate && element.namespaceURI === HTML_NAMESPACE && isHtmlElement(head, 'head') && isHtmlElement(head.parentNode, 'html') && head.parentNode.parentNode?.nodeName === '#document';
}

function diagnosticValue(value: string): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const bounded = normalized.length > 160 ? `${normalized.slice(0, 160)}…` : normalized;
  return JSON.stringify(bounded);
}

function diagnostic(route: string, message: string, attribute?: string, value?: string): string {
  return `${message} in ${route}${attribute ? `: ${attribute}=${diagnosticValue(value ?? '')}` : ''}.`;
}

function imageSourceErrors(attribute: string, value: string, route: string): string[] {
  const responsive = attribute === 'srcset' || attribute === 'imagesrcset';
  let candidates: string[];
  try {
    candidates = responsive ? parseSrcset(value, { strict: true }).map((candidate) => candidate.url) : [value];
  } catch {
    return [diagnostic(route, 'Unable to parse srcset', attribute, value)];
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    const dangerousKind = dangerousBrowserUrlKind(candidate, `${SITE_ORIGIN}${route}`);
    if (dangerousKind === 'executable-scheme') {
      errors.push(diagnostic(route, 'Found unsafe URL scheme', attribute, candidate));
    }
    if (dangerousKind === 'dangerous-data-document') {
      errors.push(diagnostic(route, 'Found dangerous data document', attribute, candidate));
    }
  }
  errors.push(...resourceErrors('Found unapproved remote image', attribute, value, route, candidates));
  return errors;
}

function resourceErrors(message: string, attribute: string, value: string, route: string, candidates = [value]): string[] {
  const errors: string[] = [];
  for (const candidate of candidates) {
    const url = parsedUrl(candidate, route);
    if (url && url.origin !== 'null' && url.origin !== SITE_ORIGIN && !isApprovedRemoteImageUrl(url)) {
      errors.push(diagnostic(route, message, attribute, url.origin));
    }
  }
  return errors;
}

function cssResourceUrls(value: string, context: 'declarationList' | 'stylesheet'): string[] {
  const urls: string[] = [];
  const functions: string[] = [];
  const atRules: string[] = [];
  const ast = parseCss(value, {
    context,
    parseCustomProperty: true,
    onParseError(error: unknown) {
      throw error;
    }
  });

  walkCss(ast, {
    enter(node: { type: string; name?: string; value?: string }) {
      if (node.type === 'Function') functions.push(ident.decode(node.name ?? '').toLowerCase());
      if (node.type === 'Atrule') atRules.push((node.name ?? '').toLowerCase());
      if (node.type === 'Url' && node.value) urls.push(node.value);
      if (
        node.type === 'String' &&
        node.value &&
        (functions.some((name) => name === 'url' || name === 'image-set' || name === '-webkit-image-set') ||
          atRules.includes('import'))
      ) {
        urls.push(node.value);
      }
    },
    leave(node: { type: string }) {
      if (node.type === 'Function') functions.pop();
      if (node.type === 'Atrule') atRules.pop();
    }
  });
  return urls;
}

function cssResourceErrors(
  attribute: string,
  value: string,
  route: string,
  context: 'declarationList' | 'stylesheet'
): string[] {
  try {
    return resourceErrors('Found unapproved CSS resource', attribute, value, route, cssResourceUrls(value, context));
  } catch {
    return [diagnostic(route, 'Unable to parse CSS resource', attribute, value)];
  }
}

function textContent(element: DefaultTreeAdapterTypes.Element): string {
  return element.childNodes
    .filter((node): node is DefaultTreeAdapterTypes.TextNode => node.nodeName === '#text')
    .map((node) => node.value)
    .join('');
}

export function securityErrorsForHtml(html: string, route: string): string[] {
  const errors: string[] = [];
  const elements = htmlElements(html);
  const metaElements = elements.filter(({ element }) => element.tagName === 'meta');
  const cspTags = metaElements.filter(
    ({ element }) => attributeValue(element, 'http-equiv')?.toLowerCase() === 'content-security-policy'
  );
  const referrerTags = metaElements.filter(
    ({ element }) => attributeValue(element, 'name')?.toLowerCase() === 'referrer'
  );
  const effectiveCspTags = cspTags.filter(isEffectiveMetadata);
  const effectiveReferrerTags = referrerTags.filter(isEffectiveMetadata);

  const cspTag = effectiveCspTags[0];
  const referrerTag = effectiveReferrerTags[0];
  if (cspTags.length !== 1 || effectiveCspTags.length !== 1 || !cspTag || attributeValue(cspTag.element, 'content') !== CONTENT_SECURITY_POLICY) {
    errors.push(diagnostic(route, 'Invalid Content Security Policy', 'content', attributeValue(cspTag?.element ?? cspTags[0]?.element, 'content') ?? ''));
  }
  if (referrerTags.length !== 1 || effectiveReferrerTags.length !== 1 || !referrerTag || attributeValue(referrerTag.element, 'content') !== REFERRER_POLICY) {
    errors.push(diagnostic(route, 'Invalid Referrer Policy', 'content', attributeValue(referrerTag?.element ?? referrerTags[0]?.element, 'content') ?? ''));
  }

  const cspOffset = cspTag?.element.sourceCodeLocation?.startTag?.startOffset;
  if (
    elements.some(
      ({ element, inTemplate }) =>
        !inTemplate &&
        element.tagName === 'script' &&
        (cspOffset === undefined || (element.sourceCodeLocation?.startTag?.startOffset ?? Infinity) < cspOffset)
    )
  ) {
    errors.push(diagnostic(route, 'CSP must appear before every script', 'script', 'active'));
  }

  for (const { element, inNoscript } of elements) {
    if (inNoscript && NOSCRIPT_FORBIDDEN_TAGS.has(element.tagName)) {
      errors.push(diagnostic(route, `Found forbidden <${element.tagName}> in noscript`, 'element', element.tagName));
    }
    if (element.namespaceURI === HTML_NAMESPACE && element.tagName === 'base') {
      errors.push(diagnostic(route, 'Found <base>', 'href', attributeValue(element, 'href')));
    }
    if (element.tagName === 'meta' && attributeValue(element, 'http-equiv')?.trim().toLowerCase() === 'refresh') {
      errors.push(diagnostic(route, 'Found meta refresh', 'http-equiv', attributeValue(element, 'http-equiv')));
    }
    if (element.tagName === 'object' && attributeValue(element, 'data') !== undefined) {
      errors.push(diagnostic(route, 'Found executable <object>', 'data', attributeValue(element, 'data')));
    }
    if (element.tagName === 'embed') {
      errors.push(diagnostic(route, 'Found executable <embed>', 'src', attributeValue(element, 'src')));
    }
    if (element.tagName === 'iframe' && attributeValue(element, 'srcdoc') !== undefined) {
      errors.push(diagnostic(route, 'Found iframe srcdoc', 'srcdoc', attributeValue(element, 'srcdoc')));
    }
    if (element.namespaceURI === SVG_NAMESPACE) {
      const href = element.attrs.find((attribute) => attribute.name === 'href');
      if (element.tagName.toLowerCase() === 'script') {
        errors.push(diagnostic(route, 'Found SVG <script>', href ? attributeName(href) : 'script', href?.value ?? 'inline'));
      }
      if (['image', 'feimage'].includes(element.tagName.toLowerCase()) && href) {
        errors.push(...imageSourceErrors(attributeName(href), href.value, route));
      }
      if (element.tagName.toLowerCase() === 'use' && href && !href.value.trim().startsWith('#')) {
        errors.push(diagnostic(route, 'Found external SVG reference', attributeName(href), href.value));
      }
    }
    for (const attribute of element.attrs) {
      if (/^on[a-z0-9_-]+$/i.test(attribute.name)) {
        errors.push(diagnostic(route, 'Found inline event attribute', attribute.name, attribute.value));
      }
      if (/^(?:href|src|action|formaction|data|poster|background)$/i.test(attribute.name)) {
        const dangerousKind = dangerousBrowserUrlKind(attribute.value, `${SITE_ORIGIN}${route}`);
        if (dangerousKind === 'executable-scheme') {
          errors.push(diagnostic(route, 'Found unsafe URL scheme', attribute.name, attribute.value));
        }
        if (dangerousKind === 'dangerous-data-document') {
          errors.push(diagnostic(route, 'Found dangerous data document', attribute.name, attribute.value));
        }
      }
      if (attribute.name === 'style') {
        errors.push(...cssResourceErrors(attribute.name, attribute.value, route, 'declarationList'));
      }
    }
    if (element.tagName === 'style') {
      errors.push(...cssResourceErrors('text', textContent(element), route, 'stylesheet'));
    }
    if (element.namespaceURI === HTML_NAMESPACE && attributeValue(element, 'background') !== undefined) {
      errors.push(...imageSourceErrors('background', attributeValue(element, 'background') ?? '', route));
    }
    if (element.namespaceURI === HTML_NAMESPACE && element.tagName === 'video' && attributeValue(element, 'poster') !== undefined) {
      errors.push(...imageSourceErrors('poster', attributeValue(element, 'poster') ?? '', route));
    }
    if (
      element.namespaceURI === HTML_NAMESPACE &&
      element.tagName === 'input' &&
      attributeValue(element, 'type')?.trim().toLowerCase() === 'image' &&
      attributeValue(element, 'src') !== undefined
    ) {
      errors.push(...imageSourceErrors('src', attributeValue(element, 'src') ?? '', route));
    }
    if (
      element.namespaceURI === HTML_NAMESPACE &&
      element.tagName === 'link' &&
      attributeValue(element, 'href') !== undefined
    ) {
      const rel = new Set((attributeValue(element, 'rel') ?? '').toLowerCase().split(/\s+/));
      const href = attributeValue(element, 'href') ?? '';
      if (['icon', 'apple-touch-icon', 'mask-icon'].some((name) => rel.has(name))) {
        errors.push(...imageSourceErrors('href', href, route));
      }
      const preloadAs = attributeValue(element, 'as')?.trim().toLowerCase();
      if (rel.has('preload') && preloadAs === 'image') {
        errors.push(...imageSourceErrors('href', href, route));
        const imageSrcset = attributeValue(element, 'imagesrcset');
        if (imageSrcset !== undefined) errors.push(...imageSourceErrors('imagesrcset', imageSrcset, route));
      }
      if (
        rel.has('stylesheet') ||
        rel.has('modulepreload') ||
        (rel.has('preload') && ['script', 'style', 'font'].includes(preloadAs ?? ''))
      ) {
        errors.push(...resourceErrors('Found unapproved external link resource', 'href', href, route));
      }
    }
    if (element.tagName === 'img' || element.tagName === 'source') {
      for (const name of ['src', 'srcset']) {
        const value = attributeValue(element, name);
        if (value !== undefined) {
          errors.push(...imageSourceErrors(name, value, route));
        }
      }
    }
  }

  for (const { element: anchor } of elements.filter(({ element }) => element.tagName === 'a')) {
    if (attributeValue(anchor, 'target')?.toLowerCase() !== '_blank') continue;
    const rel = new Set((attributeValue(anchor, 'rel') ?? '').toLowerCase().split(/\s+/));
    if (!rel.has('noopener') && !rel.has('noreferrer')) {
      errors.push(diagnostic(route, 'External-window link is missing noopener protection', 'rel', attributeValue(anchor, 'rel')));
    }
  }
  for (const { element: script, inTemplate } of elements.filter(({ element }) => element.tagName === 'script')) {
    if (inTemplate) continue;
    const src = attributeValue(script, 'src');
    const url = src ? externalUrl(src, route) : undefined;
    if (url && !APPROVED_EXTERNAL_SCRIPTS.has(url.href)) {
      errors.push(diagnostic(route, 'Unapproved external script', 'src', url.origin));
    }
  }
  for (const { element: iframe, inTemplate } of elements.filter(({ element }) => element.tagName === 'iframe')) {
    if (inTemplate) continue;
    const src = attributeValue(iframe, 'src');
    const url = src ? externalUrl(src, route) : undefined;
    if (url && url.origin !== 'https://giscus.app') {
      errors.push(diagnostic(route, 'Unapproved external frame', 'src', url.origin));
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
    if (data.draft === true) continue;
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
  const expectedPostCount = options.expectedPostCount ?? 40;
  const sourceContentRoot = resolve(projectRoot, options.sourceContentRoot ?? '.private-content');
  const postsDirectory = resolve(sourceContentRoot, 'posts');
  const postFiles = await filesInOrEmpty(postsDirectory, errors, `Unable to read source posts directory: ${postsDirectory}`);
  const routes: string[] = [];
  for (const file of postFiles) {
    if (!/\.mdx?$/i.test(file)) continue;
    const { data } = matter(await readFile(file, 'utf8'));
    if (data.draft === true) continue;
    if (typeof data.legacySlug === 'string') routes.push(`/posts/${data.legacySlug}/`);
  }
  if (routes.length !== expectedPostCount || new Set(routes).size !== expectedPostCount) {
    errors.push(
      `Expected ${expectedPostCount} unique legacy post routes, found ${new Set(routes).size}.`
    );
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
  if (generatedPostCount !== expectedPostCount) {
    errors.push(`Expected ${expectedPostCount} generated post routes, found ${generatedPostCount}.`);
  }

  const result = await inspectBuiltSite(distPath, routes, {
    sourceCnamePath: resolve(projectRoot, 'public/CNAME'),
    expectedLocalLinks: options.expectedLocalLinks
  });
  errors.push(...result.errors, ...(await nativeMarkdownImageErrors(distPath, postsDirectory)));
  return { ...result, errors };
}

async function main(): Promise<void> {
  const fixtureMode = process.argv.includes('--fixtures');
  const result = await inspectProjectBuiltSite(process.cwd(), {
    expectedLocalLinks: fixtureMode ? undefined : EXPECTED_LOCAL_LINKS,
    expectedPostCount: fixtureMode ? 2 : 40,
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
