# 工具库陈列页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/about/software/` 实现为可扩充的玻璃罐工具陈列页，并保留现有工坊视觉、主题切换和静态构建方式。

**Architecture:** 工具内容集中在类型明确的数据文件中，页面按分类渲染。`ToolGlyph.astro` 负责本地 SVG，`ToolSpecimen.astro` 负责单件展品的语义和视觉，页面只负责分组、Hero 和响应式货架。所有样式与组件共置，不改全局 token。

**Tech Stack:** Astro、TypeScript、CSS、Vitest、Playwright。

## Global Constraints

- 保持 Astro 纯静态输出，不增加依赖、服务端接口或远程图片请求。
- 不修改当前工作区中其他会话已改动的导航、Giscus 和全局样式文件。
- 外链使用 `target="_blank"` 与 `rel="noreferrer"`。
- 动效必须响应 `prefers-reduced-motion`，手机端不能依赖 hover 才显示用途。
- 所有中文文档和页面文案使用直接、具体的表达。

---

### Task 1: 定义工具数据与约束测试

**Files:**
- Create: `src/data/software-tools.ts`
- Create: `tests/unit/software-tools.test.ts`

**Interfaces:**
- Produces: `ToolIconName`、`ToolTone`、`SoftwareTool`、`SoftwareToolGroup` 类型和 `SOFTWARE_TOOL_GROUPS` 常量。

- [x] **Step 1: 写失败测试**

测试导入 `SOFTWARE_TOOL_GROUPS`，断言分类非空、工具总数至少为 12、名称和 URL 唯一、URL 使用 HTTPS、说明文字非空。

- [x] **Step 2: 确认测试因模块缺失而失败**

Run: `corepack pnpm vitest run tests/unit/software-tools.test.ts`

Expected: FAIL，提示无法导入 `@/data/software-tools`。

- [x] **Step 3: 写最小数据实现**

添加四个分组和 16 个来自现有《工具箱》的真实链接。每项填写短用途、用途图标和指示光色。

- [x] **Step 4: 确认数据测试通过**

Run: `corepack pnpm vitest run tests/unit/software-tools.test.ts`

Expected: PASS。

### Task 2: 实现展品组件和页面结构

**Files:**
- Create: `src/components/ToolGlyph.astro`
- Create: `src/components/ToolSpecimen.astro`
- Create: `src/pages/about/software.astro`
- Create: `tests/e2e/software-page.spec.ts`

**Interfaces:**
- Consumes: `SoftwareTool` 与 `SOFTWARE_TOOL_GROUPS`。
- Produces: `/about/software/` 页面、`[data-tool-specimen]` 展品节点和 `[data-tool-purpose]` 用途节点。

- [x] **Step 1: 写失败的页面测试**

测试访问 `/about/software/`，断言标题“工具库”、四个分组、16 个展品、外链安全属性、工具名称和用途都存在。

- [x] **Step 2: 确认旧空状态不满足测试**

Run: `corepack pnpm playwright test tests/e2e/software-page.spec.ts --project=chromium`

Expected: FAIL，页面仍是动态路由提供的空状态。

- [x] **Step 3: 写图标与单件展品组件**

`ToolGlyph.astro` 根据 `icon` 输出统一笔画的本地 SVG。`ToolSpecimen.astro` 输出完整外链、玻璃罐、图标、底座和用途说明，并在组件内写视觉、焦点、触控和减少动态效果样式。

- [x] **Step 4: 写独立页面**

页面复用 `BaseLayout`、`BackButton` 和 `HeroBanner`，按数据分组输出货架；桌面使用四列，平板和手机使用两列。

- [x] **Step 5: 确认页面测试通过**

Run: `corepack pnpm playwright test tests/e2e/software-page.spec.ts --project=chromium`

Expected: PASS。

### Task 3: 检查与视觉验收

**Files:**
- Modify only if defects are found: `src/components/ToolSpecimen.astro`
- Modify only if defects are found: `src/pages/about/software.astro`

**Interfaces:**
- Consumes: 已完成的页面。
- Produces: 可通过构建、类型检查和桌面/手机视觉检查的最终实现。

- [x] **Step 1: 运行静态检查与相关测试**

Run: `corepack pnpm check`

Run: `corepack pnpm vitest run tests/unit/software-tools.test.ts`

Expected: 两项均通过。

- [x] **Step 2: 启动规定的本地预览**

Run: `corepack pnpm astro dev --background --host 127.0.0.1 --port 4321`

Run: `corepack pnpm astro dev status`

Expected: 服务运行在 `http://127.0.0.1:4321/`。

- [x] **Step 3: 一次检查桌面和手机画面**

在 1440px 和 390px 宽度截图，检查文字溢出、罐体层次、主题对比、键盘焦点和用途信息。发现的问题集中修改一次。

- [x] **Step 4: 运行 Impeccable 检测器**

Run: `.agents/skills/impeccable/scripts/impeccable.cmd detect --json src/components/ToolGlyph.astro src/components/ToolSpecimen.astro src/pages/about/software.astro`

Expected: 没有需要修复的高严重度问题。

- [x] **Step 5: 完成验证**

Run: `corepack pnpm test:run`

Run: `corepack pnpm build`

Expected: 单元测试和生产构建通过；不提交或推送。

---

## 第二轮：双尺寸高密度货架与命名调整

### Task 4: 先固定新命名

