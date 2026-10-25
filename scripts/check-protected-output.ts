import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor, type RemarkPlugin } from '@astrojs/markdown-remark';
import matter from 'gray-matter';
import { isApprovedRemoteImageUrl } from '../src/lib/safe-url';
import { snippetRoot } from '../src/lib/snippet-root';
import { sanctuaryRoot } from '../src/lib/sanctuary-root';

export interface ProtectedOutputCheckResult {
  errors: string[];
}

interface ProtectedSource {
  bodySnippets: string[];
  metadataValues: string[];
  resources: Array<{ name: string; bytes: Buffer }>;
}

const MIN_BODY_SNIPPET_LENGTH = 24;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*(?:<([^>\r\n]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g;
const HTML_IMAGE = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
const RAW_HTML_IMAGE = /<img(?:\s|\/?>)/i;
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

const MATCH_PREFIX_LENGTH = 8;

interface LiteralMatchers {
  prefixes: Map<string, string[]>;
  firstCharacters: Set<string>;
  shortValues: string[];
}

function literalMatchers(values: string[]): LiteralMatchers {
  const prefixes = new Map<string, string[]>();
  const firstCharacters = new Set<string>();
  const shortValues: string[] = [];
  for (const value of new Set(values)) {
    if (value.length < MATCH_PREFIX_LENGTH) {
      shortValues.push(value);
      continue;
    }
    const prefix = value.slice(0, MATCH_PREFIX_LENGTH);
    firstCharacters.add(prefix[0]);
    const candidates = prefixes.get(prefix) ?? [];
    candidates.push(value);
    prefixes.set(prefix, candidates);
  }
  return { prefixes, firstCharacters, shortValues };
}

function containsAny(matchers: LiteralMatchers, value: string): boolean {
  if (matchers.shortValues.some((candidate) => value.includes(candidate))) return true;
  for (let index = 0; index <= value.length - MATCH_PREFIX_LENGTH; index += 1) {
    if (!matchers.firstCharacters.has(value[index])) continue;
    const candidates = matchers.prefixes.get(value.slice(index, index + MATCH_PREFIX_LENGTH));
    if (candidates?.some((candidate) => value.startsWith(candidate, index))) return true;
  }
  return false;
}

function bodySnippets(content: string): string[] {
  const withoutImages = content.replace(MARKDOWN_IMAGE, ' ').replace(HTML_IMAGE, ' ');
  const normalizedBody = plainText(withoutImages);
  const snippets = withoutImages
    .split(/\r?\n+/)
    .map(plainText)
    .filter((snippet) => snippet.length >= MIN_BODY_SNIPPET_LENGTH);
  for (let offset = 0; offset < normalizedBody.length; offset += 32) {
    const snippet = normalizedBody.slice(offset, offset + 64).trim();
    if (snippet.length >= MIN_BODY_SNIPPET_LENGTH) {
      snippets.push(snippet);
    }
  }
  for (const tagMatch of content.matchAll(MARKUP_TAG)) {
    for (const attributeMatch of tagMatch[0].matchAll(MARKUP_ATTRIBUTE)) {
      if (STRUCTURAL_ATTRIBUTES.has(attributeMatch[1].toLowerCase())) continue;
      const value = decodeEntities(
        attributeMatch.slice(2).find((candidate) => candidate !== undefined) ?? ''
      ).replace(/\s+/g, ' ').trim();
      if (value.length >= MIN_BODY_SNIPPET_LENGTH) {
        snippets.push(value);
      }
    }
  }
  return [...new Set(snippets)];
}

interface MarkdownReferenceNode {
  type: string;
  identifier?: string;
  url?: string;
  value?: string;
  children?: MarkdownReferenceNode[];
}

async function imageReferences(content: string): Promise<{ references: string[]; hasRawHtmlImage: boolean }> {
  const references: string[] = [];
  let hasRawHtmlImage = false;
  for (const match of content.matchAll(MARKDOWN_IMAGE)) references.push(match[1] ?? match[2]);
  for (const match of content.matchAll(HTML_IMAGE)) references.push(match[1]);

  const collectReferenceImages: RemarkPlugin = () => (tree) => {
    const nodes: MarkdownReferenceNode[] = [];
    const collect = (node: MarkdownReferenceNode): void => {
      nodes.push(node);
      if (node.type === 'html' && RAW_HTML_IMAGE.test(node.value ?? '')) hasRawHtmlImage = true;
      node.children?.forEach(collect);
    };
    collect(tree as MarkdownReferenceNode);

    const definitions = new Map<string, string>();
    for (const node of nodes) {
      if (node.type !== 'definition' || node.identifier === undefined || node.url === undefined) continue;
      const identifier = node.identifier.toUpperCase();
      if (!definitions.has(identifier)) definitions.set(identifier, node.url);
    }
    for (const node of nodes) {
      if (node.type !== 'imageReference' || node.identifier === undefined) continue;
      const url = definitions.get(node.identifier.toUpperCase());
      if (url !== undefined) references.push(url);
    }
  };
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [collectReferenceImages]
  });
  await processor.render(content);
  return { references, hasRawHtmlImage };
}

