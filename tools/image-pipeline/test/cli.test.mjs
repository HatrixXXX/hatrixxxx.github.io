import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PREFIX = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/';
const CLI = fileURLToPath(new URL('../cli.mjs', import.meta.url));

function commitFixture(root) {
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Image Pipeline Test'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
  return commitChanges(root, 'fixture');
}

function commitChanges(root, message) {
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', message], { cwd: root });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function worktreeStatus(root) {
  return execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function createStampFixture() {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-cli-stamp-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const outputPath = 'img/optimized/cover.png.webp';
  await mkdir(join(blogRoot, 'tools', 'image-pipeline'), { recursive: true });
  await mkdir(join(imageRoot, 'img', 'optimized'), { recursive: true });
  await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .webp().toFile(join(imageRoot, outputPath));
  commitFixture(imageRoot);
  const imageCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: imageRoot,
    encoding: 'utf8'
  }).trim();
  const manifestPath = join(blogRoot, 'tools', 'image-pipeline', 'manifest.json');
  const outputBytes = (await stat(join(imageRoot, outputPath))).size;
  const manifest = {
    schemaVersion: 3,
    generatedAt: '2026-09-02T00:00:00.000Z',
    blogCommit: null,
    sourceImageCommit: imageCommit,
    publishedImageCommit: null,
    entries: [{
      sourcePath: 'img/cover.png',
      sourceBytes: 1,
      source: { format: 'png', width: 2, height: 2, pages: 1 },
      references: [],
      full: {
        adopted: true,
        path: outputPath,
        url: `${PREFIX}${outputPath}`,
        outputBytes,
        reason: 'smaller',
        width: 2,
        height: 2,
        pages: 1,
        format: 'webp'
      },
      thumbnail: {
        adopted: false,
        path: 'img/thumbnails/cover.png.webp',
        url: `${PREFIX}img/thumbnails/cover.png.webp`,
        outputBytes: null,
        reason: 'not-published-cover'
      }
    }]
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { blogRoot, imageRoot, imageCommit, manifestPath };
}

