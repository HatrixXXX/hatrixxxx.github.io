import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('home prefers a thumbnail while retaining the full cover', async () => {
  const home = await readFile('_layouts/home.html', 'utf8');
  assert.match(home, /post\.image\.thumbnail\s*\|\s*default:\s*post\.image\.path/u);
});
