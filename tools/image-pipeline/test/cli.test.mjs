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

async function createAppliedFixture() {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-cli-repair-'));
  const blogRoot = join(root, 'blog');
  const imageRoot = join(root, 'images');
  const postPath = join(blogRoot, '_posts', 'cover.md');
  const sourcePath = 'img/cover.png';
  const sourceUrl = `${PREFIX}${sourcePath}`;
  await mkdir(join(blogRoot, '_posts'), { recursive: true });
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await writeFile(postPath, `---\nimage:\n  path: ${sourceUrl}\n---\n![](${sourceUrl})\n`);
  const pixels = Buffer.alloc(800 * 400 * 3);
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = (index * 31) % 251;
  await sharp(pixels, { raw: { width: 800, height: 400, channels: 3 } })
    .png({ compressionLevel: 0 }).toFile(join(imageRoot, sourcePath));
  commitFixture(blogRoot);
  commitFixture(imageRoot);
  const applied = spawnSync(process.execPath, [
    CLI, 'apply', '--blog-root', blogRoot, '--image-root', imageRoot
  ], { encoding: 'utf8' });
  assert.equal(applied.status, 0, applied.stderr);
  commitChanges(imageRoot, 'generated outputs');
  commitChanges(blogRoot, 'migrated references');
  const manifestPath = join(blogRoot, 'tools', 'image-pipeline', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = manifest.entries[0];
  return {
    root, blogRoot, imageRoot, postPath, manifestPath,
    sourcePath, sourceUrl, fullUrl: entry.full.url, thumbnailUrl: entry.thumbnail.url
  };
}

async function auditFixture(fixture, name) {
  const report = join(fixture.root, `${name}-audit.json`);
  const result = spawnSync(process.execPath, [
    CLI, 'audit', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot, '--report', report
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(await readFile(report, 'utf8'));
}

async function applyFixture(fixture) {
  const beforeManifest = await readFile(fixture.manifestPath, 'utf8');
  const result = spawnSync(process.execPath, [
    CLI, 'apply', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(fixture.manifestPath, 'utf8'), beforeManifest);
  assert.equal(worktreeStatus(fixture.imageRoot), '');
}

async function commitRepairAndAssertNoop(fixture, message) {
  commitChanges(fixture.blogRoot, message);
  const manifestBefore = await readFile(fixture.manifestPath, 'utf8');
  const modifiedBefore = (await stat(fixture.manifestPath)).mtimeMs;
  const result = spawnSync(process.execPath, [
    CLI, 'apply', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(fixture.manifestPath, 'utf8'), manifestBefore);
  assert.equal((await stat(fixture.manifestPath)).mtimeMs, modifiedBefore);
  assert.equal(worktreeStatus(fixture.blogRoot), '');
  assert.equal(worktreeStatus(fixture.imageRoot), '');
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
  const auditReport = join(root, 'current-audit.json');
  const audit = spawnSync(process.execPath, [
    CLI, 'audit', '--blog-root', blogRoot, '--image-root', imageRoot, '--report', auditReport
  ], { encoding: 'utf8' });
  assert.equal(audit.status, 0, audit.stderr);
  assert.deepEqual(JSON.parse(await readFile(auditReport, 'utf8')).referenceRepairs, []);

  const second = spawnSync(process.execPath, [CLI, 'apply', '--blog-root', blogRoot, '--image-root', imageRoot], {
    encoding: 'utf8'
  });

  assert.equal(second.status, 0, second.stderr);
  assert.equal(await readFile(manifestPath, 'utf8'), manifestBefore);
  assert.equal((await stat(manifestPath)).mtimeMs, manifestModifiedBefore);
  assert.equal(worktreeStatus(blogRoot), '');
  assert.equal(worktreeStatus(imageRoot), '');
});

test('apply repairs a reintroduced adopted source URL without reconversion', async () => {
  const fixture = await createAppliedFixture();
  const migrated = await readFile(fixture.postPath, 'utf8');
  await writeFile(fixture.postPath, migrated.replace(`![](${fixture.fullUrl})`, `![](${fixture.sourceUrl})`));
  commitChanges(fixture.blogRoot, 'reintroduce source URL');

  const audit = await auditFixture(fixture, 'reintroduced');
  assert.ok(audit.referenceRepairs.some((repair) => repair.type === 'replace-reference' &&
    repair.kind === 'inline' && repair.fromUrl === fixture.sourceUrl && repair.toUrl === fixture.fullUrl));

  await applyFixture(fixture);
  assert.doesNotMatch(await readFile(fixture.postPath, 'utf8'), new RegExp(fixture.sourceUrl, 'u'));
  await commitRepairAndAssertNoop(fixture, 'repair source URL');
});

test('apply restores a missing thumbnail from the existing mapping', async () => {
  const fixture = await createAppliedFixture();
  const migrated = await readFile(fixture.postPath, 'utf8');
  await writeFile(fixture.postPath, migrated.replace(`  thumbnail: ${fixture.thumbnailUrl}\n`, ''));
  commitChanges(fixture.blogRoot, 'remove thumbnail');

  const audit = await auditFixture(fixture, 'missing-thumbnail');
  assert.ok(audit.referenceRepairs.some((repair) => repair.type === 'upsert-thumbnail' &&
    repair.file === '_posts/cover.md' && repair.thumbnailUrl === fixture.thumbnailUrl));

  await applyFixture(fixture);
  assert.match(await readFile(fixture.postPath, 'utf8'), new RegExp(`thumbnail: ${fixture.thumbnailUrl}`, 'u'));
  await commitRepairAndAssertNoop(fixture, 'restore thumbnail');
});

test('apply corrects a wrong thumbnail from the existing mapping', async () => {
  const fixture = await createAppliedFixture();
  const wrongThumbnail = `${PREFIX}img/does-not-exist.png`;
  const migrated = await readFile(fixture.postPath, 'utf8');
  await writeFile(fixture.postPath, migrated.replace(fixture.thumbnailUrl, wrongThumbnail));
  commitChanges(fixture.blogRoot, 'set wrong thumbnail');

  const audit = await auditFixture(fixture, 'wrong-thumbnail');
  assert.ok(audit.referenceRepairs.some((repair) => repair.type === 'upsert-thumbnail' &&
    repair.fromUrl === wrongThumbnail && repair.thumbnailUrl === fixture.thumbnailUrl));

  await applyFixture(fixture);
  assert.match(await readFile(fixture.postPath, 'utf8'), new RegExp(`thumbnail: ${fixture.thumbnailUrl}`, 'u'));
  await commitRepairAndAssertNoop(fixture, 'correct thumbnail');
});

test('apply repairs a new post that reuses a previously adopted source', async () => {
  const fixture = await createAppliedFixture();
  const reusedPost = join(fixture.blogRoot, '_posts', 'reuse.md');
  await writeFile(reusedPost, `---\nimage:\n  path: ${fixture.sourceUrl}\n---\n![](${fixture.sourceUrl})\n`);
  commitChanges(fixture.blogRoot, 'reuse known source');

  const audit = await auditFixture(fixture, 'reused-source');
  assert.equal(audit.entries.filter(({ sourcePath }) => sourcePath === fixture.sourcePath).length, 1);
  assert.equal(audit.referenceRepairs.filter(({ file }) => file === '_posts/reuse.md').length, 3);

  await applyFixture(fixture);
  const repaired = await readFile(reusedPost, 'utf8');
  assert.equal(repaired.match(new RegExp(fixture.fullUrl, 'gu')).length, 2);
  assert.match(repaired, new RegExp(`thumbnail: ${fixture.thumbnailUrl}`, 'u'));
  await commitRepairAndAssertNoop(fixture, 'repair reused source');
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
  assert.equal(plan.schemaVersion, 2);
  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.status, 'planned');
  assert.equal(plan.blogHead, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: blogRoot, encoding: 'utf8' }).trim());
  assert.equal(plan.imageHead, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: imageRoot, encoding: 'utf8' }).trim());
  assert.match(plan.manifestSha256, /^[0-9a-f]{64}$/u);
  assert.match(plan.planDigest, /^[0-9a-f]{64}$/u);
  assert.deepEqual(plan.candidates, [
    { path: 'img/a.png', bytes: 14 },
    { path: 'img/b.png', bytes: 14 }
  ]);
  assert.equal(plan.totalBytes, 28);
  assert.equal(await pathExists(join(imageRoot, 'img', 'a.png')), true);
  assert.equal(await pathExists(join(imageRoot, 'img', 'b.png')), true);
});

