# 六边形加载动画实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在首次加载与 Astro 站内导航等待超过阈值时显示科技感六边形加载动画，并在完成或失败后可靠收起。

**Architecture:** 使用独立 Astro 组件输出持久化 SVG 加载层；使用独立客户端脚本监听 Astro 导航生命周期与首次加载事件，管理延迟显示、最短展示时间和清理。动画使用 CSS/SVG 原生实现，不新增 GSAP 依赖。

**Tech Stack:** Astro 7、TypeScript、原生 SVG/CSS、Astro ClientRouter、Vitest、Playwright。

## Global Constraints

- 保持纯静态输出，不增加服务器或第三方动画依赖。
- 不改变首页揭开动画、主题切换、受保护内容验证和现有导航行为。
- 加载层不改变页面布局与滚动位置。
- prefers-reduced-motion: reduce 下不运行连续闪烁。
- 修改完成后运行 corepack pnpm test:run、corepack pnpm check、corepack pnpm build。

---

### Task 1: 创建加载层组件

**Files:**
- Create: src/components/LoadingOverlay.astro
- Modify: src/layouts/BaseLayout.astro

**Interfaces:**
- Produces: data-loading-overlay、data-loading-grid、data-loading-status DOM hooks consumed by Task 2.
- Consumes: existing theme CSS variables and ClientRouter.

- [ ] Step 1: Write the failing test

在 tests/unit/loading-overlay.test.ts 增加组件源码约束测试，读取组件文本并断言包含数据钩子、15×15 网格参数、减少动态效果媒体查询和无 GSAP import。

- [ ] Step 2: Run test to verify it fails

Run: corepack pnpm vitest run tests/unit/loading-overlay.test.ts
Expected: FAIL because the component file does not exist.

- [ ] Step 3: Write minimal implementation

创建组件，输出固定全屏 div 与内联 SVG；使用 Array.from({ length: 225 }) 生成错列六边形，增加中心状态文字与进度光带，CSS 提供描边显现、中心收束和主题/减少动态效果样式。

在 BaseLayout.astro 的 body 开始位置渲染 LoadingOverlay，确保首次加载时加载层先存在。

- [ ] Step 4: Run test to verify it passes

Run: corepack pnpm vitest run tests/unit/loading-overlay.test.ts
Expected: PASS.

- [ ] Step 5: Commit

 git add src/components/LoadingOverlay.astro src/layouts/BaseLayout.astro tests/unit/loading-overlay.test.ts && git commit -m "feat: add hexagon loading overlay"

### Task 2: 实现加载状态控制器

**Files:**
- Create: src/scripts/loading-overlay.ts
- Modify: src/layouts/BaseLayout.astro

**Interfaces:**
- Consumes: Task 1 data hooks.
- Produces: createLoadingController and lifecycle behavior for initial load and Astro navigation.

- [ ] Step 1: Write the failing test

在 tests/unit/loading-overlay-controller.test.ts 测试纯函数状态机：120ms 内完成不显示；超过阈值显示；显示后至少保持 360ms；完成与失败都回到隐藏状态。

- [ ] Step 2: Run test to verify it fails

Run: corepack pnpm vitest run tests/unit/loading-overlay-controller.test.ts
Expected: FAIL because controller module does not exist.

- [ ] Step 3: Write minimal implementation

实现可测试的 createLoadingController，注入 now、setTimeout、clearTimeout 和 DOM 回调；生产脚本绑定 astro:before-preparation、astro:after-swap、astro:page-load 及失败路径，使用 120ms 延迟与 360ms 最短展示时间，并在页面卸载时清理定时器。

- [ ] Step 4: Run test to verify it passes

Run: corepack pnpm vitest run tests/unit/loading-overlay-controller.test.ts
Expected: PASS.

- [ ] Step 5: Commit

 git add src/scripts/loading-overlay.ts src/layouts/BaseLayout.astro tests/unit/loading-overlay-controller.test.ts && git commit -m "feat: control loading overlay during navigation"

### Task 3: 集成与验证

**Files:**
- Modify: tests/e2e/shell.spec.ts or create tests/e2e/loading-overlay.spec.ts

**Interfaces:**
- Consumes: Task 1 and Task 2 DOM hooks and lifecycle controller.

- [ ] Step 1: Add browser coverage

增加 Playwright 场景：页面正常加载后遮罩隐藏；人为延迟文档导航时遮罩出现；快速导航不出现；导航完成后遮罩隐藏；减少动态效果时无连续动画类。

- [ ] Step 2: Run targeted checks

Run: corepack pnpm test:run
Expected: all Vitest tests pass.

Run: corepack pnpm check
Expected: 0 errors.

Run: corepack pnpm build
Expected: image check, Astro build and protected output audit pass.

- [ ] Step 3: Commit

 git add tests/e2e/loading-overlay.spec.ts && git commit -m "test: verify hexagon loading states"