test('apply leaves blogs and final outputs untouched when a later frontmatter update is invalid', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-cli-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const firstUrl = `${PREFIX}img/first.png`;
  const secondUrl = `${PREFIX}img/second.png`;
  const firstPost = `---\nimage:\n  path: ${firstUrl}\n---\n![](${firstUrl})\n`;
  const secondPost = `---\nimage:\n  path: ${secondUrl}\n  path: ${secondUrl}\n---\n![](${secondUrl})\n`;
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await writeFile(join(blogRoot, '_posts', 'first.md'), firstPost);
  await writeFile(join(blogRoot, '_posts', 'second.md'), secondPost);
  for (const name of ['first.png', 'second.png']) {
    await sharp({ create: { width: 32, height: 32, channels: 3, background: 'red' } })
      .png().toFile(join(imageRoot, 'img', name));
  }
  commitFixture(blogRoot);
  commitFixture(imageRoot);

  const result = spawnSync(process.execPath, [CLI, 'apply', '--blog-root', blogRoot, '--image-root', imageRoot], {
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.equal(await readFile(join(blogRoot, '_posts', 'first.md'), 'utf8'), firstPost);
  assert.equal(await readFile(join(blogRoot, '_posts', 'second.md'), 'utf8'), secondPost);
  await assert.rejects(stat(join(imageRoot, 'img', 'optimized')), { code: 'ENOENT' });
  await assert.rejects(stat(join(imageRoot, 'img', 'thumbnails')), { code: 'ENOENT' });
});

test('apply validates every output parent before installing any staged output', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-cli-output-parent-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const sourceUrl = `${PREFIX}img/cover.png`;
  const post = `---\nimage:\n  path: ${sourceUrl}\n---\n![](${sourceUrl})\n`;
  const outside = join(root, 'outside');
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await mkdir(outside);
  await writeFile(join(blogRoot, '_posts', 'cover.md'), post);
  await writeFile(join(imageRoot, '.gitignore'), 'img/thumbnails/\n');
  await sharp({ create: { width: 32, height: 32, channels: 3, background: 'red' } })
    .png().toFile(join(imageRoot, 'img', 'cover.png'));
  commitFixture(blogRoot);
  commitFixture(imageRoot);
  try {
    await symlink(outside, join(imageRoot, 'img', 'thumbnails'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') t.skip('symlinks require Windows developer mode or elevated privileges');
    else throw error;
  }

  const result = spawnSync(process.execPath, [CLI, 'apply', '--blog-root', blogRoot, '--image-root', imageRoot], {
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.equal(await readFile(join(blogRoot, '_posts', 'cover.md'), 'utf8'), post);
  await assert.rejects(stat(join(imageRoot, 'img', 'optimized')), { code: 'ENOENT' });
});

test('a second identical apply is a byte-for-byte clean no-op', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-cli-double-apply-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const sourceUrl = `${PREFIX}img/cover.png`;
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await writeFile(join(blogRoot, '_posts', 'cover.md'), `---\nimage:\n  path: ${sourceUrl}\n---\n![](${sourceUrl})\n`);
  const pixels = Buffer.alloc(800 * 400 * 3);
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = (index * 31) % 251;
  await sharp(pixels, { raw: { width: 800, height: 400, channels: 3 } })
    .png({ compressionLevel: 0 }).toFile(join(imageRoot, 'img', 'cover.png'));
  commitFixture(blogRoot);
  commitFixture(imageRoot);

  const first = spawnSync(process.execPath, [CLI, 'apply', '--blog-root', blogRoot, '--image-root', imageRoot], {
    encoding: 'utf8'
  });
  assert.equal(first.status, 0, first.stderr);
  commitChanges(imageRoot, 'generated outputs');
  commitChanges(blogRoot, 'migrated references');
  const manifestPath = join(blogRoot, 'tools', 'image-pipeline', 'manifest.json');
  const manifestBefore = await readFile(manifestPath, 'utf8');
  const manifestModifiedBefore = (await stat(manifestPath)).mtimeMs;

  const second = spawnSync(process.execPath, [CLI, 'apply', '--blog-root', blogRoot, '--image-root', imageRoot], {
    encoding: 'utf8'
  });

  assert.equal(second.status, 0, second.stderr);
  assert.equal(await readFile(manifestPath, 'utf8'), manifestBefore);
  assert.equal((await stat(manifestPath)).mtimeMs, manifestModifiedBefore);
  assert.equal(worktreeStatus(blogRoot), '');
  assert.equal(worktreeStatus(imageRoot), '');
});

async function createPruneFixture({ missingSecondSource = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-cli-prune-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const manifestPath = join(blogRoot, 'tools', 'image-pipeline', 'manifest.json');
  const report = join(root, 'prune-report.json');
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(blogRoot, 'tools', 'image-pipeline'), { recursive: true });
  await mkdir(join(imageRoot, 'img', 'optimized'), { recursive: true });
  const entries = [];
  for (const name of ['a', 'b']) {
    const sourcePath = `img/${name}.png`;
    const outputPath = `img/optimized/${name}.png.webp`;
    const source = `${name}-source-bytes`;
    await writeFile(join(imageRoot, sourcePath), source);
    await sharp({ create: { width: 1, height: 1, channels: 3, background: name === 'a' ? 'red' : 'blue' } })
      .webp().toFile(join(imageRoot, outputPath));
    const outputBytes = (await stat(join(imageRoot, outputPath))).size;
    entries.push({
      sourcePath,
      sourceBytes: Buffer.byteLength(source),
      source: { format: 'png', width: 1, height: 1, pages: 1 },
      references: [],
      full: {
        path: outputPath,
        url: `${PREFIX}${outputPath}`,
        adopted: true,
        outputBytes,
        reason: 'smaller',
        width: 1,
        height: 1,
        pages: 1,
        format: 'webp'
      },
      thumbnail: {
        path: `img/thumbnails/${name}.png.webp`,
        url: `${PREFIX}img/thumbnails/${name}.png.webp`,
        adopted: false,
        outputBytes: null,
        reason: 'not-published-cover'
      }
    });
  }
  await writeFile(join(blogRoot, '_posts', 'images.md'), entries.map(({ full }) => `![](${full.url})`).join('\n'));
  commitFixture(imageRoot);
  const publishedImageCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: imageRoot,
    encoding: 'utf8'
  }).trim();
  if (missingSecondSource) {
    await unlink(join(imageRoot, 'img', 'b.png'));
    commitChanges(imageRoot, 'remove second source');
  }
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 3,
    generatedAt: '2026-09-02T00:00:00.000Z',
    blogCommit: null,
    sourceImageCommit: publishedImageCommit,
    publishedImageCommit,
    entries
  }, null, 2)}\n`);
  commitFixture(blogRoot);
  return { blogRoot, imageRoot, report };
}

test('prune without confirmation writes an exact dry-run report and deletes nothing', async () => {
  const { blogRoot, imageRoot, report } = await createPruneFixture();

  const result = spawnSync(process.execPath, [
    CLI, 'prune', '--blog-root', blogRoot, '--image-root', imageRoot, '--report', report
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.status, 'planned');
  assert.deepEqual(plan.candidates, [
    { path: 'img/a.png', bytes: 14 },
    { path: 'img/b.png', bytes: 14 }
  ]);
  assert.equal(plan.totalBytes, 28);
  assert.equal(await pathExists(join(imageRoot, 'img', 'a.png')), true);
  assert.equal(await pathExists(join(imageRoot, 'img', 'b.png')), true);
});

test('prune preflights every candidate before deleting the first file', async () => {
  const { blogRoot, imageRoot, report } = await createPruneFixture({ missingSecondSource: true });

  const result = spawnSync(process.execPath, [
    CLI, 'prune', '--blog-root', blogRoot, '--image-root', imageRoot,
    '--report', report, '--confirm-prune'
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.equal(await pathExists(join(imageRoot, 'img', 'a.png')), true);
});

test('audit rejects a linked root before writing a report for an empty repository', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-cli-linked-root-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const linkedBlogRoot = join(root, 'linked-blog');
  const report = join(root, 'reports', 'audit.json');
  await mkdir(blogRoot);
  await mkdir(imageRoot);
  try {
    await symlink(blogRoot, linkedBlogRoot, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('symlinks require Windows developer mode or elevated privileges');
      return;
    }
    throw error;
  }

  const result = spawnSync(process.execPath, [
    CLI, 'audit', '--blog-root', linkedBlogRoot, '--image-root', imageRoot, '--report', report
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  await assert.rejects(stat(report), { code: 'ENOENT' });
});

test('stamp records an explicitly validated image commit', async () => {
  const { blogRoot, imageRoot, imageCommit, manifestPath } = await createStampFixture();

  const result = spawnSync(process.execPath, [
    CLI, 'stamp', '--blog-root', blogRoot, '--image-root', imageRoot, '--image-commit', imageCommit
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const stamped = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(stamped.publishedImageCommit, imageCommit);
});

test('stamp without --image-commit fails without changing the manifest', async () => {
  const { blogRoot, imageRoot, manifestPath } = await createStampFixture();
  const before = await readFile(manifestPath, 'utf8');

  const result = spawnSync(process.execPath, [
    CLI, 'stamp', '--blog-root', blogRoot, '--image-root', imageRoot
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--image-commit is required for stamp/u);
  assert.equal(await readFile(manifestPath, 'utf8'), before);
});
