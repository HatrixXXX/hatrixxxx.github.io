import { describe, expect, it } from 'vitest';
import { classifyPost, seriesFor } from '../../scripts/migration/classify-post';

describe('post classification', () => {
  it.each([
    ['FPGA开发(3)AXI协议', 'FPGA 与数字系统'],
    ['旋翼飞行器硬件选型', '嵌入式与硬件'],
    ['3DGS前向渲染(2)CUDA光栅化', 'AI 与图形计算'],
    ['Docker简介', '软件工程与工具'],
    ['本科数学大杂烩', '数学与基础'],
    ['杂货铺', '随笔与资源']
  ])('%s -> %s', (title, category) => {
    expect(classifyPost(title).category).toBe(category);
  });

  it('extracts numbered series order', () => {
    expect(seriesFor('画板子系列(2)个人规范')).toEqual({ name: '画板子系列', order: 2 });
  });

  it.each([
    ['设计模式简介', '设计模式'],
    ['计算机组成结构', '计算机组成']
  ])('assigns %s a precise tag', (title, tag) => {
    expect(classifyPost(title).tags).toContain(tag);
  });
});
