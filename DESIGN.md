---
name: Hatrix · 留频街
description: 工坊场景中的个人记录站，外围保留设备材质，正文保持清楚。
colors:
  bg: "#17151d"
  surface: "#211e29"
  surface-raised: "#2c2735"
  inset: "#19161f"
  text: "#e9e4dc"
  heading: "#f5f0e8"
  muted: "#b9b0c2"
  accent: "#f3bb62"
  accent-strong: "#ffd28c"
  accent-soft: "rgb(243 187 98 / 10%)"
  on-accent: "#241c13"
  link: "#84d4c6"
  copper: "#b58c65"
  line: "rgb(190 174 204 / 18%)"
  line-strong: "#655770"
  light-bg: "#f0ece4"
  light-surface: "#faf8f3"
  light-surface-raised: "#e8e2d8"
  light-inset: "#e5ded4"
  light-text: "#322d38"
  light-heading: "#322d38"
  light-muted: "#655a6b"
  light-accent: "#755226"
  light-accent-strong: "#543815"
  light-accent-soft: "rgb(117 82 38 / 8%)"
  light-on-accent: "#faf8f3"
  light-link: "#266f69"
  light-copper: "#856143"
  light-line: "rgb(84 65 94 / 18%)"
  light-line-strong: "#a699ac"
typography:
  display:
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 5vw, 3.2rem)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: ".02em"
  title:
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "clamp(1.3rem, 2.2vw, 1.8rem)"
    fontWeight: 650
    lineHeight: 1.35
  body:
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.7
  reading:
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "1.0625rem"
    lineHeight: 1.85
  label:
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
  data:
    fontFamily: "'IBM Plex Mono', Consolas, monospace"
  code:
    fontFamily: "'IBM Plex Mono', Consolas, 'SFMono-Regular', Menlo, monospace"
    fontSize: "0.9em"
rounded:
  control: "5px"
  card: "8px"
spacing:
  navigation-link: "0.65rem 0.8rem"
  search-field: "0 0.8rem"
  search-input: "0.9rem 0"
  post-card: "1.35rem"
  post-card-mobile: "1.25rem"
  primary-button: "0.75rem 1rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "{spacing.primary-button}"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.on-accent}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "44px"
  button-back:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    width: "2.75rem"
    height: "2.75rem"
  input-search:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "{spacing.search-field}"
  navigation-link:
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "{spacing.navigation-link}"
  navigation-link-current:
    textColor: "{colors.accent}"
  card-post:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.heading}"
    rounded: "{rounded.card}"
    padding: "{spacing.post-card}"
  pagination-current:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
---

# Design System: Hatrix · 留频街

## Overview

**Creative North Star: "留频街的协作工作台"**

头盔人物、AI 侧脸和计算基板建立首页的主题。深色机壳、旧白面板与铜色接缝延续到内容页；文章区域保持平直、清楚，材质停留在外框和控件边缘。

文档记录本轮已实现的样式，不改变现有布局。颜色与共用尺寸来自 `src/styles/tokens.css`，字号和组件状态来自实际 Astro/CSS 文件。前置 token 是抽取快照，修改系统时先改代码，再同步本文与 `.impeccable/design.json`。

**Key Characteristics:**

- 深浅主题表达同一组面板与接缝，浅色采用漆面和纸张的明暗关系。
- 琥珀标出操作与焦点，青色标出正文链接，铜色用于边缘和连接。
- 中文系统无衬线承担阅读，等宽字体承担代码和参数。
- 场景细节集中在首页和 Hero，正文不叠颗粒、划痕或装饰性发光。

## Colors

上方色值按现有 CSS 名称记录。无前缀键对应默认深色主题；`light-` 键对应 `:root[data-theme='light']` 覆盖值。组件使用语义变量，在两种主题间切换，不在组件内另建第二套常规配色。

### Primary

琥珀 `accent` 用于主要操作、键盘焦点和当前项。`accent-strong` 是明确的悬停反馈，`accent-soft` 提供低强度选中背景，`on-accent` 保证实色按钮上的文字可读。浅色主题采用深琥珀。

### Secondary

青色 `link` 用于正文链接和文章标题的悬停反馈。正文链接保留下划线，不仅通过色相表明可点击。

### Tertiary

铜色 `copper` 用于边缘、引用线和部分控件的状态边框。它不承担所有文本强调。

### Neutral