async function protectedSources(snippetsRoot: string, sanctuaryRootPath: string, errors: Set<string>): Promise<ProtectedSource[]> {
  const sources: ProtectedSource[] = [];
  for (const [root, kind] of [[resolve(snippetsRoot), 'snippets'], [resolve(sanctuaryRootPath), 'sanctuary']] as const) {
    let sourceFiles: string[];
    try {
      sourceFiles = (await filesIn(root)).filter((file) => /\.mdx?$/i.test(file));
    } catch {
      errors.add(`${kind}: unable to read protected content sources`);
      continue;
    }
    for (const sourceFile of sourceFiles) {
      const parsed = matter(await readFile(sourceFile, 'utf8'));
      const sourceName = `${kind}/${outputPath(root, sourceFile)}`;
      const { references, hasRawHtmlImage } = await imageReferences(parsed.content);
      if (hasRawHtmlImage) errors.add(`${sourceName}: locked Markdown contains a raw HTML image`);
      let protectedBody = parsed.content;
      const resources: Array<{ name: string; bytes: Buffer }> = [];
      for (const reference of references) {
        if (REMOTE_REFERENCE.test(reference)) {
          try {
            if (isApprovedRemoteImageUrl(new URL(reference))) {
              protectedBody = protectedBody.replaceAll(reference, '');
              continue;
            }
          } catch {
            // Malformed remote references are rejected below.
          }
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
        if (!pathIsWithin(root, resourcePath)) {
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
        bodySnippets: bodySnippets(protectedBody),
        metadataValues: kind === 'snippets'
          ? [parsed.data.title, parsed.data.description].filter((value): value is string => typeof value === 'string')
          : [],
        resources
      });
    }
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
  distRoot: string,
  snippetsRoot = snippetRoot('snippets'),
  sanctuaryRootPath = sanctuaryRoot('sanctuary')
): Promise<ProtectedOutputCheckResult> {
  const resolvedDistRoot = resolve(distRoot);
  const errors = new Set<string>();
  const sources = await protectedSources(snippetsRoot, sanctuaryRootPath, errors);
  const metadataMatchers = literalMatchers(sources.flatMap((source) => source.metadataValues));
  const bodyMatchers = literalMatchers(sources.flatMap((source) => source.bodySnippets));
  const resources = sources.flatMap((source) => source.resources);
  const resourceNameMatchers = literalMatchers(resources.map((resource) => resource.name).filter(Boolean));

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
    if (containsAny(metadataMatchers, decodedText) || containsAny(metadataMatchers, normalizedText)) {
      errors.add(output.relativePath + ': protected snippet metadata plaintext');
    }
    if (containsAny(bodyMatchers, decodedText) || containsAny(bodyMatchers, normalizedText)) {
      errors.add(output.relativePath + ': protected Markdown body plaintext');
    }
    if (resources.some((resource) => resource.bytes.length > 0 && output.bytes.indexOf(resource.bytes) !== -1)) {
      errors.add(output.relativePath + ': original protected resource bytes');
    }
    if (containsAny(resourceNameMatchers, text)) {
      errors.add(output.relativePath + ': original protected resource name');
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
  const distRoot = resolve(args[0] ?? 'dist');
  const result = await inspectProtectedOutput(distRoot);
  if (result.errors.length === 0) {
    console.log('Protected output audit passed.');
    return;
  }
  for (const error of result.errors) console.error(error);
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) void main();
