# 文章正文搜索与段落高亮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让普通文章支持正文搜索，结果显示命中上下文，点击后定位并短暂高亮对应段落；加锁文章完全排除在搜索范围外。

**Architecture:** 构建阶段从普通文章生成带段落列表的 JSON 索引，并用自定义 tokenizer 支持中英文搜索。搜索面板根据 MiniSearch 命中结果生成安全的上下文片段和 `?q=` 链接；文章页脚本在首次加载及 Astro 导航后扫描正文元素、滚动到首个命中段落并添加渐隐背景类。

**Tech Stack:** Astro 7、TypeScript、MiniSearch、Vitest、Playwright、原生 DOM/CSS 动画。

## Global Constraints

- `locked: true` 和 `draft: true` 文章不得进入公开搜索索引。
- 保留现有文章 URL、Giscus pathname、搜索入口和 20 条结果上限。
- 不把正文 HTML 或加锁正文写入公开搜索索引。
- 高亮脚本必须兼容 Astro 客户端导航和 `prefers-reduced-motion`。
- 不引入新的运行时依赖。

### Task 1: 结构化搜索文档与中文 tokenizer

**Files:**
- Modify: `src/lib/search.ts`
- Modify: `src/pages/search-index.json.ts`
- Test: `tests/unit/content-utils.test.ts`

**Interfaces:**
- `SearchDocument` 增加 `paragraphs: string[]`，仅普通文章填写正文段落。
- 新增 `markdownToParagraphs(markdown: string): string[]`，按 Markdown 空行拆分并调用现有纯文本规范化。
- 新增 `tokenizeSearchText(text: string): string[]`，英文/数字按词、连续汉字按字符和相邻双字片段生成 token。
- `search-index.json.ts` 过滤 `post.data.locked === true` 后再序列化。

- [ ] **Step 1: 写失败单元测试**

在 `tests/unit/content-utils.test.ts` 增加断言：普通文章文档包含段落数组；中文 `矩阵乘法` 可生成 `矩阵` 等双字 token；加锁文章不被 `search-index` 映射结果保留。

- [ ] **Step 2: 运行测试确认失败**

Run: `corepack pnpm vitest run tests/unit/content-utils.test.ts`

Expected: FAIL，缺少 `paragraphs` 或 tokenizer 导出函数。

- [ ] **Step 3: 实现最小索引改动**

让 `toSearchDocument` 生成 `paragraphs`，让 `search-index.json.ts` 使用 `posts.filter(({ data }) => !data.locked).map(toSearchDocument)`；MiniSearch 配置新增 `tokenize: tokenizeSearchText`，索引字段继续为 `title` 和 `text`，存储字段加入 `paragraphs`。

- [ ] **Step 4: 运行单元测试确认通过**

