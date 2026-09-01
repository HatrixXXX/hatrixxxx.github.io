import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('home prefers a thumbnail while retaining the full cover', async () => {
  const home = await readFile('_layouts/home.html', 'utf8');
  assert.match(
    home,
    /\{%\s*assign\s+src\s*=\s*post\.image\.thumbnail\s*\|\s*default:\s*post\.image\.path\s*\|\s*default:\s*post\.image\s*%\}/u
  );
  assert.match(home, /\{%\s*assign\s+alt\s*=\s*post\.image\.alt\s*\|\s*xml_escape\s*\|\s*default:\s*'Preview Image'\s*%\}/u);
  assert.match(home, /\{%\s*if\s+post\.image\.lqip\s*%\}[\s\S]*?\{%\s*capture\s+lqip\s*%\}lqip="\{\{\s*post\.image\.lqip\s*\}\}"\{%\s*endcapture\s*%\}/u);
  assert.ok(home.includes('<div class="col-md-5">'), 'preview image wrapper should remain present');
  assert.ok(home.includes('<img src="{{ src }}" alt="{{ alt }}" {{ lqip }}>'), 'preview image should retain src, alt, and LQIP wiring');
});
