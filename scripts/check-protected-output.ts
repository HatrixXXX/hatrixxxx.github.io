import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

export interface ProtectedOutputCheckResult {
  errors: string[];
}

interface ProtectedSource {
  bodySnippets: string[];
  resources: Array<{ name: string; bytes: Buffer }>;
}

const MIN_BODY_SNIPPET_LENGTH = 24;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*(?:<([^>\r\n]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g;
const HTML_IMAGE = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
const REMOTE_REFERENCE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const MARKUP_TAG = /<[A-Za-z][^>]*>/g;
const MARKUP_ATTRIBUTE = /(?:^|\s)([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\}|([^\s"'=<>`]+))/g;
const STRUCTURAL_ATTRIBUTES = new Set([
  'class',
  'classname',
  'decoding',
  'height',
  'href',
  'id',
  'loading',
  'role',
  'src',
  'style',
  'width'
]);

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }))).flat();
}

function outputPath(root: string, file: string): string {
  return relative(root, file).split(sep).join('/');
}

function pathIsWithin(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'");
}

function plainText(value: string): string {
  return decodeEntities(value)
    .replace(/```[^\r\n]*[\r\n]?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(?:\*\*|__)(.+?)(?:\*\*|__)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function bodySnippets(content: string, publicMetadata: string): string[] {
  const withoutImages = content.replace(MARKDOWN_IMAGE, ' ').replace(HTML_IMAGE, ' ');
  const publicText = plainText(publicMetadata);
  const normalizedBody = plainText(withoutImages);
  const snippets = withoutImages
    .split(/\r?\n+/)
    .map(plainText)
    .filter((snippet) => snippet.length >= MIN_BODY_SNIPPET_LENGTH)
    .filter((snippet) => !publicText.includes(snippet));
  for (let offset = 0; offset < normalizedBody.length; offset += 32) {
    const snippet = normalizedBody.slice(offset, offset + 64).trim();
    if (snippet.length >= MIN_BODY_SNIPPET_LENGTH && !publicText.includes(snippet)) {
      snippets.push(snippet);
    }
  }
  for (const tagMatch of content.matchAll(MARKUP_TAG)) {
    for (const attributeMatch of tagMatch[0].matchAll(MARKUP_ATTRIBUTE)) {
      if (STRUCTURAL_ATTRIBUTES.has(attributeMatch[1].toLowerCase())) continue;
      const value = decodeEntities(
        attributeMatch.slice(2).find((candidate) => candidate !== undefined) ?? ''
      ).replace(/\s+/g, ' ').trim();
      if (value.length >= MIN_BODY_SNIPPET_LENGTH && !publicText.includes(value)) {
        snippets.push(value);
      }
    }
  }
  return [...new Set(snippets)];
}

function imageReferences(content: string): string[] {
  const references: string[] = [];
  for (const match of content.matchAll(MARKDOWN_IMAGE)) references.push(match[1] ?? match[2]);
  for (const match of content.matchAll(HTML_IMAGE)) references.push(match[1]);
  return references;
}

async function protectedSources(contentRoot: string, errors: Set<string>): Promise<ProtectedSource[]> {
  const postsRoot = resolve(contentRoot, 'posts');
  let sourceFiles: string[];
  try {
    sourceFiles = (await filesIn(postsRoot)).filter((file) => /\.mdx?$/i.test(file));
  } catch {
    errors.add('posts: unable to read protected content sources');
    return [];
  }

  const sources: ProtectedSource[] = [];
  for (const sourceFile of sourceFiles) {
    const parsed = matter(await readFile(sourceFile, 'utf8'));
    if (parsed.data.locked !== true || parsed.data.draft === true) continue;

    const sourceName = outputPath(contentRoot, sourceFile);
    const references = imageReferences(parsed.content);
    const resources: Array<{ name: string; bytes: Buffer }> = [];
    for (const reference of references) {
      if (REMOTE_REFERENCE.test(reference)) {
        errors.add(`${sourceName}: locked Markdown contains a remote body image`);
        continue;
      }

      let decodedReference: string;
      try {
        decodedReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
      } catch {
        errors.add(`${sourceName}: locked Markdown contains an invalid resource reference`);
        continue;
      }
      const resourcePath = resolve(dirname(sourceFile), decodedReference);
      if (!pathIsWithin(postsRoot, resourcePath)) {
        errors.add(`${sourceName}: locked Markdown resource leaves the content root`);
        continue;
      }
      try {
        if (!(await stat(resourcePath)).isFile()) throw new Error('not a file');
        resources.push({ name: basename(resourcePath), bytes: await readFile(resourcePath) });
      } catch {
        errors.add(`${sourceName}: locked Markdown resource cannot be read`);
      }
    }

    sources.push({
      bodySnippets: bodySnippets(parsed.content, JSON.stringify(parsed.data)),
      resources
    });
  }
  return sources;
}

async function protectedRoutes(distRoot: string, errors: Set<string>): Promise<string[]> {
  const manifestPath = join(distRoot, 'protected-content', 'manifest.json');
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { routes?: unknown };
    if (!Array.isArray(manifest.routes) || !manifest.routes.every((route) => typeof route === 'string')) {
      throw new Error('invalid routes');
    }
    return manifest.routes;
  } catch {
    errors.add('protected-content/manifest.json: unable to read protected route manifest');
    return [];
  }
}

function routeOutputPath(route: string): string | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(route, 'https://hatrix.site').pathname);
  } catch {
    return undefined;
  }
  const normalized = pathname.replace(/^\/+|\/+$/g, '');
  return normalized ? `${normalized}/index.html` : 'index.html';
}

function hasNoindex(html: string): boolean {
  return /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*\bnoindex\b[^"']*\bnofollow\b[^"']*["'])[^>]*>/i.test(html);
}

export async function inspectProtectedOutput(
  contentRoot: string,
  distRoot: string
): Promise<ProtectedOutputCheckResult> {
  const resolvedContentRoot = resolve(contentRoot);
  const resolvedDistRoot = resolve(distRoot);
  const errors = new Set<string>();
  const sources = await protectedSources(resolvedContentRoot, errors);

  let outputFiles: string[];
  try {
    outputFiles = await filesIn(resolvedDistRoot);
  } catch {
    return { errors: [...errors, 'dist: unable to read built output'] };
  }
  const outputs = await Promise.all(outputFiles.map(async (file) => ({
    file,
    relativePath: outputPath(resolvedDistRoot, file),
    bytes: await readFile(file)
  })));

  for (const output of outputs) {
    const text = output.bytes.toString('utf8');
    const decodedText = decodeEntities(text);
    const normalizedText = plainText(text);
    for (const source of sources) {
      if (source.bodySnippets.some(
        (snippet) => decodedText.includes(snippet) || normalizedText.includes(snippet)
      )) {
        errors.add(`${output.relativePath}: protected Markdown body plaintext`);
      }
      for (const resource of source.resources) {
        if (resource.bytes.length > 0 && output.bytes.indexOf(resource.bytes) !== -1) {
          errors.add(`${output.relativePath}: original protected resource bytes`);
        }
        if (resource.name && text.includes(resource.name)) {
          errors.add(`${output.relativePath}: original protected resource name`);
        }
      }
    }
  }

  const routes = await protectedRoutes(resolvedDistRoot, errors);
  const sitemapOutputs = outputs.filter(({ relativePath }) => /^sitemap(?:-.*)?\.xml$/i.test(relativePath));
  for (const route of routes) {
    const pagePath = routeOutputPath(route);
    if (!pagePath) {
      errors.add('protected-content/manifest.json: invalid protected route');
      continue;
    }
    const page = outputs.find(({ relativePath }) => relativePath === pagePath);
    if (!page || !hasNoindex(page.bytes.toString('utf8'))) {
      errors.add(`${pagePath}: protected route is missing noindex, nofollow`);
    }

    let protectedUrl: URL;
    try {
      protectedUrl = new URL(route, 'https://hatrix.site');
    } catch {
      continue;
    }
    for (const sitemap of sitemapOutputs) {
      const locations = [...sitemap.bytes.toString('utf8').matchAll(/<loc>([^<]+)<\/loc>/gi)];
      if (locations.some((match) => {
        try {
          return new URL(decodeEntities(match[1])).pathname === protectedUrl.pathname;
        } catch {
          return false;
        }
      })) {
        errors.add(`${sitemap.relativePath}: protected route is present in sitemap`);
      }
    }
  }

  return { errors: [...errors].sort() };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === '--') args.shift();
  const contentRoot = resolve(args[0] ?? process.env.HATRIX_CONTENT_DIR ?? 'src/content');
  const distRoot = resolve(args[1] ?? 'dist');
  const result = await inspectProtectedOutput(contentRoot, distRoot);
  if (result.errors.length === 0) {
    console.log('Protected output audit passed.');
    return;
  }
  for (const error of result.errors) console.error(error);
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) void main();
