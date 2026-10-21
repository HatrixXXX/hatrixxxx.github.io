import { describe, expect, it } from 'vitest';
import { previewDescription } from '../../src/lib/project-showcase';

describe('project introduction', () => {
  it('keeps a short description intact and limits a long one to 100 characters', () => {
    expect(previewDescription('项目介绍待补充。')).toBe('项目介绍待补充。');
    const preview = previewDescription('项'.repeat(101));
    expect(Array.from(preview)).toHaveLength(100);
    expect(preview.endsWith('…')).toBe(true);
  });
});
