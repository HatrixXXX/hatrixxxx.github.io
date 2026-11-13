export const postPath = (legacySlug: string) => `/posts/${legacySlug}/`;

export const previousPostSlugs: Readonly<Record<string, string>> = {
  数字电路基础: '数字集成电路设计方法学',
  验证方法学与框架: '验证方法学',
  Verilog语法: '硬件描述语言-Verilog',
  SystemVerilog语法: '硬件描述语言-SystemVerilog'
};
