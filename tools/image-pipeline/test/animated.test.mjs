import test from 'node:test';
import assert from 'node:assert/strict';
import { totalAnimatedPixels } from '../animated.mjs';

test('computes total pixels from animated frame dimensions', () => {
  assert.equal(
    totalAnimatedPixels({ width: 854, height: 361440, pageHeight: 480, pages: 753 }),
    308669760
  );
  assert.equal(
    totalAnimatedPixels({ width: 854, height: 480, pages: 753 }),
    308669760
  );
});
