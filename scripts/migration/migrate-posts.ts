import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import { classifyPost, seriesFor } from './classify-post';

interface SourceFrontmatter {
  title?: unknown;
  description?: unknown;
  math?: unknown;
  mermaid?: unknown;
  image?: { path?: unknown };
}

export function toPostFrontmatter(
  fileName: string,
  source: SourceFrontmatter,
  updatedDate?: string
) {
  const match = fileName.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/u);
  if (!match) throw new Error(`Unsupported post filename: ${fileName}`);

  const title = String(source.title ?? match[2]);
  const classification = classifyPost(title);
  const series = seriesFor(title) ?? seriesFor(match[2]);

  return {
    title,
    description: String(source.description ?? title),
    pubDate: match[1],
    ...(updatedDate ? { updatedDate } : {}),
    cover: String(source.image?.path ?? '/images/default-cover.svg'),
    category: classification.category,
    tags: classification.tags,
    ...(series ? { series: series.name, seriesOrder: series.order } : {}),
    draft: false,
    math: Boolean(source.math),
    mermaid: Boolean(source.mermaid),
    legacySlug: match[2]
  };
}

function lastModified(path: string): string | undefined {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', path], {
      encoding: 'utf8'
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const sourceDir = '_posts';
  const outputDir = 'src/content/posts';
  const files = (await readdir(sourceDir)).filter((name) => name.endsWith('.md')).sort();

  if (files.length !== 40) throw new Error(`Expected 40 posts, found ${files.length}`);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const file of files) {
    const sourcePath = join(sourceDir, file);
    const parsed = matter(await readFile(sourcePath, 'utf8'));
    const data = toPostFrontmatter(file, parsed.data, lastModified(sourcePath));
    await writeFile(join(outputDir, basename(file)), matter.stringify(parsed.content, data), 'utf8');
  }

  const draftDir = 'src/drafts';
  await rm(draftDir, { recursive: true, force: true });
  await mkdir(draftDir, { recursive: true });

  for (const file of (await readdir('_draft')).filter((name) => name.endsWith('.md'))) {
    await writeFile(join(draftDir, file), await readFile(join('_draft', file)));
  }
}

if (process.argv[1]?.endsWith('migrate-posts.ts')) await main();
