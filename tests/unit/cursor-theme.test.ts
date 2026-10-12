import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const cursorDir = resolve(projectRoot, 'public/assets/cursors');
const globalStyles = readFileSync(resolve(projectRoot, 'src/styles/global.css'), 'utf8');

it('ships the custom cursor assets and maps common interaction states', () => {
  for (const asset of ['pointer.cur', 'link.cur', 'text.cur', 'move.cur', 'unavailable.cur', 'busy.ani']) {
    expect(existsSync(resolve(cursorDir, asset)), `${asset} should be published`).toBe(true);
  }

  expect(globalStyles).toContain("url('/assets/cursors/pointer.cur')");
  expect(globalStyles).toContain("image-set(url('/assets/cursors/pointer.cur') 2x)");
  expect(globalStyles).toContain("url('/assets/cursors/link.cur')");
  expect(globalStyles).toContain("image-set(url('/assets/cursors/link.cur') 2x)");
  expect(globalStyles).toContain("url('/assets/cursors/text.cur')");
  expect(globalStyles).toContain("image-set(url('/assets/cursors/text.cur') 2x)");
  expect(globalStyles).toContain("url('/assets/cursors/move.cur')");
  expect(globalStyles).toContain("image-set(url('/assets/cursors/move.cur') 2x)");
});
