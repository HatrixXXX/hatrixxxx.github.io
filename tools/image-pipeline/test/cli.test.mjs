import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
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
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: root });
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