Run: `corepack pnpm vitest run tests/unit/content-utils.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交任务**

```bash
git add src/lib/search.ts src/pages/search-index.json.ts tests/unit/content-utils.test.ts
git commit -m "feat: index searchable article paragraphs"
```

### Task 2: 搜索结果上下文与跳转参数

**Files:**
- Modify: `src/scripts/search.ts`
- Modify: `src/components/SearchOverlay.astro`
- Test: `tests/e2e/interactions.spec.ts`

**Interfaces:**
- `search.ts` 新增 `excerptForMatch(paragraphs: string[], query: string): string`，返回命中位置附近最多两句文本。
- 结果链接统一生成 `${match.url}?q=${encodeURIComponent(query)}`。
- 结果卡片新增 `[data-search-excerpt]`，关键词通过 DOM 文本节点和 `<mark>` 渲染，禁止把搜索词直接拼入 `innerHTML`。

- [ ] **Step 1: 写失败 E2E 测试**

扩展搜索测试：输入一个正文关键词后，结果包含 `[data-search-excerpt] mark`，链接包含 `q=`，并且结果不出现加锁 fixture。

- [ ] **Step 2: 运行测试确认失败**

Run: `corepack pnpm exec playwright test tests/e2e/interactions.spec.ts -g "search" --project=desktop-1440`

Expected: FAIL，当前结果没有命中片段、`mark` 或查询参数。

- [ ] **Step 3: 实现上下文和安全高亮**

在 `renderResults` 中从 `match.paragraphs` 生成片段；用 `DocumentFragment` 分段追加普通文本与 `<mark>`，标题仍使用 `textContent`；锁定结果不再渲染，因为索引已过滤。

- [ ] **Step 4: 增加结果片段样式**

在 `SearchOverlay.astro` 为 `[data-search-excerpt]` 设置较小字号和截断布局，为 `mark` 使用现有 accent 色的低对比背景。

- [ ] **Step 5: 运行搜索 E2E 确认通过**

Run: `corepack pnpm exec playwright test tests/e2e/interactions.spec.ts -g "search" --project=desktop-1440`

Expected: PASS。

- [ ] **Step 6: 提交任务**

```bash
git add src/scripts/search.ts src/components/SearchOverlay.astro tests/e2e/interactions.spec.ts
git commit -m "feat: show highlighted search excerpts"
```

### Task 3: 文章页段落定位与渐隐高亮

**Files:**
- Create: `src/scripts/search-highlight.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/prose.css`
- Test: `tests/unit/search-highlight.test.ts`
- Test: `tests/e2e/interactions.spec.ts`

**Interfaces:**
- 导出纯函数 `findSearchTarget(elements: readonly HTMLElement[], query: string): HTMLElement | undefined`。
- 浏览器脚本监听 `astro:page-load`，读取 `URLSearchParams(location.search).get('q')`，扫描 `.prose :is(p, li, blockquote, h2, h3, h4)`。
- 找到目标后执行 `scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })`，添加 `data-search-hit`，动画结束或 3 秒后移除。

- [ ] **Step 1: 写失败单元测试**

新增 `tests/unit/search-highlight.test.ts`，用 JSDOM 风格的最小 HTMLElement fixture 覆盖大小写不敏感匹配、空查询返回 `undefined`、首个匹配元素优先。

- [ ] **Step 2: 运行测试确认失败**

Run: `corepack pnpm vitest run tests/unit/search-highlight.test.ts`

Expected: FAIL，找不到 `findSearchTarget`。

- [ ] **Step 3: 实现定位脚本**

导出纯函数并在脚本入口绑定一次性 `astro:page-load` 监听；高亮前移除旧的 `[data-search-hit]`，避免客户端导航残留。

- [ ] **Step 4: 增加渐隐背景样式**

在 `src/styles/prose.css` 增加 `[data-search-hit]` 的浅蓝背景、圆角和 `search-hit-fade` 动画；在 `prefers-reduced-motion: reduce` 下禁用动画但保留短暂背景色。

- [ ] **Step 5: 接入 BaseLayout 并写失败 E2E**

在 BaseLayout 脚本块导入 `@/scripts/search-highlight`；E2E 先直接访问带 `?q=` 的普通文章，断言命中段落有 `[data-search-hit]`，再通过搜索结果点击断言 URL 和高亮。

- [ ] **Step 6: 运行单元和 E2E 确认通过**

Run: `corepack pnpm vitest run tests/unit/search-highlight.test.ts`

Run: `corepack pnpm exec playwright test tests/e2e/interactions.spec.ts -g "search" --project=desktop-1440`

Expected: PASS。

- [ ] **Step 7: 提交任务**

```bash
git add src/scripts/search-highlight.ts src/layouts/BaseLayout.astro src/styles/prose.css tests/unit/search-highlight.test.ts tests/e2e/interactions.spec.ts
git commit -m "feat: highlight searched article paragraphs"
```

### Task 4: 全量验证与文档同步

**Files:**
- Modify: `README.md` only if the public search behavior section is missing.
- Test: existing full suite.

- [ ] **Step 1: 运行完整检查**

Run: `corepack pnpm test:run`

Run: `corepack pnpm check`

Run: `corepack pnpm build`

Expected: all commands exit 0；加锁正文审计通过。

- [ ] **Step 2: 手工验证本地预览**

Run: `corepack pnpm astro dev status`

访问首页打开搜索，输入普通文章正文中的中文关键词，确认结果片段高亮；点击后确认文章滚动到命中段落并在约 3 秒内恢复背景。搜索加锁文章标题应无结果。

- [ ] **Step 3: 提交验证记录**

```bash
git add README.md
git commit -m "docs: record article search behavior"
```
