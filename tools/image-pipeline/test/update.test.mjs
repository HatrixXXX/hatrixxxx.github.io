import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReferenceMap, upsertThumbnail } from '../update.mjs';

test('rewrites exact URLs and adds thumbnail without reformatting frontmatter', () => {
  const oldUrl = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/UAV.jpg';
  const full = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/optimized/UAV.jpg.webp';
  const thumb = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/thumbnails/UAV.jpg.webp';
  const source = `---\ntitle: UAV\nimage:\n  path: ${oldUrl}\n---\n![](${oldUrl})\n`;
  const rewritten = applyReferenceMap(source, new Map([[oldUrl, full]]));
  assert.equal(upsertThumbnail(rewritten, full, thumb), `---\ntitle: UAV\nimage:\n  path: ${full}\n  thumbnail: ${thumb}\n---\n![](${full})\n`);
});
