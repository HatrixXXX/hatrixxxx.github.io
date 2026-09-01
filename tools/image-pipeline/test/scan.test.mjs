import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanReferences } from '../scan.mjs';

test('finds frontmatter, HTML and angle-wrapped Markdown URLs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-scan-'));
  await mkdir(join(root, '_posts'));
  await writeFile(join(root, '_posts', 'x.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/UAV.jpg\n---\n![](<https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/servlet%20(1).png>)\n<img src="https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/math.png">\n`);
  const refs = await scanReferences(root);
  assert.deepEqual(refs.map((item) => item.repoPath), [
    'img/UAV.jpg', 'img/servlet (1).png', 'img/math.png'
  ]);
  assert.deepEqual(refs.map((item) => item.line), [3, 5, 6]);
  assert.deepEqual(refs.map((item) => item.kind), ['cover', 'inline', 'inline']);
  assert.ok(refs.every((item) => item.scope === 'published'));
});

test('distinguishes a frontmatter thumbnail from inline references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-scan-thumbnail-'));
  await mkdir(join(root, '_posts'));
  await writeFile(join(root, '_posts', 'x.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/full.webp\n  thumbnail: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/thumb.webp\n---\n`);

  const refs = await scanReferences(root);

  assert.deepEqual(refs.map(({ kind }) => kind), ['cover', 'thumbnail']);
});
