import type { PostCategory } from '../../src/types/content';

export interface Classification {
  category: PostCategory;
  tags: string[];
}

export interface SeriesInfo {
  name: string;
  order: number;
}

const CATEGORY_RULES: Array<[PostCategory, RegExp]> = [
  ['FPGA 与数字系统', /Verilog|FPGA|PGA开发|ZYNQ|AXI|数字集成电路/i],
  ['嵌入式与硬件', /STM32|嵌入式|通讯协议|旋翼|标准件|RLC|CMOS|灵巧手|FOC|画板子|PCB/i],
  ['AI 与图形计算', /3DGS|GEMM|AI加速器|加速器芯片|CUDA|光栅化/i],
  ['软件工程与工具', /ROS2|设计模式|Docker|Bash|Linux|git|github|工具箱/i],
  ['数学与基础', /数学|计算机组成/i]
];

const TAG_RULES: Array<[string, RegExp]> = [
  ['Verilog', /Verilog/i],
  ['Vivado', /Vivado/i],
  ['Vitis', /Vitis/i],
  ['FPGA', /FPGA|PGA开发|ZYNQ|AXI|Verilog|数字集成电路/i],
  ['Zynq', /ZYNQ/i],
  ['AXI', /AXI/i],
  ['STM32', /STM32/i],
  ['嵌入式', /嵌入式|通讯协议/i],
  ['硬件', /旋翼|标准件|RLC|CMOS|画板子|FOC/i],
  ['3DGS', /3DGS/i],
  ['CUDA', /CUDA|GEMM|3DGS/i],
  ['AI 加速器', /AI加速器|加速器芯片/i],
  ['ROS 2', /ROS2/i],
  ['Docker', /Docker/i],
  ['Linux', /Linux|Bash/i],
  ['Git', /git|github/i],
  ['数学', /数学/i],
  ['博客', /博客搭建/i],
  ['资源整理', /工具箱|杂货铺/i]
];

const SERIES_RULES: Array<[string, RegExp]> = [
  ['CMOS 系列', /^CMOS系列\((\d+)\)/],
  ['3DGS 前向渲染', /^3DGS前向渲染\((\d+)\)/],
  ['Verilog', /^Verilog\((\d+)\)/],
  ['FPGA 开发', /^FPGA开发\((\d+)\)/],
  ['画板子系列', /^画板子系列\((\d+)\)/]
];

export function classifyPost(title: string): Classification {
  const category = CATEGORY_RULES.find(([, rule]) => rule.test(title))?.[0] ?? '随笔与资源';
  const tags = TAG_RULES.filter(([, rule]) => rule.test(title)).map(([tag]) => tag);

  return { category, tags: [...new Set(tags)] };
}

export function seriesFor(title: string): SeriesInfo | undefined {
  for (const [name, rule] of SERIES_RULES) {
    const match = title.match(rule);
    if (match) return { name, order: Number(match[1]) };
  }
}
