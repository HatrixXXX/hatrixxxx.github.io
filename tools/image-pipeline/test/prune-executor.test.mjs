import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executePruneDeletion } from '../prune-executor.mjs';

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

test('records partial progress when a confirmed prune deletion fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-prune-failure-'));
  const imageRoot = join(root, 'images');
  const report = join(root, 'reports', 'prune.json');
  const first = join(imageRoot, 'img', 'a.png');
  const second = join(imageRoot, 'img', 'b.png');
  await mkdir(join(imageRoot, 'img'), { recursive: true });
  await writeFile(first, 'a');
  await writeFile(second, 'b');

  const reviewed = {
    schemaVersion: 2,
    mode: 'dry-run',
    status: 'planned',
    planDigest: 'a'.repeat(64)
  };
  let attempts = 0;
  const remove = async (path) => {
    attempts += 1;
    if (attempts === 2) {
      const error = new Error('simulated locked file');
      error.code = 'EBUSY';
      throw error;
    }
    await unlink(path);
  };

  await assert.rejects(
    executePruneDeletion(reviewed, [
      { path: 'img/a.png', absolute: first },
      { path: 'img/b.png', absolute: second }
    ], report, { remove }),
    { code: 'EBUSY' }
  );

  const failed = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(failed.status, 'failed');
  assert.equal(failed.planDigest, reviewed.planDigest);
  assert.deepEqual(failed.deleted, ['img/a.png']);
  assert.equal(failed.failedPath, 'img/b.png');
  assert.equal(failed.error, 'simulated locked file');
  assert.equal(await pathExists(first), false);
  assert.equal(await pathExists(second), true);
});
