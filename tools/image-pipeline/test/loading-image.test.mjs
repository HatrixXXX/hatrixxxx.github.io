import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('coffee loader is small, preloaded and high priority', async () => {
  const head = await readFile('_includes/head.html', 'utf8');
  const layout = await readFile('_layouts/default.html', 'utf8');
  const image = await stat('assets/img/coffee.webp');
  const coffeeFallback = layout.match(/<img\s+src="\/assets\/img\/coffee\.png"[\s\S]*?>/u);
  assert.ok(image.size < 70 * 1024, `coffee.webp is ${image.size} bytes`);
  assert.match(head, /rel="preload"[^>]+href="\/assets\/img\/coffee\.webp"[^>]+type="image\/webp"/u);
  assert.match(layout, /<source srcset="\/assets\/img\/coffee\.webp" type="image\/webp">/u);
  assert.ok(coffeeFallback, 'coffee PNG fallback image is missing');
  assert.match(coffeeFallback[0], /src="\/assets\/img\/coffee\.png"/u);
  assert.match(coffeeFallback[0], /width="500"/u);
  assert.match(coffeeFallback[0], /height="500"/u);
  assert.match(coffeeFallback[0], /loading="eager"/u);
  assert.match(coffeeFallback[0], /fetchpriority="high"/u);
  assert.match(layout, /cake\.png[^>]+loading="lazy"[^>]+fetchpriority="low"/u);
});

test('loader keeps a valid main document scaffold', async () => {
  const layout = await readFile('_layouts/default.html', 'utf8');
  const count = (pattern) => layout.match(pattern)?.length ?? 0;

  assert.match(
    layout,
    /<body>[\s\S]*<div class="loading-container"[^>]*>[\s\S]*<div class="main-container" style="display: none">/u
  );
  assert.equal(count(/<body(?:\s[^>]*)?>/gu), 1);
  assert.equal(count(/<\/body>/gu), 1);
  assert.equal(count(/<\/html>/gu), 1);
  assert.doesNotMatch(layout, /<\/script>\/body>/u);
  assert.match(
    layout,
    /<script src="\/assets\/js\/loading-animation\.js"><\/script>\s*<\/body>\s*<\/html>\s*$/u
  );
});
