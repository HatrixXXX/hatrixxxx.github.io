import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
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

test('marks oversized animated GIFs as retained during audit instead of aborting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-manifest-gif-limit-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .gif().toFile(join(imageRoot, 'img', 'oversized.gif'));
  await writeFile(join(blogRoot, '_posts', 'cover.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/oversized.gif\n---\n`);

  const manifest = await buildManifest(blogRoot, imageRoot, {
    readMetadata: async () => ({
      format: 'gif',
      width: 854,
      height: 480,
      pages: 753,
      loop: 0,
      delay: Array(753).fill(50)
    })
  });

  assert.deepEqual(
    manifest.entries.map(({ sourcePath, full, thumbnail }) => ({
      sourcePath,
      full: full.reason,
      thumbnail: thumbnail.reason
    })),
    [{ sourcePath: 'img/oversized.gif', full: 'input-pixel-limit', thumbnail: 'eligible' }]
  );
});

test('rejects generated output collisions before an apply can write files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-manifest-collision-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img', 'one'), { recursive: true });
  await mkdir(join(imageRoot, 'img', 'two'), { recursive: true });
  for (const directory of ['one', 'two']) {
    await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .png().toFile(join(imageRoot, 'img', directory, 'duplicate.png'));
  }
  await writeFile(join(blogRoot, '_posts', 'one.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/one/duplicate.png\n---\n`);
  await writeFile(join(blogRoot, '_posts', 'two.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/two/duplicate.png\n---\n`);

  await assert.rejects(buildManifest(blogRoot, imageRoot), /generated output collision/u);
});

test('rejects a symlinked image source', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-manifest-symlink-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const source = join(root, 'outside.png');
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toFile(source);
  try {
    await symlink(source, join(imageRoot, 'img', 'cover.png'), 'file');
  } catch (error) {
    if (error.code === 'EPERM') t.skip('symlinks require Windows developer mode or elevated privileges');
    else throw error;
  }
  await writeFile(join(blogRoot, '_posts', 'cover.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/cover.png\n---\n`);

  await assert.rejects(buildManifest(blogRoot, imageRoot), /symbolic link/u);
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
