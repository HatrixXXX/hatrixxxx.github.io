import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { stampPublishedImageCommit } from '../manifest.mjs';

function commitFixture(root, message) {
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', message], { cwd: root });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

async function createFixture() {
  const imageRoot = await mkdtemp(join(tmpdir(), 'hatrix-stamp-'));
  execFileSync('git', ['init', '--quiet'], { cwd: imageRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: imageRoot });
  execFileSync('git', ['config', 'user.name', 'Image Pipeline Test'], { cwd: imageRoot });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: imageRoot });
  await writeFile(join(imageRoot, '.gitkeep'), '');
  const sourceCommit = commitFixture(imageRoot, 'source');
  const outputPath = 'img/optimized/cover.png.webp';
  await mkdir(join(imageRoot, 'img', 'optimized'), { recursive: true });
  await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .webp().toFile(join(imageRoot, outputPath));
  const outputBytes = (await stat(join(imageRoot, outputPath))).size;
  const publishedCommit = commitFixture(imageRoot, 'outputs');
  const manifest = {
    schemaVersion: 3,
    generatedAt: '2026-09-02T00:00:00.000Z',
    blogCommit: null,
    sourceImageCommit: sourceCommit,
    publishedImageCommit: null,
    entries: [{
      sourcePath: 'img/cover.png',
      sourceBytes: 1,
      source: { format: 'png', width: 2, height: 2, pages: 1 },
      references: [],
      full: {
        adopted: true,
        path: outputPath,
        url: `https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/${outputPath}`,
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
        url: 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/thumbnails/cover.png.webp',
        outputBytes: null,
        reason: 'not-published-cover'
      }
    }]
  };
  return { imageRoot, manifest, outputPath, publishedCommit, sourceCommit };
}

test('stamps the resolved commit after validating every adopted output', async () => {
  const { imageRoot, manifest, publishedCommit } = await createFixture();

  const stamped = await stampPublishedImageCommit(manifest, imageRoot, publishedCommit);

  assert.equal(stamped.publishedImageCommit, publishedCommit);
  assert.equal(manifest.publishedImageCommit, null);
});

test('rejects a missing image commit', async () => {
  const { imageRoot, manifest } = await createFixture();

  await assert.rejects(
    stampPublishedImageCommit(manifest, imageRoot, ''),
    /image commit is required/u
  );
});

test('rejects schema v1 with an ambiguous imageCommit field', async () => {
  const { imageRoot, manifest, publishedCommit } = await createFixture();
  const legacyManifest = {
    ...manifest,
    schemaVersion: 1,
    imageCommit: manifest.sourceImageCommit
  };
  delete legacyManifest.sourceImageCommit;
  delete legacyManifest.publishedImageCommit;

  await assert.rejects(
    stampPublishedImageCommit(legacyManifest, imageRoot, publishedCommit),
    /manifest schemaVersion must be 3/u
  );
});

test('rejects a commit that does not contain an adopted output', async () => {
  const { imageRoot, manifest, outputPath, sourceCommit } = await createFixture();

  await assert.rejects(
    stampPublishedImageCommit(manifest, imageRoot, sourceCommit),
    new RegExp(`adopted output is missing from image commit: ${outputPath}`, 'u')
  );
});

test('rejects a committed blob that differs from the working output', async () => {
  const { imageRoot, manifest, outputPath, publishedCommit } = await createFixture();
  const changed = await readFile(join(imageRoot, outputPath));
  changed[changed.length - 1] ^= 1;
  await writeFile(join(imageRoot, outputPath), changed);

  await assert.rejects(
    stampPublishedImageCommit(manifest, imageRoot, publishedCommit),
    new RegExp(`committed output does not match working file: ${outputPath}`, 'u')
  );
});
