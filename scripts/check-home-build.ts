import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const cards = [...html.matchAll(/<article data-post-card\b[\s\S]*?<\/article>/g)].map(
  ([card]) => card
);

assert.equal(cards.length, 6, 'built home page must contain six post cards');

for (const card of cards) {
  assert.doesNotMatch(
    card,
    /src="https:\/\/cdn\.jsdelivr\.net\//,
    'post covers must not retain raw jsDelivr src URLs'
  );
  assert.match(card, /src="\/_astro\/[^" ]+\.webp"/, 'post covers must use processed assets');
  assert.match(card, /srcset="[^"]+"/, 'post covers must provide a responsive srcset');
  assert.match(card, /sizes="[^"]+"/, 'post covers must provide responsive sizes');
}

console.log('Built home post covers use processed responsive assets.');
