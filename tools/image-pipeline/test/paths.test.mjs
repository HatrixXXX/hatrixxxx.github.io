import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cdnUrl,
  decodeRepoPath,
  fullOutputPath,
  thumbnailOutputPath
} from '../paths.mjs';

test('normalizes encoded jsDelivr paths and keeps the source suffix', () => {
  const url = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/servlet%20(1).png';
  assert.equal(decodeRepoPath(url), 'img/servlet (1).png');
  assert.equal(fullOutputPath('img/UAV.jpg'), 'img/optimized/UAV.jpg.webp');
  assert.equal(thumbnailOutputPath('img/UAV.jpg'), 'img/thumbnails/UAV.jpg.webp');
  assert.equal(
    cdnUrl('img/thumbnails/微信图片.jpg.webp'),
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/thumbnails/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87.jpg.webp'
  );
});
