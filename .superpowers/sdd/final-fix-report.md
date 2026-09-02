# Final review 修复报告

> 历史记录：本文数值对应 `feature/astro-blog-rebuild` 当时的提交；当前页面、链接和测试数量以根目录 README 与 AGENTS 为准。

## 状态与提交

- 状态：完成
- 实现提交：`0965d57`（`fix: resolve final review findings`）
- 分支：`feature/astro-blog-rebuild`
- 未执行 push、merge 或 deploy。

## RED / GREEN 记录

### 1. 空歌单播放器位置

- RED：在现有空播放器 E2E 中加入桌面文章卡和移动作者侧栏的矩形相交检查。`corepack pnpm exec playwright test tests/e2e/interactions.spec.ts --grep "empty music player"` 收到 `Expected: false, Received: true`。
- GREEN：`MusicPlayer.astro` 继续保留 `transition:persist`、空进度和禁用控件；`data-empty="true"` 时改为普通文档流，非空歌单仍使用原有右下角 fixed 规则。同一 focused E2E 为 `1 passed`，并继续证明没有构造 `Audio`、没有媒体请求、客户端导航后节点保持不变。

### 2. 构建站点链接总量门禁

- RED：新增 `expectedLocalLinks: 2`、实际只有 1 条本地链接的 unit fixture。运行 `corepack pnpm test:run tests/unit/content-utils.test.ts tests/unit/check-built-site.test.ts` 时，`errors` 仍为空。
- GREEN：`inspectBuiltSite` 接受可选 `expectedLocalLinks` 并把数量不符加入聚合错误；通用 fixture 不设固定值。CLI 通过 `inspectProjectBuiltSite` 传入当前库存 `4653`。`corepack pnpm test:run tests/unit/check-built-site.test.ts` 为 `4 passed`，`corepack pnpm check:site` 输出 `Checked 4653 local links, 15673261 output bytes.`

### 3. 搜索文本中的占位符

- RED：exact probe 要求 `<my_repo_url> <span>HTML</span> <!-- hidden -->` 变成 `<my_repo_url> HTML`。旧实现收到 `HTML`，说明占位符被删除。
- GREEN：清理规则只移除 HTML comment 和合法标签名；单下划线强调也限定为非单词边界，避免把 snake_case 压成普通单词。`corepack pnpm test:run tests/unit/content-utils.test.ts` 为 `9 passed`。构建后的 `search-index.json` 有 40 条文档，额外扫描结果为 `documents-with-html-markup=0`。
- 完整 E2E 首次运行时，旧 markup 断言把 `<my_repo_url>` 误判为 HTML，结果为 `58 passed, 1 failed`。收窄该断言后，`corepack pnpm exec playwright test tests/e2e/index-pages.spec.ts` 为 `2 passed`，默认套件复跑为 `59 passed`。

### 4. Giscus 主题同步

- RED：focused E2E 预置 light 主题，Giscus 注入脚本的 `data-theme` 仍为 `dark`。
- GREEN：初始化时从 `document.documentElement.dataset.theme` 读取 light/dark；切换主题时向 `iframe.giscus-frame` 的 `https://giscus.app` origin 发送 `{ giscus: { setConfig: { theme } } }`。测试使用真实跨源 iframe probe 记录消息，首次加载和 View Transition 后每次点击都只收到一条消息。`corepack pnpm exec playwright test tests/e2e/post.spec.ts --grep "Giscus follows theme"` 为 `1 passed`。原有加载失败降级测试仍在默认套件中通过。

## 视觉快照

- 更新命令：`corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots`
- 结果：`21 passed`；首页、文章、归档、分类、标签、作品和 404 的桌面、平板、手机基线全部更新。
- 人工检查：先看首页三种完整快照，再把 21 张快照底部 500 px 组成三张临时拼图。播放器在所有路线和视口中都位于页脚之后，未遮挡正文、侧栏或页脚。临时拼图未加入仓库。

## 完整验证

| 命令 | 结果 |
| --- | --- |
| `corepack pnpm test:run` | 7 files，47 tests passed |
| `corepack pnpm check` | 65 files，0 errors，0 warnings，0 hints |
| `corepack pnpm build` | 图片预检 254/254；80 pages built |
| `corepack pnpm check:site` | 4653 local links；15673261 output bytes |
| 搜索 JSON 产物扫描 | 40 documents；0 documents with HTML markup |
| `corepack pnpm test:e2e` | 最终复跑 59 passed |
| `git diff --check` | 通过；仅显示 Windows CRLF 提示 |

## 文档同步

- `README.md`：说明空歌单与非空歌单的布局差异，以及合法链接总量变化后的维护步骤。
- `AGENTS.md`：记录相同的播放器约束和 4653 条链接库存规则。
- 设计文档：明确空歌单播放器位于页脚后的普通文档流。

## Concerns

- `EXPECTED_LOCAL_LINKS = 4653` 是刻意维护的库存。合法新增或删除页面、导航项后，需要核对产物并更新该值。
- 构建和 E2E 仍会显示已有的 Astro Markdown 配置弃用提示、空 `projects` collection 提示和大 chunk 提示。本轮没有扩大这些问题，完整门禁均通过。
