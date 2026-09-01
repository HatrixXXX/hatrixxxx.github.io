import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildManifest, pruneCandidates } from '../manifest.mjs';

test('prunes only adopted sources with zero current references', () => {
  const manifest = { entries: [
    { sourcePath: 'img/a.png', full: { adopted: true } },
    { sourcePath: 'img/b.png', full: { adopted: false } },
    { sourcePath: 'img/c.png', full: { adopted: true } }
  ] };
  const refs = new Set(['img/c.png']);
  assert.deepEqual(pruneCandidates(manifest, refs), ['img/a.png']);
});

test('builds eligible output records from an uncommitted fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-manifest-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .png().toFile(join(imageRoot, 'img', 'cover.png'));
  await writeFile(join(blogRoot, '_posts', 'cover.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/cover.png\n---\n`);

  const manifest = await buildManifest(blogRoot, imageRoot);

  assert.equal(manifest.blogCommit, null);
  assert.equal(manifest.imageCommit, null);
  assert.deepEqual(manifest.entries.map(({ sourcePath, full, thumbnail }) => ({
    sourcePath, full: full.reason, thumbnail: thumbnail.reason
  })), [{ sourcePath: 'img/cover.png', full: 'eligible', thumbnail: 'eligible' }]);
});

test('CLI help lists the guarded migration commands and options', () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL('../cli.mjs', import.meta.url)), '--help'], {
    encoding: 'utf8'
  });
  assert.match(output, /audit.*apply.*prune/us);
  assert.match(output, /--blog-root/u);
  assert.match(output, /--image-root/u);
  assert.match(output, /--report/u);
  assert.match(output, /--confirm-prune/u);
});
