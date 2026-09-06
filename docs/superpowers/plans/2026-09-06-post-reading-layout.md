# 文章阅读页布局实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除文章摘要和封面头图，把文章页改为居中的正文加 sticky 右栏目录/最新文章布局。

**Architecture:** 文章 frontmatter 删除 `description`，搜索和 RSS 改用标题、正文及站点默认描述。文章页由服务端根据目录长度选择右栏最新文章数量，CSS 负责居中、响应式和 sticky，客户端只继续维护目录高亮与正文图片灯箱。

**Tech Stack:** Astro、Zod、TypeScript、Vitest、Playwright、CSS。

## Global Constraints

- 保留全部 `/posts/<legacySlug>/` 路径和 Giscus pathname 映射。
- 保持纯静态输出，不增加服务端或数据库。
- 正文图片继续支持 PhotoSwipe；文章封面不在文章页内容中渲染。
- 桌面端正文与右栏整体居中并保留左右空白；移动端单列且无横向溢出。

---

### Task 1: 移除文章摘要字段

**Files:**
- Modify: `src/lib/post-schema.ts`, `src/content.config.ts`, `src/lib/search.ts`, `src/pages/rss.xml.ts`, `src/layouts/PostLayout.astro`
- Modify: `.private-content/posts/*.md`, `src/drafts/*.md`
- Test: `tests/unit/content-schema.test.ts`, `tests/unit/content-utils.test.ts`

- [ ] 写测试：文章 schema 拒绝 `description`，搜索文档从标题/正文生成，RSS 使用站点默认描述。
- [ ] 运行相关 Vitest，确认测试先失败。
- [ ] 删除 schema 中的 `description`，批量删除文章 frontmatter 的 `description` 行；更新搜索、RSS、文章页 SEO 传参。
- [ ] 运行相关 Vitest，确认通过。
- [ ] 提交 `refactor: remove post descriptions`。

### Task 2: 右栏目录与最新文章组件

**Files:**
- Create: `src/components/LatestPostRail.astro`
- Modify: `src/components/TableOfContents.astro`, `src/layouts/PostLayout.astro`
- Test: `tests/unit/post-layout.test.ts`

- [ ] 写测试覆盖目录项数量到最新文章数量的映射：无目录 4 篇，目录变长依次减少，超过阈值为 0 篇。
- [ ] 运行测试确认失败。
- [ ] 实现纯函数 `latestPostLimit(headingCount: number): number` 并新增纵向封面+标题卡片组件。
- [ ] 让目录无标题时完全不渲染，文章页右栏按计算结果渲染最新文章。
- [ ] 运行相关 Vitest，确认通过。
- [ ] 提交 `feat: add adaptive latest post rail`。

### Task 3: 重构文章页视觉结构

**Files:**
- Modify: `src/layouts/PostLayout.astro`, `src/components/PostMeta.astro`, `src/components/PostCard.astro`
- Test: `tests/e2e/post.spec.ts`, `tests/e2e/interactions.spec.ts`

- [ ] 先新增 E2E 断言：文章页无封面头图和摘要，元信息包含发布时间/更新时间/字数/阅读时间，桌面整体居中，右栏 sticky，移动端无溢出。
- [ ] 运行目标 E2E 确认失败。
- [ ] 移除封面 hero 和摘要段，扩展 `PostMeta` 输出字数；调整 grid 为正文+右栏，右栏组合目录与最新文章，使用紧凑卡片样式。
- [ ] 保持正文图片灯箱；更新灯箱测试确保只点击正文图片时打开。
- [ ] 运行目标 E2E，确认通过。
- [ ] 提交 `feat: redesign post reading layout`。

### Task 4: 全量验证与文档同步

**Files:**
- Modify: `README.md`, `AGENTS.md`（如命令或内容模型描述受影响）
- Test: 全部现有测试

- [ ] 执行 `corepack pnpm test:run`、`corepack pnpm check`、`corepack pnpm build`、`corepack pnpm check:site`、`corepack pnpm test:e2e`。
- [ ] 修复由字段删除、链接数量或视觉结构引起的回归，不放宽既有审计。
- [ ] 更新文档中已过期的文章字段和页面结构说明。
- [ ] 启动本地预览并确认 `http://127.0.0.1:4321/` 可访问。
- [ ] 提交 `chore: verify post reading layout`。