`bg` 是页面底，`surface` 是常规面板，`surface-raised` 是抬高区域，`inset` 是输入槽和引用底。标题、正文和辅助信息分别使用 `heading`、`text` 和 `muted`。`line` 与 `line-strong` 区分静态接缝和交互边界。

首页保留 `src/pages/index.astro` 中已有的局部场景色，包括旧白博客面板、青灰工具区与辉光管；这些值不推广为常规内容组件 token。Hero 在工坊图片上维持深遮罩和浅字，两种主题都沿用该组合。

**The Semantic Color Rule.** 常规组件引用语义颜色变量；浅色模式通过主题覆盖替换色值，不能把深色主题的浅字直接放到浅面板上。

## Typography

中文正文采用 `--font-body` 的系统字体栈。`--font-data` 用于需要辨认字符和对齐数字的位置；代码保留现有额外等宽回退字体。没有在这轮引入新字体或装饰字库。

### Hierarchy

| 角色 | 已实现用途 | 来源 |
| --- | --- | --- |
| `display` | 普通紧凑 Hero 的页面标题 | `src/components/HeroBanner.astro` |
| `title` | 横向文章卡片标题 | `src/components/PostCard.astro` |
| `body` | 页面默认文字 | `src/styles/global.css` |
| `reading` | 文章与长段落 | `src/styles/prose.css` |
| `label` | 桌面主导航 | `src/components/SiteHeader.astro` |
| `data` / `code` | 时间、参数与代码 | `src/styles/tokens.css`、`src/styles/prose.css` |

正文是 17px、1.85 行高；默认界面文字为 16px、1.7 行高。文章日期和阅读时长为辅助信息，采用等宽数字。文章标题和正文标题使用 650 字重，不把所有标题压成同一个尺寸。

首页字级按 1920×1080 画布缩放，入口标题、等级和辉光管各有尺寸；不能把这些设计像素直接用于手机内容页。首页中文字体栈保留先 Microsoft YaHei、后 PingFang SC 的现行顺序。

**The Reading Surface Rule.** 正文使用正常排版与清楚的字形，代码可横向滚动；不透视倾斜文字，不把长文烘焙进图片。

## Layout

本次只统一外观和交互反馈。常规内容容器最大宽度为 1180px，阅读容器 token 为 780px；桌面两侧总留白 48px，宽度不超过 768px 时为 32px。现有侧栏在 1024px 以下合并为一列，主导航在 1200px 以下改为折叠菜单。

现有普通 Hero 的高度为桌面和平板 240px，宽度不超过 768px 时为 200px。文章详情保持当前纯标题与正文结构，不新增题图横幅。没有波浪分隔。搜索框最大宽度 760px，窗口不超过 600px 时使用更靠上的位置；分页在 520px 以下允许页码换行。

首页继续使用固定的 1920×1080 画布并等比缩放。人物左上坐标为 `(320, 40)`、宽 820px；右侧七个面板共用一个 `matrix3d` 父平面。超宽屏平移左右两组，竖屏保留上下空白。首页不滚动，不渲染普通导航或页脚；内容页不继承首页的透视布局。

间距表只收录现有组件内边距，未定义新的全站间距比例。文章卡片内容与外层卡片分开处理：上方 `card-post.padding` 描述内容区，题图仍贴合卡片边缘。

## Elevation & Depth

面板靠底色差、细边框和短阴影分层。`--surface-sheen` 是很弱的斜向反射，`--shadow-inset` 表示上下边缘，`--shadow-panel` 表示外部层次。深浅主题都保留这三种作用，具体值收录于 sidecar 的扩展和组件片段。

### Shadow Vocabulary

- `shadow-panel`：卡片和浮层的外阴影，避免扩散到大片正文。
- `shadow-inset`：面板与输入槽的内边缘，不增加重复厚边框。
- Hero 文字阴影与辉光管发光：只服务于图片上的标题和首页时钟，不作为普通文本规则。

**The Edge Material Rule.** 接缝、反射和阴影放在面板边缘，正文阅读面保持干净。

## Shapes

常规控件使用 5px 圆角，卡片与浮层使用 8px 圆角。头像、唱片、等级圆环和日月保留圆形语义。首页面板是已有的 3px 圆角，辉光管保留自己的轮廓，不能为“统一”而改掉这两类形状。

图标沿用本地 SVG。搜索、关闭和返回使用 `currentColor` 描边、圆端点与约 1.75–2 的线宽，保留常见功能含义。现有首页大图标是面板内的低对比图形，不替代可读的入口名称。

