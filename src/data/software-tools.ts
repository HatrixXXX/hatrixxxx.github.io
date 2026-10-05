export type ToolIconName =
  | 'transfer'
  | 'translate'
  | 'cutout'
  | 'code'
  | 'book'
  | 'search'
  | 'network'
  | 'palette'
  | 'chart'
  | 'utility'
  | 'capture'
  | 'archive';

export type ToolTone = 'amber' | 'cyan' | 'violet' | 'green';
export type ToolKind = 'software' | 'link';

export const SOFTWARE_TOOL_CATEGORIES = [
  { id: 'everyday', label: '日常效率' },
  { id: 'image', label: '图片处理' },
  { id: 'development', label: '开发与图表' },
  { id: 'research', label: '阅读与研究' }
] as const;

export type ToolCategory = (typeof SOFTWARE_TOOL_CATEGORIES)[number]['id'];

export interface SoftwareTool {
  name: string;
  description: string;
  href: string;
  icon: ToolIconName;
  tone: ToolTone;
  kind: ToolKind;
  category: ToolCategory;
}

export const SOFTWARE_TOOLS: readonly SoftwareTool[] = [
  { name: 'PowerToys', description: '补充窗口管理、批处理和快捷工具', href: 'https://github.com/microsoft/PowerToys/releases', icon: 'utility', tone: 'cyan', kind: 'software', category: 'everyday' },
  { name: 'Snipaste', description: '截图、贴图和简单标注', href: 'https://www.snipaste.com/', icon: 'capture', tone: 'violet', kind: 'software', category: 'image' },
  { name: 'Everything', description: '快速索引和搜索本地文件', href: 'https://www.voidtools.com/', icon: 'search', tone: 'amber', kind: 'software', category: 'everyday' },
  { name: '7-Zip', description: '压缩、解压和管理归档文件', href: 'https://www.7-zip.org/', icon: 'archive', tone: 'green', kind: 'software', category: 'everyday' },
  { name: 'Visual Studio Code', description: '代码编辑与扩展开发环境', href: 'https://code.visualstudio.com/', icon: 'code', tone: 'cyan', kind: 'software', category: 'development' },
  { name: 'Zotero', description: '收集、阅读和管理参考文献', href: 'https://www.zotero.org/', icon: 'book', tone: 'amber', kind: 'software', category: 'research' },
  { name: '轻松传', description: '在不同设备间临时传输文件', href: 'https://easychuan.cn/', icon: 'transfer', tone: 'cyan', kind: 'link', category: 'everyday' },
  { name: '幻觉翻译', description: '翻译网页与长段文本', href: 'https://hjfy.top/', icon: 'translate', tone: 'violet', kind: 'link', category: 'research' },
  { name: 'remove.bg', description: '自动去除图片背景', href: 'https://www.remove.bg/zh', icon: 'cutout', tone: 'green', kind: 'link', category: 'image' },
  { name: 'DeepWiki', description: '阅读并检索开源代码仓库', href: 'https://deepwiki.org/', icon: 'book', tone: 'cyan', kind: 'link', category: 'development' },
  { name: 'Compiler Explorer', description: '在线查看代码的编译结果', href: 'https://godbolt.org/', icon: 'code', tone: 'amber', kind: 'link', category: 'development' },
  { name: 'Google Scholar', description: '检索论文、作者和引用记录', href: 'https://scholar.google.com/', icon: 'search', tone: 'amber', kind: 'link', category: 'research' },
  { name: 'Connected Papers', description: '从一篇论文扩展相关文献图谱', href: 'https://www.connectedpapers.com/', icon: 'network', tone: 'cyan', kind: 'link', category: 'research' },
  { name: 'SimpleTex', description: '从图片识别 LaTeX 公式', href: 'https://www.simpletex.cn/ai/latex_ocr', icon: 'translate', tone: 'violet', kind: 'link', category: 'research' },
  { name: 'Mermaid Chart', description: '用文本绘制流程图和结构图', href: 'https://www.mermaidchart.com/', icon: 'chart', tone: 'green', kind: 'link', category: 'development' },
  { name: 'Adobe Color', description: '从图片取色并生成配色方案', href: 'https://color.adobe.com/zh/create/image', icon: 'palette', tone: 'amber', kind: 'link', category: 'image' }
];
