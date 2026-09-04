# 项目规则

这是 `https://hatrix.site` 的 Astro 纯静态站点。Node 版本固定为 24，包管理器使用 Corepack 管理的 pnpm。

## 常用命令

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:protected
corepack pnpm check:site
corepack pnpm test:e2e
```

`build` 已包含图片预检和加锁内容泄漏审计。图片检查需要访问 jsDelivr；`build` 和 `check:images` 会自动启用 Node 24 的环境代理支持，本机只需提供标准的 `HTTPS_PROXY` 配置。

## 目录边界

- `.private-content/posts/`：40 篇已发布文章，公开路径由 `legacySlug` 生成。`.private-content/` 是独立的私有 Git 仓库；公开仓库不跟踪文章 Markdown。
- `.env.local`：本机 `HATRIX_ADMIN_KEY`，至少 8 个字符；文件已忽略，禁止提交、分享或复制到任何内容仓库。
- `src/drafts/`：两篇草稿，不加入 Content Collection，不生成页面。
- `src/content/projects/`：允许为空的作品集合。
- `src/data/playlist.ts`：允许为空的音乐列表。
- `src/config/navigation.ts`：主导航、文章类型链接和关于子页链接的唯一来源。
- `src/config/site.ts`：域名、作者、社交链接、Giscus 和站点验证信息。
- `src/pages/`、`src/layouts/`、`src/components/`：路由和页面结构。
- `scripts/`：图片预检与构建产物检查，不放一次性迁移脚本。
- `public/CNAME`：自定义域名唯一来源；构建后应复制到 `dist/CNAME`。
- `tests/unit/`、`tests/e2e/`：Vitest、Playwright 和视觉基线。

## 稳定约束

- 保持纯静态输出，不增加服务器、数据库、上传、下载中心或对象存储。
- 保留全部 `/posts/<legacySlug>/` 路径和 Giscus pathname 映射。
- 已发布文章只在 `.private-content/posts/` 中编辑、提交和 push。禁止把文章、加锁正文图片或其他私密资源复制回公开仓库。文章正文属于用户内容，除非任务明确要求，不改写正文；schema 调整也要保持旧 URL。
- `draft` 和 `locked` 省略时均为 `false`。`draft: true` 不生成页面；`draft: false, locked: true` 只公开 metadata、Hero 和封面，正文与正文图片必须输出密文。
- 加锁正文图片必须使用 `.private-content/posts/` 内文件的 Markdown 相对路径。禁止远程/data URL、站点根绝对路径、越界路径和原始 HTML `<img>`；加锁文章的 `cover` 仍是公开资源。
- 主导航固定为首页、博客文章、作品橱窗、关于我和留言板；博客文章与关于我在桌面端使用横向二级菜单。文章 `type` 只能是 `技术笔记|踩坑记录|生活动态|好物推荐|随笔杂谈`，用于文章类型页，不得作为旧分类或标签 taxonomy 恢复。
- `series` 与 `seriesOrder` 必须成对出现。
- 作品状态只能是 `idea|active|done|archived`。作品与歌单为空是合法状态，不填演示数据。空歌单播放器位于普通文档流，只有非空歌单才固定在页面右下角。
- 已发布文章中的 Hatrix 图床 URL 必须固定到不可变 commit；新增同源图片也要带 `@<commit>`。更换 ref 时，同时更新 `astro.config.ts` 的精确 `/img/**` remote pattern 和 inventory 测试。文章列表题图走 Astro/Sharp，正文远程图片经过构建预检后保留 CDN 地址，并使用 lazy/async 属性。草稿不参与 inventory。
- Playwright 有 143 项检查和 18 张 Windows 视觉基线，命名不含平台后缀。Pages workflow 不运行视觉套件。
- 首页保留大尺寸 Hero。所有非首页普通 Hero 与文章题图在同一视口下等高：桌面和平板为 `240px`，宽度不超过 `768px` 时为 `200px`；全站不渲染波浪分隔。
- 当前页脚只显示版权与“保留所有权利”纯文本，不提供第三方许可入口；`public/third-party-notices.txt` 仍随构建产物发布。只有配置真实备案信息后才允许增加法规要求的备案链接。
- Sakana 的许可和素材来源告知固定在 `public/third-party-notices.txt`，构建后必须复制到 `dist/third-party-notices.txt`。内置千束与泷奈插画只用于非商业网页；站点用途或依赖版本变化时必须重新核对授权。
- 若视觉差异只出现在含远程图片的文章，先核对 `reports/image-check.json`。临时失败恢复后应重跑 `check:images`、清理 `.astro` 并执行 `astro sync`，不要直接更新视觉基线。
- `check:images` 负责远程图片，`check:protected` 负责 `dist/` 明文与原资源泄漏。保护审计或密文测试失败时先找泄漏根因，不得放宽检查、替换期望密文或直接更新密文基线。
- 生产构建生成的 `.astro/` 是带密构建状态，可能包含私有文章正文、渲染 HTML 和源路径，不得缓存、上传或提交；生产 workflow 必须在上传产物前删除它。
- 主题切换继续使用 `hatrix-theme`，并同步 Giscus。全屏动效由 `ThemeTransition.astro` 和 `theme.ts` 管理；减少动态效果时必须直接切换，不能显示过渡层。Giscus 深色主题源码位于 `src/styles/giscus-dark.css`：开发环境内联，生产构建输出带 hash 的 HTTPS CSS；不要用宿主页面 CSS 覆盖 iframe 内部样式。
- 生产 CSP 和 Referrer Policy 的唯一来源是 `src/config/security.ts`。新增第三方脚本、框架、远程图片或媒体来源时，必须同时更新策略、构建产物测试和生产预览取证，不能只放宽 `default-src`。
- 已发布 Markdown 由 `remark-content-security.ts` 拒绝可执行原始 HTML、危险 URL、任意 `srcset` 和未固定的远程图片；原始 `style` 只允许单条 `zoom: <正整数>%`。不要用 sanitizer 静默改写正文。
- Pages workflow 的 Action 固定到完整 commit SHA，checkout 不保留凭据，手动发布只能来自 `master`；升级 Action 时同步更新版本注释和配置测试。
- `check:site` 固定校验 3961 条站内链接。新增或删除内容导致总量合理变化时，核对构建产物后同步更新 `scripts/check-built-site.ts` 中的期望值。
- 未来的 3D 功能使用独立客户端岛并延迟加载，不把 3D 依赖放进公共布局。

## 禁止事项

- 不恢复 Ruby、旧主题目录或一次性迁移脚本。
- 不恢复根目录 `CNAME`；只修改 `public/CNAME`。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/` 或 Playwright trace。
- 不提交 `.env.local`、`.private-content/` 或其中任何私密内容。
- 未经用户明确要求，不推送、合并、部署或修改远端 Pages 设置。
- 不复制参考站源码、文案或个人资产。
- 每次完成项目改动后，自动启动本地开发预览，并在最终回复中提供可 Ctrl+点击的 `http://127.0.0.1:4321/` Markdown 链接。除非用户明确要求停止，预览保持运行。

## 深入文档

- `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md`：范围、架构、内容模型与验收标准。
- `docs/superpowers/plans/2026-09-01-astro-blog-rebuild.md`：任务拆分、测试设计和实现顺序。
- `docs/superpowers/specs/2026-09-02-theme-transition-design.md`：日夜切换动效、无障碍和性能边界。
- `docs/superpowers/plans/2026-09-02-theme-transition.md`：主题切换动效的实现与验证记录。
- `docs/superpowers/specs/2026-09-03-remove-taxonomy-design.md`：删除文章分类与标签后的架构约束。
- `docs/superpowers/plans/2026-09-03-remove-taxonomy.md`：分类与标签删除步骤和验证记录。
- `docs/superpowers/specs/2026-09-03-navigation-content-hubs-design.md`：主导航、内容类型页、关于子页和留言板设计。
- `docs/superpowers/plans/2026-09-03-navigation-content-hubs.md`：导航内容中心的实施与验证记录。
- `docs/superpowers/specs/2026-09-03-non-home-banner-design.md`：非首页 Banner 高度、文章信息布局和波浪边界。
- `docs/superpowers/plans/2026-09-03-non-home-banner.md`：非首页 Banner 压缩的测试与实施步骤。
- `docs/superpowers/specs/2026-09-03-cursor-trail-design.md`：侧栏鼠标尾迹的区域、动画和性能边界。
- `docs/superpowers/plans/2026-09-03-cursor-trail-activation-regions.md`：鼠标尾迹正文高度门控和区域切换步骤。
- `docs/superpowers/specs/2026-09-03-horizontal-post-rail-design.md`：横向文章栏、博客视图切换和无 JavaScript 降级设计。
- `docs/superpowers/plans/2026-09-03-horizontal-post-rail.md`：横向文章栏的实施与验证记录。
- `docs/superpowers/specs/2026-09-03-compact-legal-footer-design.md`：极简法律页脚和备案信息边界。
- `docs/superpowers/plans/2026-09-03-compact-legal-footer.md`：法律页脚的实施与验证记录。
- `docs/superpowers/specs/2026-09-03-security-hardening-design.md`：仓库安全策略、内容边界和 Cloudflare 分阶段方案。
- `docs/superpowers/plans/2026-09-03-security-hardening.md`：仓库安全加固的测试与实施步骤。
- `docs/superpowers/specs/2026-09-03-protected-content-design.md`：私有内容仓库、SSR 加密、浏览器凭据、部署与安全边界。
- `docs/superpowers/plans/2026-09-03-protected-content.md`：加锁内容的任务拆分和验证记录。