## Components

### Buttons

主要实色按钮来自加锁表单，使用琥珀底和 `on-accent` 文字。悬停切换到强强调色，按下显示内阴影；禁用状态保留等待指针并降低透明度，不提前显示成功。

导航工具按钮保留 44px 方形区域；悬停出现弱琥珀底，按下进入凹槽色。返回按钮使用表面反射和内边缘，悬停向左移动 2px。搜索关闭按钮使用同样大小的描边图标，按下移动 1px。

全局键盘焦点为 3px 琥珀轮廓、3px 偏移；搜索与加锁表单有已实现的 2px 局部轮廓。不要取消焦点而只保留鼠标悬停反馈。

### Inputs / Fields

搜索输入放在凹槽表面，聚焦时边框转为琥珀；输入文字、占位符和光标分别沿用正文、辅助色和强调色。搜索保留明确标签、Esc 提示与动态结果状态。密码输入和提交反馈继续由实际解锁流程决定。

### Navigation

常规主导航保持原次序。当前项使用琥珀文字与铜色下缘，鼠标悬停出现弱强调底。桌面仅博客提供横向二级菜单，键盘聚焦同样可打开；移动端沿用折叠菜单。

分页与导航共享表面、圆角和焦点规则，当前页额外显示强调边框与字重。页码是导航状态，不当作文章标签使用。

### Cards / Containers

文章卡片使用表面底、内边缘与短阴影，悬停或内部聚焦时增强边框。题图保持真实内容，按 16:10 裁切；悬停只缩放至 1.015，减少动态效果时取消缩放。内容标题可换行，日期和阅读时长保持辅助层级。

搜索浮层使用同一材质，190ms 内从 4px 位移进入；遮罩模糊背景。此时间来自现行组件，通用状态变化仍使用 160ms 或 200ms token。片段只是文档预览，真实页面仍由原 Astro 组件负责语义、焦点管理和功能。

### Homepage, imagery and persistent player

首页 v5 立绘位于背景之上、入口面板之下，可与面板重叠且不拦截输入。金句按现有 15 秒周期切换，支持双击、Enter/空格和暂停；时钟显示本地真实时间。播放器在首页常驻，其他页面折叠到左侧，展开与收起不改变播放控件语义。

| 素材 | 页面使用路径 | 原图或提示词记录 |
| --- | --- | --- |
| v5 立绘 | `src/assets/home/hatrix-character-v5.png` | 本机原图备份 `output/imagegen/hatrix-character-v5.png`（不提交）；提示词 `output/imagegen/hatrix-character-v5.prompt.txt` |
| v5 工坊背景 | `src/assets/home/liupin-workshop-v5.png` | 提示词 `output/imagegen/liupin-workshop-v5.prompt.txt` |
| 默认封面 | `public/images/default-cover.svg` | 本仓库原创 SVG，抽象计算基板结构 |

素材路径是来源记录，不授权重新生成或修改已选定 PNG 的像素、元数据与哈希。普通 Hero 复用工坊背景的裁切，真实文章封面与正文图片保持原内容。本轮材质由 CSS/SVG 完成，没有新增生图或图标依赖。

Pinterest 匿名检索遇到登录墙，用户未提供具体链接；没有可核验的 Pin 被采用。视觉依据仍为已选定素材、实际实现与本机世界观指南。

减少动态效果时取消组件过渡和装饰缩放；主题切换直接完成，金句自动切换默认暂停。持续运行的真实时钟与播放器状态仍按功能更新，不增加扫描线、自动视差或持续闪烁。

## Do's and Don'ts

### Do:

- Do 使用既有语义 token，并检查同一组件的深浅主题、键盘焦点和减少动态效果。
- Do 保留 v5 人物、AI 侧脸和工坊的既定素材关系，素材更新先确认授权范围。
- Do 让真实标题、正文、作品状态和错误信息先被读懂。
- Do 在现有布局中复用表面、凹槽和接缝，把材质限制在边缘。

### Don't:

- Don't 改动首页画布、人物坐标、右侧共用透视平面或非首页 Hero 高度来配合外观调整。
- Don't 把首页局部场景色、辉光字和透视变换推广到文章正文。
- Don't 用虚构数据、设备暗语、剧情解谜或长开机动画代替真实功能。
- Don't 复制 Pinterest 资产，或把未访问到的 Pin 写成设计来源。
- Don't 为统一外观修改已选定 PNG 的元数据或文件哈希。
