# 本地验证与 CI 排查

本文记录测试、构建和站点检查的执行边界。具体测试数量、页面数量、远程图片数量和站内链接总数以当前命令输出及测试源码为准，不在文档中复制易过时的数字。

## 验证范围

- 日常本地修改只完成修改，不自动运行测试、类型检查、构建、图片与安全检查、浏览器预览或其他验收。
- 用户明确要求推送时，统一执行下文的推送门禁，并按改动选择必要的类型检查、浏览器和专项验证。
- 推送前涉及安全边界、构建发布或跨页面公共逻辑时，选择能覆盖风险的检查范围。提前说明是进度通知，不表示等待批准。
- 不自动安装浏览器，也不默认运行全量 E2E 或视觉回归。用户明确要求，或风险确有需要时再运行。

本地预览统一使用：

```powershell
corepack pnpm astro dev --background --host 127.0.0.1 --port 4321
corepack pnpm astro dev status
```

推送前需要预览，或用户明确要求本地预览时，先请求 `http://127.0.0.1:4321/`，确认是否已有本项目服务；有则复用，无则启动并再次以 HTTP 响应确认。`status` 仅作辅助，不使用其他端口，不重复启动。纯文档或测试文件修改不启动预览。

## 常用命令

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:protected
corepack pnpm check:site
corepack pnpm test:e2e
```

`build` 已包含图片预检和加锁内容泄漏审计。图片检查需要访问 jsDelivr；`build` 和 `check:images` 会启用 Node 24 的环境代理支持，本机提供标准 `HTTPS_PROXY` 即可。

## 推送前检查

明确双击 `push-posts.cmd` 时，跳过本地测试与构建，直接提交并推送博客、随笔、秘境三个私有仓库的全部未提交改动及已有待推送提交；脚本会拒绝合并冲突或与远端分叉的本地提交。站点的 GitHub Actions 在推送后执行检查。此流程不推送公开仓库。

除上述私有仓库快捷流程外，用户明确要求推送时，必须依次通过：

1. `corepack pnpm test:run`
2. `corepack pnpm build && corepack pnpm check:site`

不要依赖 CI 发现本地可复现的失败。没有推送请求时不自动运行验收，相关检查积累到推送前统一执行。

## 依赖版本兼容

当前 `astro check` 不支持 TypeScript 7，`package.json` 和锁文件保持 TypeScript 6。`.github/dependabot.yml` 暂时忽略 TypeScript `>=7.0.0` 的升级；确认 Astro 类型检查工具支持后再移除此限制，不能通过跳过类型检查接收升级。

## 生产依赖审计

`pnpm-workspace.yaml` 只忽略 `GHSA-ch52-4w7c-c8xp`。该公告影响共享 HTTP 缓存，当前没有修复版本；本站只在 Astro 静态构建阶段引入相关包，Pages 产物不运行共享缓存服务。

Astro 解析到修复版 `http-cache-semantics` 后删除此项豁免。不得使用 `--ignore-unfixable`、降低审计等级或增加无关 GHSA。

若本机镜像 registry 不提供 audit 端点，使用一次性命令 `corepack pnpm audit --prod --audit-level high --registry=https://registry.npmjs.org` 访问官方接口，不修改全局 registry。

## 远程图片审计

`check:site` 扫描构建产物中所有 HTML 的 `<img src>`，不在 jsDelivr 固定 commit 白名单内的外部域名会报错。

- 外部 URL 不得直接写入 Astro 模板的 `src`；放在 `data-*` 属性中，由客户端脚本赋值。
- 已知可信且只用于特定页面的来源，应在 `scripts/check-built-site.ts` 的 `imageSourceErrors` 中按路由豁免，不放宽全局白名单。
- 视觉差异只出现在含远程图片的文章时，先检查 `reports/image-check.json`。临时网络失败恢复后重跑 `check:images`，清理项目内 `.astro/` 与 `node_modules/.astro/data-store.json`，再执行 `astro sync`；不要直接更新视觉基线。

## 站内链接计数

`EXPECTED_LOCAL_LINKS` 同时存在于 `scripts/check-built-site.ts` 和 `tests/unit/check-built-site.test.ts`，修改时必须同步。

计数脚本扫描所有构建 HTML 中的 `href=` 和 `src=`，过滤站外地址后累加。导航、页脚和公共组件会在每个页面重复计入，因此结构变化可能放大增量。

只在明确发生了链接节点增删时更新基线。按以下机械流程执行，不需要再次向用户确认：

1. 运行 `corepack pnpm build && corepack pnpm check:site`。
2. 确认失败来自预期的结构变化，而不是缓存、私有内容数量或临时构建差异。
3. 以日志第一行 `Checked N local links` 的稳定本地结果更新脚本和单元测试两处。
4. 重跑 `test:run` 与 `check:site`。

不要仅根据一次 CI 的 `found N` 修改基线。

## 相关代码与 fixture

- 推送涉及新增或修改动态路由时，运行 `corepack pnpm check`，确认 `getStaticPaths`、frontmatter 变量和模板引用没有类型错误。
- 修改 `src/config/navigation.ts` 的路径或标签时，同步检查 `tests/unit/navigation-config.test.ts`。
- 修改 `src/scripts/music-player.ts` 的逻辑或 DOM 结构，或修改 `src/components/MusicPlayer.astro` 的 data 属性时，同步检查 `tests/unit/music-player.test.ts` 的 fixture 与断言。
- 脚本新增 `player.style`、`panel.style` 等 DOM 属性访问时，测试 fixture 的模拟对象也要提供对应属性。
- `source-contains` 断言必须与源码字符串一致；不要为了让断言通过而保留已经失真的实现文本。

`tests/unit/` 中部分测试会故意构造违规 Markdown。日志出现“包含原始 HTML 图片”或 `forbidden raw HTML tag`，并指向 `/tmp/` 或 `/E:/post.md` 时，属于拒绝行为测试的预期输出。

秘境公开测试目录包含一张真实 PNG，构建会验证它没有被 Astro 复制进 `dist/_astro/`。保护加载器必须保留原始正文，同时阻止原生 Markdown 模块和图片资产登记；内联与引用式图片都通过加密渲染器及泄漏审计。

## 站点统计

`bindSiteStats()` 在 `showClock={false}` 时不会渲染 `canvas` 或 `time`。`visitors.setAttribute('data-visitor-count', '')` 必须在时钟元素检查之前执行；没有时钟时单独调用 `synchronizeVisitorCount()` 后返回，不能把访客数同步与时钟节点绑在同一个 guard 上。
