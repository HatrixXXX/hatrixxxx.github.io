import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { decodeRepoPath } from './paths.mjs';

const SOURCE_DIRS = ['_posts', '_draft', '_tabs'];
const TEXT_EXTENSIONS = new Set(['.md', '.html', '.yml', '.yaml', '.scss', '.css', '.js']);
const URL_PATTERN = /https?:\/\/cdn\.jsdelivr\.net\/gh\/HatrixXXX\/Hatrix-s-Blog-Image\/[^\s"'<>]+/gu;

async function walk(dir) {
  const output = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return output;
    throw error;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) output.push(path);
  }
  return output;
}

function scopeFor(file) {
  if (file.startsWith('_posts/')) return 'published';
  if (file.startsWith('_draft/')) return 'draft';
  return 'site';
}

export async function scanReferences(root) {
  const refs = [];
  for (const sourceDir of SOURCE_DIRS) {
    for (const absolute of await walk(join(root, sourceDir))) {
      const text = await readFile(absolute, 'utf8');
      const file = relative(root, absolute).split(sep).join('/');
      const firstFence = text.startsWith('---') ? text.indexOf('\n---', 3) : -1;
      for (const match of text.matchAll(URL_PATTERN)) {
        const rawUrl = match[0].replace(/\)+$/u, '');
        const repoPath = decodeRepoPath(rawUrl);
        if (!repoPath) continue;
        const lineStart = text.lastIndexOf('\n', match.index) + 1;
        const lineEnd = text.indexOf('\n', match.index);
        const lineText = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
        const frontmatterKind = /^\s+path\s*:/u.test(lineText)
          ? 'cover'
          : /^\s+thumbnail\s*:/u.test(lineText) ? 'thumbnail' : 'inline';
        refs.push({
          file,
          line: text.slice(0, match.index).split(/\r\n|\n|\r/u).length,
          rawUrl,
          repoPath,
          scope: scopeFor(file),
          kind: firstFence > match.index ? frontmatterKind : 'inline',
          offset: match.index
        });
      }
    }
  }
  return refs.sort((a, b) => a.file.localeCompare(b.file) || a.offset - b.offset)
    .map(({ offset, ...ref }) => ref);
}
