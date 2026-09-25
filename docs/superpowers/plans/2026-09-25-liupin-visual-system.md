# 留频街全站视觉实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 不改页面布局，统一全站视觉和交互质感。

**Architecture:** 保留 Astro 静态组件与当前功能；先建立公共 token，再将独立组件组接入同一材质和字体规则。已存在的动效继续使用原生命周期，局部反馈使用 CSS。

**Tech Stack:** Astro 7、CSS、TypeScript、原生 SVG/WAAPI、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-25-liupin-visual-system-design.md`

## 全局约束

- 当前工作区承接已确认但未提交的首页设计；直接在此工作区按文件所有权修改，不覆盖其他会话改动，不自动提交或推送。
- 不修改 `.private-content/`、路由、导航次序、内容计数、加锁逻辑、CSP 来源。
- 首页人物 `(320,40)`、宽 `820px`，1920×1080 画布和右侧单一投影保持原值。
- Hero 高度 240/200px，内容网格与宽度保留；浅色模式与减少动态效果均须可用。

## 复查重点

- 持久化播放器回到首页后仍正确继承样式，控件不误触收起。
- 深浅主题标题、链接、按钮与禁用状态可辨。
- 动画不造成横向滚动、不可见内容或焦点丢失。
- 首屏图片不重复下载未使用的私有内容，默认封面只用公开素材。
- 现有测试中几何、路径、保护和生命周期断言保留；只更新已经明确变化的视觉预期。

## 任务

- [x] 1. 主会话：tokens/global、BaseLayout、HeroBanner、SiteHeader、BackButton、首页局部外观、protected-content.css、giscus-dark.css、默认封面。建立公共颜色与材质，不改变布局。
- [x] 2. 内容页 worker：blog/about/archive/legacy pagination/guestbook/plans/lab/404 页面、EmptyState、ProfileSidebar。统一排版与表面，博客入场改为短距离；保留全部真实内容和入口。
- [x] 3. 阅读组件 worker：PostLayout、prose、PostCard/PostList/PostArchiveList/PostMeta、TableOfContents、LatestPostRail、Pagination、GiscusComments。修正浅色模式和阅读排版，保留结构、图片与交互。
- [x] 4. 交互 worker：MusicPlayer、SearchOverlay、ThemeTransition、theme.ts、ProjectLoadingAnimation、projects 页面及相关主题视觉断言。统一色彩与反馈，保留持久化、失败重试和减少动态效果。
- [x] 5. 主会话：合并检查 token 与硬编码色，检查常见页面两种主题与视口，真实触发动效；进行一次批量修正。
- [x] 6. 主会话与独立 reviewer：运行相关检查、构建及保护审计，更新已审阅的视觉基线；同步文档与局部素材清单，保留本地预览。

## 执行记录

2026-09-25：完成只读页面与交互勘察。用户补充布局可以不动，实施范围限定为外观与反馈。Pinterest 匿名搜索受登录提示阻挡，用户无指定链接；不以参考搜索阻塞已授权工作。

2026-09-25 完成：326 项单元测试、113 项相关浏览器检查（首轮两项问题修正后复验）、18 项视觉基线普通比较通过。Astro 检查、71 页构建、277 个远程图片 URL、保护审计和 3977 条站内引用检查通过。未运行完整端到端套件，未提交、推送或部署。