**Files:**
- Modify: `tests/unit/navigation-config.test.ts`
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/navigation-dropdown.spec.ts`
- Modify: `tests/e2e/interactions.spec.ts`
- Modify: `src/config/navigation.ts`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Produces: 首页“效率提升”“工具箱”“装备铺”，以及导航和对应页面一致的标题。

- [x] **Step 1: 更新命名断言并确认失败**

Run: `corepack pnpm vitest run tests/unit/navigation-config.test.ts`

Run: `$env:PLAYWRIGHT_PORT='4321'; corepack pnpm playwright test tests/e2e/home.spec.ts tests/e2e/navigation-dropdown.spec.ts --project=desktop-1440`

Expected: 旧文案导致断言失败。

- [x] **Step 2: 修改配置和首页文案**

将软件入口改为“工具箱”，装备入口改为“装备铺”，首页分组标题改为“效率提升”。动态装备页面从配置读取“装备铺”，独立工具页面标题改为“工具箱”。

- [x] **Step 3: 重新运行命名测试**

Expected: 相关断言通过。

### Task 5: 改为双尺寸连续货架

**Files:**
- Modify: `tests/unit/software-tools.test.ts`
- Modify: `tests/e2e/software-page.spec.ts`
- Modify: `src/data/software-tools.ts`
- Modify: `src/components/ToolGlyph.astro`
- Modify: `src/components/ToolSpecimen.astro`
- Modify: `src/pages/about/software.astro`

**Interfaces:**
- Produces: `ToolKind`、扁平的 `SOFTWARE_TOOLS` 数据，以及每层 8 件的无分类货架。

- [x] **Step 1: 更新数据和页面测试并确认失败**

数据测试要求同时存在 `software` 和 `link`。页面测试要求无分类、无顶部说明、每层 8 件，并检查大罐与小罐尺寸约为 1.5:1。

- [x] **Step 2: 扁平化数据并实现双尺寸组件**

软件罐主体为约 `84×108px`，网页链接罐主体为约 `56×72px`。页面按数据顺序每 8 件切成一条货架；桌面完整显示，窄屏仅让货架内部横向滚动。

- [x] **Step 3: 重新运行数据与页面测试**

Expected: 定向 Vitest 与 Playwright 通过。

### Task 6: 视觉和全量验证

**Files:**
- Modify only if defects are found: `src/components/ToolSpecimen.astro`
- Modify only if defects are found: `src/pages/about/software.astro`

- [x] **Step 1: 检查 1440px、768px 和 390px 画面**

确认桌面每层至少 6 件、平台间距收紧、两级尺寸清楚、手机页面没有整体横向溢出。

- [x] **Step 2: 运行检查**

Run: `corepack pnpm check`

Run: `corepack pnpm test:run`

Run: `corepack pnpm build`

Run: `corepack pnpm check:site`

Expected: 全部通过；不提交或推送。

### Task 7: 移除栏目 Hero 并扩展实验场尾迹

**Files:**
- Modify: `src/pages/blog/index.astro`
- Modify: `src/pages/projects/index.astro`
- Modify: `src/pages/about.astro`
- Modify: `src/pages/about/[section].astro`
- Modify: `src/pages/about/friends.astro`
- Modify: `src/pages/about/software.astro`
- Modify: `src/pages/plans.astro`
- Modify: `src/pages/lab.astro`
- Modify: `src/pages/guestbook.astro`
- Modify: `src/styles/global.css`
- Modify: `src/lib/cursor-trail.ts`
- Modify: `src/scripts/cursor-trail.ts`
- Test: `tests/e2e/banner.spec.ts`
- Test: `tests/unit/cursor-trail.test.ts`
- Test: `tests/e2e/cursor-trail.spec.ts`

- [x] **Step 1: 写 Hero 和全视口尾迹失败测试**

栏目页测试要求不再渲染 `[data-hero]`，正文顶部内边距覆盖固定导航。尾迹测试要求视口内任意坐标返回 `page`，顶部导航和正文中间都能绘制。

- [x] **Step 2: 移除 Hero 并统一顶部避让**

栏目页使用 `plain-page` body class；`body.plain-page > main[class]` 统一提供顶部内边距。归档、旧分页和 404 不在本次移除范围。

- [x] **Step 3: 将尾迹触发范围改为整个实验场视口**

区域类型改为 `page | null`。视口内移动保持同一会话，`pointerleave`、`pointerout` 的 `relatedTarget === null`、窗口失焦或指针取消才结束会话。

- [x] **Step 4: 验证并恢复普通预览**

定向浏览器测试、全量单元测试、Astro 检查、生产构建和站内链接审计通过；普通预览恢复到 `http://127.0.0.1:4321/`。

### Task 8: 同类货架和轻量副标题

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `src/pages/about/software.astro`
- Modify: `src/components/ToolSpecimen.astro`
- Modify: `tests/e2e/software-page.spec.ts`
- Modify: `tests/e2e/banner.spec.ts`

- [x] **Step 1: 写货架容量和副标题失败测试**

测试要求软件平台为 6 槽、网页链接平台为 8 槽，平台内不混放；最后一层保留 6 个空槽。栏目页不显示 Hero，但导航下方必须显示原副标题。

- [x] **Step 2: 实现同类分层和固定空槽**

页面先按 `kind` 分组，再按对应容量切分；每层生成完整槽位。桌面使用固定 10px 列间距，窄屏保持整条平台内部横向浏览。

- [x] **Step 3: 恢复统一副标题**

`BaseLayout` 接收 `pageSubtitle`，栏目页传入原副标题。副标题在固定导航下方居中显示，主标题仍隐藏。

- [x] **Step 4: 进一步收紧平台间距**

桌面提示框改为绝对定位，不再占 48px 行高；手机端用途说明仍在正常文档流中。
