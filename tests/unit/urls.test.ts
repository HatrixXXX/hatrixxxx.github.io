import { expect, it } from 'vitest';
import { postPath } from '../../src/lib/urls';

it('builds the current Chinese post route', () => {
  expect(postPath('Xilinx FPGA开发')).toBe('/posts/Xilinx FPGA开发/');
});
