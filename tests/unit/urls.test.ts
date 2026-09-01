import { expect, it } from 'vitest';
import { categoryPath, postPath, tagPath } from '../../src/lib/urls';

it('preserves the legacy Chinese post route', () => {
  expect(postPath('FPGA开发(3)AXI协议')).toBe('/posts/FPGA开发(3)AXI协议/');
});

it('encodes taxonomy route segments while retaining their meaning', () => {
  expect(categoryPath('AI 与图形计算')).toBe('/categories/AI%20%E4%B8%8E%E5%9B%BE%E5%BD%A2%E8%AE%A1%E7%AE%97/');
  expect(tagPath('C++/FPGA')).toBe('/tags/C%2B%2B%2FFPGA/');
});
