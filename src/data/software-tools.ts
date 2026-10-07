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
  { id: 'toolchain', label: '开发工具链' },
  { id: 'everyday', label: '日常效率' },
  { id: 'image', label: '图片处理' },
  { id: 'development', label: '开发与图表' },
  { id: 'research', label: '阅读与研究' }
] as const;

export type ToolCategory = (typeof SOFTWARE_TOOL_CATEGORIES)[number]['id'];

export interface SoftwareTool {
  name: string;
  purpose: string;
  description: string;
  href: string;
  icon: `/tool-icons/${string}`;
  tone: ToolTone;
  kind: ToolKind;
  category: ToolCategory;
}

export const SOFTWARE_TOOLS: readonly SoftwareTool[] = [
  { name: 'SolidWorks', purpose: '机械设计', description: '用于零件、装配体与工程图的三维机械设计', href: 'https://www.solidworks.com/', icon: '/tool-icons/solidworks.svg', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'Fusion 360', purpose: '建模制造', description: '集成 CAD、CAM 与仿真的云端产品设计平台', href: 'https://www.autodesk.com/products/fusion-360/overview', icon: '/tool-icons/fusion-360.png', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: 'Inventor', purpose: '机械建模', description: '面向机械工程的参数化三维设计与仿真', href: 'https://www.autodesk.com/products/inventor/overview', icon: '/tool-icons/inventor.png', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: 'Bambu Studio', purpose: '打印切片', description: '为 3D 打印机准备模型、切片与打印任务', href: 'https://bambulab.com/en/download/studio', icon: '/tool-icons/bambu-studio.svg', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'Altium Designer', purpose: 'PCB 设计', description: '绘制原理图、PCB 与生产文件的电子设计环境', href: 'https://www.altium.com/altium-designer', icon: '/tool-icons/altium-designer.png', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: '嘉立创 EDA', purpose: 'PCB 设计', description: '在线完成原理图与 PCB 设计并衔接打样', href: 'https://pro.lceda.cn/', icon: '/tool-icons/lceda.svg', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'KiCad', purpose: 'PCB 设计', description: '开源原理图与 PCB 设计套件', href: 'https://www.kicad.org/', icon: '/tool-icons/kicad.svg', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'OrCAD', purpose: '电路设计', description: '用于原理图、PCB 与电路仿真的 Cadence 设计工具', href: 'https://www.orcad.com/', icon: '/tool-icons/orcad.png', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: 'PADS', purpose: 'PCB 布线', description: '面向专业 PCB 设计与布局布线的工程工具', href: 'https://eda.sw.siemens.com/en-US/pcb/pads/', icon: '/tool-icons/pads.png', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: 'STM32CubeMX', purpose: '芯片配置', description: '配置 STM32 引脚、时钟和外设并生成初始化代码', href: 'https://www.st.com/en/development-tools/stm32cubemx.html', icon: '/tool-icons/stm32cubemx.png', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'Keil MDK', purpose: '固件开发', description: '编写、构建与调试基于 Arm 的嵌入式程序', href: 'https://www.keil.arm.com/', icon: '/tool-icons/keil-mdk.svg', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'Ozone', purpose: '嵌入调试', description: '配合 J-Link 调试与分析嵌入式程序', href: 'https://www.segger.com/products/development-tools/ozone-j-link-debugger/', icon: '/tool-icons/ozone.png', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: 'Arduino IDE', purpose: '单片机开发', description: '编写、编译和上传 Arduino 项目', href: 'https://www.arduino.cc/en/software/', icon: '/tool-icons/arduino-ide.svg', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'PlatformIO', purpose: '固件开发', description: '在统一环境中管理嵌入式项目、依赖与构建', href: 'https://platformio.org/', icon: '/tool-icons/platformio.svg', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: 'Vivado', purpose: 'FPGA 设计', description: '完成 AMD FPGA 的设计、综合、实现与调试', href: 'https://www.amd.com/en/products/software/adaptive-socs-and-fpgas/vivado.html', icon: '/tool-icons/vivado.png', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'Quartus Prime', purpose: 'FPGA 设计', description: '完成 Intel FPGA 的设计、编译、时序分析与下载', href: 'https://www.intel.com/content/www/us/en/software/programmable/quartus-prime/overview.html', icon: '/tool-icons/quartus-prime.png', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: 'PSIM', purpose: '电力仿真', description: '进行电力电子与控制系统电路仿真', href: 'https://powersimtech.com/psim/', icon: '/tool-icons/psim.png', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'Multisim', purpose: '电路仿真', description: '用交互式原理图完成电路设计与仿真', href: 'https://www.ni.com/en/shop/multisim.html', icon: '/tool-icons/multisim.svg', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: 'MATLAB', purpose: '数值仿真', description: '用于数值计算、数据分析与控制系统仿真', href: 'https://www.mathworks.com/products/matlab.html', icon: '/tool-icons/matlab.svg', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'Visual Studio Code', purpose: '代码编辑', description: '代码编辑与扩展开发环境', href: 'https://code.visualstudio.com/', icon: '/tool-icons/visual-studio-code.svg', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'Git', purpose: '版本管理', description: '在本地记录、比较与协作管理代码版本', href: 'https://git-scm.com/', icon: '/tool-icons/git.svg', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: 'SourceTree', purpose: '版本管理', description: '以图形界面管理 Git 与 Mercurial 仓库', href: 'https://www.sourcetreeapp.com/', icon: '/tool-icons/sourcetree.svg', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: 'CLion', purpose: 'C++ 开发', description: '用于 C 和 C++ 的跨平台集成开发环境', href: 'https://www.jetbrains.com/clion/', icon: '/tool-icons/clion.svg', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'PyCharm', purpose: 'Python 开发', description: '用于 Python 开发、调试和项目管理的 IDE', href: 'https://www.jetbrains.com/pycharm/', icon: '/tool-icons/pycharm.svg', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'Visual Studio', purpose: '桌面开发', description: '用于 .NET、C++ 与桌面应用开发的完整 IDE', href: 'https://visualstudio.microsoft.com/', icon: '/tool-icons/visual-studio.svg', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: 'Anaconda', purpose: '环境管理', description: '管理 Python 数据科学与机器学习环境', href: 'https://www.anaconda.com/download', icon: '/tool-icons/anaconda.svg', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'VMware Workstation', purpose: '虚拟机', description: '在桌面系统中创建和运行虚拟机', href: 'https://www.vmware.com/', icon: '/tool-icons/vmware-workstation.svg', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'Zotero', purpose: '文献管理', description: '收集、阅读和管理参考文献', href: 'https://www.zotero.org/', icon: '/tool-icons/zotero.svg', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: 'Typora', purpose: '文档写作', description: '以所见即所得方式编写和预览 Markdown', href: 'https://typora.io/', icon: '/tool-icons/typora.png', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: '向日葵', purpose: '远程桌面', description: '远程访问和协助另一台设备', href: 'https://sunlogin.oray.com/', icon: '/tool-icons/sunlogin.png', tone: 'amber', kind: 'software', category: 'toolchain' },
  { name: 'RustDesk', purpose: '远程桌面', description: '开源的跨平台远程桌面工具', href: 'https://rustdesk.com/', icon: '/tool-icons/rustdesk.svg', tone: 'green', kind: 'software', category: 'toolchain' },
  { name: 'VNC Viewer', purpose: '远程桌面', description: '通过 VNC 协议远程查看和控制桌面', href: 'https://www.realvnc.com/en/connect/download/viewer/', icon: '/tool-icons/vnc-viewer.png', tone: 'cyan', kind: 'software', category: 'toolchain' },
  { name: 'PicGo', purpose: '图床管理', description: '上传图片并管理图床链接的桌面工具', href: 'https://github.com/Molunerfinn/PicGo', icon: '/tool-icons/picgo.png', tone: 'violet', kind: 'software', category: 'toolchain' },
  { name: 'PowerToys', purpose: '效率工具', description: '补充窗口管理、批处理和快捷工具', href: 'https://github.com/microsoft/PowerToys/releases', icon: '/tool-icons/powertoys.png', tone: 'cyan', kind: 'software', category: 'everyday' },
  { name: 'Snipaste', purpose: '截图贴图', description: '截图、贴图和简单标注', href: 'https://www.snipaste.com/', icon: '/tool-icons/snipaste.png', tone: 'violet', kind: 'software', category: 'image' },
  { name: 'Everything', purpose: '文件搜索', description: '快速索引和搜索本地文件', href: 'https://www.voidtools.com/', icon: '/tool-icons/everything.png', tone: 'amber', kind: 'software', category: 'everyday' },
  { name: '7-Zip', purpose: '文件压缩', description: '压缩、解压和管理归档文件', href: 'https://www.7-zip.org/', icon: '/tool-icons/7zip.svg', tone: 'green', kind: 'software', category: 'everyday' },
  { name: '轻松传', purpose: '文件传输', description: '在不同设备间临时传输文件', href: 'https://easychuan.cn/', icon: '/tool-icons/easychuan.png', tone: 'cyan', kind: 'link', category: 'everyday' },
  { name: '幻觉翻译', purpose: '文本翻译', description: '翻译网页与长段文本', href: 'https://hjfy.top/', icon: '/tool-icons/hjfy.png', tone: 'violet', kind: 'link', category: 'research' },
  { name: 'remove.bg', purpose: '图片抠图', description: '自动去除图片背景', href: 'https://www.remove.bg/zh', icon: '/tool-icons/remove-bg.png', tone: 'green', kind: 'link', category: 'image' },
  { name: 'DeepWiki', purpose: '代码阅读', description: '阅读并检索开源代码仓库', href: 'https://deepwiki.org/', icon: '/tool-icons/deepwiki.png', tone: 'cyan', kind: 'link', category: 'development' },
  { name: 'Compiler Explorer', purpose: '编译分析', description: '在线查看代码的编译结果', href: 'https://godbolt.org/', icon: '/tool-icons/compiler-explorer.svg', tone: 'amber', kind: 'link', category: 'development' },
  { name: 'Google Scholar', purpose: '论文检索', description: '检索论文、作者和引用记录', href: 'https://scholar.google.com/', icon: '/tool-icons/google-scholar.svg', tone: 'amber', kind: 'link', category: 'research' },
  { name: 'Connected Papers', purpose: '文献图谱', description: '从一篇论文扩展相关文献图谱', href: 'https://www.connectedpapers.com/', icon: '/tool-icons/connected-papers.png', tone: 'cyan', kind: 'link', category: 'research' },
  { name: 'SimpleTex', purpose: '公式识别', description: '从图片识别 LaTeX 公式', href: 'https://www.simpletex.cn/ai/latex_ocr', icon: '/tool-icons/simpletex.ico', tone: 'violet', kind: 'link', category: 'research' },
  { name: 'Mermaid Chart', purpose: '绘制图表', description: '用文本绘制流程图和结构图', href: 'https://www.mermaidchart.com/', icon: '/tool-icons/mermaid-chart.svg', tone: 'green', kind: 'link', category: 'development' },
  { name: 'Adobe Color', purpose: '配色工具', description: '从图片取色并生成配色方案', href: 'https://color.adobe.com/zh/create/image', icon: '/tool-icons/adobe-color.svg', tone: 'amber', kind: 'link', category: 'image' }
];