async function writePrunePlan(fixture) {
  const result = spawnSync(process.execPath, [
    CLI, 'prune', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot,
    '--report', fixture.report
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return readFile(fixture.report, 'utf8');
}

async function assertPruneSourcesExist(imageRoot) {
  assert.equal(await pathExists(join(imageRoot, 'img', 'a.png')), true);
  assert.equal(await pathExists(join(imageRoot, 'img', 'b.png')), true);
}

test('confirmed prune deletes only from the reviewed bound plan and preserves its digest', async () => {
  const fixture = await createPruneFixture();
  const planned = JSON.parse(await writePrunePlan(fixture));

  const result = spawnSync(process.execPath, [
    CLI, 'prune', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot,
    '--report', fixture.report, '--confirm-prune'
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const completed = JSON.parse(await readFile(fixture.report, 'utf8'));
  assert.equal(completed.status, 'completed');
  assert.match(completed.planDigest, /^[0-9a-f]{64}$/u);
  assert.equal(completed.planDigest, planned.planDigest);
  assert.deepEqual(completed.deleted, ['img/a.png', 'img/b.png']);
  assert.equal(await pathExists(join(fixture.imageRoot, 'img', 'a.png')), false);
  assert.equal(await pathExists(join(fixture.imageRoot, 'img', 'b.png')), false);
});

test('confirmed prune rejects a changed HEAD without overwriting the reviewed plan', async () => {
  const fixture = await createPruneFixture();
  const reviewedPlan = await writePrunePlan(fixture);
  await writeFile(join(fixture.blogRoot, 'review-marker.txt'), 'changed head');
  commitChanges(fixture.blogRoot, 'change reviewed blog head');

  const result = spawnSync(process.execPath, [
    CLI, 'prune', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot,
    '--report', fixture.report, '--confirm-prune'
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /blogHead/u);
  assert.equal(await readFile(fixture.report, 'utf8'), reviewedPlan);
  await assertPruneSourcesExist(fixture.imageRoot);
});

test('confirmed prune rejects a changed manifest without deleting or overwriting the plan', async () => {
  const fixture = await createPruneFixture();
  const reviewedPlan = await writePrunePlan(fixture);
  const manifestPath = join(fixture.blogRoot, 'tools', 'image-pipeline', 'manifest.json');
  execFileSync('git', ['update-index', '--assume-unchanged', 'tools/image-pipeline/manifest.json'], {
    cwd: fixture.blogRoot
  });
  await writeFile(manifestPath, `${await readFile(manifestPath, 'utf8')}\n`);
  assert.equal(worktreeStatus(fixture.blogRoot), '');

  const result = spawnSync(process.execPath, [
    CLI, 'prune', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot,
    '--report', fixture.report, '--confirm-prune'
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /manifestSha256/u);
  assert.equal(await readFile(fixture.report, 'utf8'), reviewedPlan);
  await assertPruneSourcesExist(fixture.imageRoot);
});

test('confirmed prune rejects changed candidates without deleting or overwriting the plan', async () => {
  const fixture = await createPruneFixture();
  const reviewedPlan = await writePrunePlan(fixture);
  execFileSync('git', ['update-index', '--assume-unchanged', 'img/a.png'], { cwd: fixture.imageRoot });
  await writeFile(join(fixture.imageRoot, 'img', 'a.png'), 'a-source-bytes-changed');
  assert.equal(worktreeStatus(fixture.imageRoot), '');

  const result = spawnSync(process.execPath, [
    CLI, 'prune', '--blog-root', fixture.blogRoot, '--image-root', fixture.imageRoot,
    '--report', fixture.report, '--confirm-prune'
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /candidates|totalBytes|planDigest/u);
  assert.equal(await readFile(fixture.report, 'utf8'), reviewedPlan);
  await assertPruneSourcesExist(fixture.imageRoot);
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
