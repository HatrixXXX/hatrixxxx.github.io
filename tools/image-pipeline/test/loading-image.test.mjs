import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('coffee loader is small, preloaded and high priority', async () => {
  const head = await readFile('_includes/head.html', 'utf8');
  const layout = await readFile('_layouts/default.html', 'utf8');
  const image = await stat('assets/img/coffee.webp');
  assert.ok(image.size < 70 * 1024, `coffee.webp is ${image.size} bytes`);
  assert.match(head, /rel="preload"[^>]+href="\/assets\/img\/coffee\.webp"[^>]+type="image\/webp"/u);
  assert.match(layout, /<source srcset="\/assets\/img\/coffee\.webp" type="image\/webp">/u);
  assert.match(layout, /fetchpriority="high"/u);
  assert.match(layout, /width="500" height="500"/u);
  assert.match(layout, /cake\.png[^>]+loading="lazy"[^>]+fetchpriority="low"/u);
});
