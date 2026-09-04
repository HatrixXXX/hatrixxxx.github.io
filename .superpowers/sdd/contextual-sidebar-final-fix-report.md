# Contextual sidebar final fix report

日期：2026-09-04

## 结果

本轮修复了最终审查确认的侧栏问题：Sakana 不再盖住侧栏或截获侧栏点击；高度为 760px 的桌面视口不启用 sticky，900px 视口仍可启用；About 根标题改用主题颜色；微信待补充状态同时对屏幕阅读器和视觉用户可见。负路由断言补到了博客类型页、作品页、留言板和 404 页面。

`.superpowers/sdd/task-3-report.md` 已按 `a62ee20` 恢复。工作区文件与历史 blob 的哈希均为 `e83ab474fa9b560da0a628dfa4b7a331cdfb61b6`。

## 根因

- Sakana 容器是 `pointer-events: none`，但库生成的 `.sakana-character` 自身仍可命中。它位于 `z-index: 15`，而原侧栏没有更高的定位层。移动端 `/about/` 的知乎链接中心因此命中了 `.sakana-character`。
- 卡片栈实测高 `866.234375px`。原媒体条件在视口高度达到 `760px` 时就启用 sticky，连同 `24px` 顶部偏移后显然放不进 760px 视口，底部播放器会被困在视口外。
- About 根标题写死为 `#fff`，没有随浅色主题切换。
- 微信项只有 `aria-label="微信"`，DOM 中也没有可见的状态文字。

对应修复是给整个卡片栈设置 `position: relative; z-index: 16`，保留 Sakana 的既有层级，并把 sticky 高度门槛改为 `900px`。这个层级仍低于页头的 20 和主题过渡层的 10000。

## RED / GREEN

### RED

测试先改，生产代码尚未修改时运行：

```powershell
$env:PLAYWRIGHT_PORT='4321'
corepack pnpm playwright test tests/e2e/about-guestbook.spec.ts tests/e2e/post.spec.ts --project=desktop-1440 --grep "Sakana does not|sidebar stickiness|remain readable|requested profile"
```

结果符合预期：

- 微信可访问名称收到 `微信`，期望同时包含 `微信` 和 `待补充`。
- About 根标题收到 `rgb(255, 255, 255)`，期望 `rgb(22, 26, 32)`。
- 1440×760 下侧栏收到 `position: sticky`。
- 首次选择的邮件链接没有落在 Sakana 图形上，不能复现命中问题；根据页面命中取证改用同一社交网格内、确实被右侧角色覆盖的知乎链接后，收到 `{ socialId: null, interceptedBySakana: true }`，确认 RED 有效。

### GREEN

```powershell
$env:PLAYWRIGHT_PORT='4321'
corepack pnpm playwright test tests/e2e/about-guestbook.spec.ts tests/e2e/post.spec.ts tests/e2e/index-pages.spec.ts --project=desktop-1440 --grep "Sakana does not|sidebar stickiness|remain readable|requested profile|omit contextual"
```

结果：`5 passed (11.8s)`。该命令覆盖四项修复和扩展后的负路由集合。

## 改动文件

- `src/components/SidebarStack.astro`：建立高于 Sakana 的 stacking context；sticky 门槛改为 900px。
- `src/components/ProfileSidebar.astro`：微信可访问名称增加“待补充”，并显示紧凑状态徽标；仍是不可聚焦的禁用 `span`。
- `src/pages/about.astro`：根标题使用现有 heading/text token。
- `tests/e2e/about-guestbook.spec.ts`：增加 Sakana 命中回归、标题颜色和微信状态断言。
- `tests/e2e/post.spec.ts`：增加 760px/900px sticky 和播放器可达性回归。
- `tests/e2e/index-pages.spec.ts`：负路由增加博客类型页、`/projects/`、`/guestbook/` 和 `/404.html`。
- `tests/e2e/visual.spec.ts-snapshots/-posts-本科数学大杂烩--{desktop-1440,tablet-768,mobile-390}.png`：只更新受新叠放关系影响的三张文章基线。
- `.superpowers/sdd/task-3-report.md`：恢复历史迁移报告。
- `AGENTS.md`、`README.md` 和两份 Sakana 历史计划的页首说明：实测总数由 152 改为 154。

## 视觉检查

旧基线在三个视口都检测到约 1% 像素差异。最初复用普通开发服务生成的快照与测试模式不一致，因此没有作为最终证据。停止已核验的当前工作区 PID 65496 后，由 Playwright 以 `PLAYWRIGHT_TEST=1` 自建 4322 服务，再只更新三张文章快照。

最终快照展示的文章、侧栏、角色和正文图片区均完整，没有横向溢出、缺图或异常空白。更新后再次运行同一文章视觉用例，结果是 `3 passed (42.1s)`。

## 完整验证

- `corepack pnpm test:run`：20 个文件、289 项测试通过。
- `corepack pnpm check`：124 个文件，0 errors、0 warnings、0 hints。命令前仍会打印既有 Markdown API 弃用消息和空作品集合消息。
- `corepack pnpm build`：254 个 jsDelivr 地址全部通过；静态构建 67 页；加锁内容审计通过。
- `corepack pnpm check:site`：4102 条站内链接通过，构建产物为 15,933,052 字节。
- 首次权威全量 Playwright：154 项中 151 项通过，只有尚未更新的三张文章视觉基线失败。随后在同一测试环境更新并检查这三张基线，定向复跑为 3/3 通过。两段结果合计覆盖当前 154 项检查和 18 张视觉基线。
- `git diff --check`：通过。

## 剩余说明

基线更新后又启动了一次完整 Playwright 复跑。运行期间，私有内容仓库在 14:03 新增了一个与本任务无关、未跟踪的本地加锁测试文章，开发服务随即重新同步内容。该轮约在第 51 项后出现 Vite 级联故障，普通路由、搜索索引和 `src/scripts/protected-content.ts` 一度无法从本地 4322 服务获取；直接探测时服务与模块均恢复为 HTTP 200。新增文章也把本地侧栏计数临时变为 41，与公开仓库基于 40 篇正式文章的固定断言不符。按任务边界保留这个私有文件，不删除、不修改、不提交，也不为它改写公开测试合同。

首次权威全量运行的 151 个非文章视觉检查是在该文件出现前完成的，最终三张文章视觉检查也已独立通过。因此本轮没有用临时本地状态修改产品代码或放宽断言。

按 brief 要求，重复的上线日期计算和页面加载对齐的时钟节拍保持不变。
