import { expect, it } from 'vitest';
import { postPath } from '../../src/lib/urls';

it('preserves the legacy Chinese post route', () => {
  expect(postPath('FPGA开发(3)AXI协议')).toBe('/posts/FPGA开发(3)AXI协议/');
});

