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
  icon: `/assets/tool-icons/${string}`;
  kind: ToolKind;
  category: ToolCategory;
}

export const SOFTWARE_TOOLS: readonly SoftwareTool[] = [
  { name: 'VS Code', purpose: '代码编辑', description: '编辑代码并通过扩展配置开发环境', href: 'https://code.visualstudio.com/', icon: '/assets/tool-icons/vs-code.png', kind: 'software', category: 'development' },
  { name: 'Git', purpose: '版本管理', description: '记录、比较和合并代码版本', href: 'https://git-scm.com/', icon: '/assets/tool-icons/git.png', kind: 'software', category: 'development' },
  { name: 'CC Switch', purpose: 'AI 配置切换', description: '管理并切换 Claude Code、Codex 等 AI 编程工具的服务配置', href: 'https://ccswitch.io/', icon: '/assets/tool-icons/cc-switch.png', kind: 'software', category: 'development' },
  { name: 'CLion', purpose: 'C/C++ 开发', description: '编写、调试 C/C++ 项目并管理构建', href: 'https://www.jetbrains.com/clion/', icon: '/assets/tool-icons/clion.svg', kind: 'software', category: 'development' },
  { name: 'Pycharm', purpose: 'Python 开发', description: '编写、运行和调试 Python 项目', href: 'https://www.jetbrains.com/pycharm/', icon: '/assets/tool-icons/pycharm.svg', kind: 'software', category: 'development' },
  { name: 'Anaconda', purpose: '环境管理', description: '管理 Python 环境和数据科学软件包', href: 'https://www.anaconda.com/download', icon: '/assets/tool-icons/anaconda.svg', kind: 'software', category: 'development' },
  { name: 'SolidWorks', purpose: '机械设计', description: '创建机械零件、装配体和工程图', href: 'https://www.solidworks.com/', icon: '/assets/tool-icons/solidworks.png', kind: 'software', category: 'toolchain' },
  { name: 'Blender', purpose: '三维创作', description: '进行三维建模、动画制作与渲染', href: 'https://www.blender.org/download/', icon: '/assets/tool-icons/blender.png', kind: 'software', category: 'image' },
  { name: 'Bamboo Studio', purpose: '打印切片', description: '为 Bambu Lab 3D 打印机准备模型与切片', href: 'https://bambulab.com/en/download/studio', icon: '/assets/tool-icons/bambu-studio.png', kind: 'software', category: 'toolchain' },
  { name: 'Altium Designer', purpose: 'PCB 设计', description: '绘制原理图、PCB 和生产文件', href: 'https://www.altium.com/altium-designer', icon: '/assets/tool-icons/altium-designer.ico', kind: 'software', category: 'toolchain' },
  { name: 'Kicad', purpose: 'PCB 设计', description: '设计原理图与印刷电路板', href: 'https://www.kicad.org/', icon: '/assets/tool-icons/kicad.ico', kind: 'software', category: 'toolchain' },
  { name: 'CubeMX', purpose: '芯片配置', description: '配置 STM32 引脚、时钟和外设并生成代码', href: 'https://www.st.com/en/development-tools/stm32cubemx.html', icon: '/assets/tool-icons/stm32cubemx.png', kind: 'software', category: 'toolchain' },
  { name: 'Keil', purpose: '固件开发', description: '编写、编译并调试 Arm 微控制器固件', href: 'https://www.keil.arm.com/', icon: '/assets/tool-icons/keil.png', kind: 'software', category: 'toolchain' },
  { name: 'Ozone', purpose: '嵌入调试', description: '使用 J-Link 调试嵌入式程序并分析性能', href: 'https://www.segger.com/products/development-tools/ozone-j-link-debugger/', icon: '/assets/tool-icons/ozone.png', kind: 'software', category: 'toolchain' },
  { name: 'Vivado', purpose: 'FPGA 设计', description: '设计、综合、实现并调试 AMD FPGA 项目', href: 'https://www.amd.com/en/products/software/adaptive-socs-and-fpgas/vivado.html', icon: '/assets/tool-icons/vivado.png', kind: 'software', category: 'toolchain' },
  { name: 'Quartus', purpose: 'FPGA 设计', description: '设计、综合并配置 Altera FPGA 项目', href: 'https://www.altera.com/products/development-tools/quartus', icon: '/assets/tool-icons/quartus.png', kind: 'software', category: 'toolchain' },
  { name: 'Matlab', purpose: '数值计算', description: '进行数值计算、数据分析和仿真', href: 'https://www.mathworks.com/products/matlab.html', icon: '/assets/tool-icons/matlab.png', kind: 'software', category: 'toolchain' },
  { name: 'Multisim', purpose: '电路仿真', description: '绘制电路并进行交互式仿真', href: 'https://www.ni.com/en/shop/multisim.html', icon: '/assets/tool-icons/multisim.png', kind: 'software', category: 'toolchain' },
  { name: 'MobaXterm', purpose: '远程终端', description: '通过 SSH、SFTP 与远程终端管理主机', href: 'https://mobaxterm.mobatek.net/', icon: '/assets/tool-icons/mobaxterm.png', kind: 'software', category: 'development' },
  { name: 'VMware', purpose: '虚拟机', description: '在桌面上创建、运行和管理虚拟机', href: 'https://www.vmware.com/products/desktop-hypervisor/workstation-and-fusion', icon: '/assets/tool-icons/vmware.svg', kind: 'software', category: 'toolchain' },
  { name: 'Acrobat DC', purpose: 'PDF 处理', description: '查看、编辑、标注和导出 PDF', href: 'https://www.adobe.com/acrobat/acrobat-pro.html', icon: '/assets/tool-icons/adobe-acrobat.ico', kind: 'software', category: 'everyday' },
  { name: 'Adobe Illustrator', purpose: '矢量绘图', description: '绘制可缩放的矢量图形与版面素材', href: 'https://www.adobe.com/products/illustrator.html', icon: '/assets/tool-icons/adobe-illustrator.png', kind: 'software', category: 'image' },
  { name: 'Adobe Media Encoder', purpose: '视频转码', description: '将视频、音频导出并转码为交付格式', href: 'https://www.adobe.com/products/media-encoder.html', icon: '/assets/tool-icons/adobe-media-encoder.png', kind: 'software', category: 'image' },
  { name: 'Adobe Photoshop', purpose: '图像编辑', description: '编辑照片、图像与合成素材', href: 'https://www.adobe.com/products/photoshop.html', icon: '/assets/tool-icons/adobe-photoshop.png', kind: 'software', category: 'image' },
  { name: 'Adobe Premiere Pro', purpose: '视频剪辑', description: '剪辑视频并处理音视频轨道', href: 'https://www.adobe.com/products/premiere.html', icon: '/assets/tool-icons/adobe-premiere-pro.svg', kind: 'software', category: 'image' },
  { name: 'Everything', purpose: '文件搜索', description: '快速索引和搜索本地文件', href: 'https://www.voidtools.com/', icon: '/assets/tool-icons/everything.png', kind: 'software', category: 'everyday' },
  { name: 'Honeyview', purpose: '图片浏览', description: '浏览图片、动画与压缩包内图像', href: 'https://www.bandisoft.com/honeyview/', icon: '/assets/tool-icons/honeyview.png', kind: 'software', category: 'image' },
  { name: 'Potplayer', purpose: '媒体播放', description: '播放本地视频和音频并调整字幕', href: 'https://potplayer.daum.net/', icon: '/assets/tool-icons/potplayer.png', kind: 'software', category: 'image' },
  { name: 'Typora', purpose: '文档写作', description: '在所见即所得视图中编写 Markdown', href: 'https://typora.io/', icon: '/assets/tool-icons/typora.png', kind: 'software', category: 'everyday' },
  { name: 'Zotero', purpose: '文献管理', description: '收集、整理、阅读和引用学术文献', href: 'https://www.zotero.org/', icon: '/assets/tool-icons/zotero.png', kind: 'software', category: 'research' },
  { name: 'PicGo', purpose: '图床管理', description: '上传图片并管理图床地址', href: 'https://github.com/Molunerfinn/PicGo', icon: '/assets/tool-icons/picgo.png', kind: 'software', category: 'image' },
  { name: 'Q-dir', purpose: '文件管理', description: '在四窗格文件管理界面中整理文件', href: 'https://www.softwareok.com/?seite=Freeware/Q-Dir', icon: '/assets/tool-icons/q-dir.png', kind: 'software', category: 'everyday' },
  { name: '7-zip', purpose: '文件压缩', description: '压缩、解压并管理归档文件', href: 'https://www.7-zip.org/', icon: '/assets/tool-icons/7zip.svg', kind: 'software', category: 'everyday' },
  { name: 'Geek', purpose: '软件卸载', description: '卸载 Windows 软件并清理残留项', href: 'https://geekuninstaller.com/', icon: '/assets/tool-icons/geek.png', kind: 'software', category: 'everyday' },
  { name: 'Snipaste', purpose: '截图贴图', description: '截图、标注并将图片贴在桌面', href: 'https://www.snipaste.com/', icon: '/assets/tool-icons/snipaste.png', kind: 'software', category: 'image' },
  { name: 'Bandicam', purpose: '屏幕录制', description: '录制屏幕、游戏或外接视频设备', href: 'https://www.bandicam.com/', icon: '/assets/tool-icons/bandicam.png', kind: 'software', category: 'image' },
  { name: 'DiskGenius', purpose: '磁盘管理', description: '管理磁盘分区、备份和恢复数据', href: 'https://www.diskgenius.com/', icon: '/assets/tool-icons/diskgenius.png', kind: 'software', category: 'everyday' },
  { name: 'Spacesniffer', purpose: '空间分析', description: '用空间树图查看磁盘占用', href: 'https://www.uderzo.it/main_products/space_sniffer/', icon: '/assets/tool-icons/spacesniffer.png', kind: 'software', category: 'everyday' },
  { name: 'CPU-Z', purpose: '硬件信息', description: '查看处理器、主板、内存与实时频率等硬件信息', href: 'https://www.cpuid.com/softwares/cpu-z.html', icon: '/assets/tool-icons/cpu-z.svg', kind: 'software', category: 'everyday' },
  { name: 'ContextMenuManager', purpose: '右键菜单', description: '启用、禁用和整理 Windows 右键菜单项', href: 'https://github.com/BluePointLilac/ContextMenuManager', icon: '/assets/tool-icons/contextmenumanager.png', kind: 'software', category: 'everyday' }
];
