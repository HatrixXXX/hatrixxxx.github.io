# Hatrix Blog

这是 `https://hatrix.site` 的 Astro 源码。站点采用纯静态输出，文章、索引页、RSS 和站点地图都在构建期生成，发布产物位于 `dist/`。

## 开发环境

- Node.js 24，版本记录在 `.node-version`
- Corepack
- pnpm，依赖版本由 `pnpm-lock.yaml` 锁定

首次安装：

```powershell
corepack enable
pnpm install --frozen-lockfile
```

如果当前环境没有生成 `pnpm` 命令，可把命令中的 `pnpm` 换成 `corepack pnpm`。

## 常用命令

```powershell
pnpm dev
pnpm test:run
pnpm check
pnpm check:images
pnpm build
pnpm check:protected
pnpm check:site
pnpm test:e2e
```

`pnpm build` 会依次运行远程图片预检、生成静态站点并执行加锁内容泄漏审计。只想检查图片时，可单独运行 `pnpm check:images`；检查现有 `dist/` 时用 `pnpm check:protected`。`build` 和 `check:images` 会自动启用 Node 的环境代理支持；本机需要代理联网时，保留标准的 `HTTPS_PROXY` 配置即可。

## 内容目录

- `.private-content/posts/`：已发布文章。`.private-content/` 是独立的私有 Git 仓库，整个目录由公开仓库忽略
- `src/drafts/`：不参与构建的草稿
- `src/content/projects/`：作品集合，目录可以为空
- `src/data/playlist.ts`：音乐列表
- `public/`：CNAME、favicon、头像和本地静态资源

私有内容仓库有 40 篇已发布文章，公开仓库不跟踪任何已发布文章的 Markdown。公开仓库另有 2 篇草稿；一次完整构建会生成 67 个 HTML 页面。

私有仓库的目标远端是 `HatrixXXX/hatrix-content`。下面是约定结构示例，`assets/` 按需创建：

```text
.private-content/
├─ .github/
│  └─ workflows/
│     └─ notify-site.yml
└─ posts/
   ├─ example.md
   └─ assets/
      └─ private-image.png
```

## 首次接入私有仓库

如果沿用迁移阶段生成的本地 `.private-content/`，它已经是独立 Git 仓库。迁移过程不会创建 GitHub 仓库；现有 `origin` 也可能仍指向临时 worktree。先在 GitHub 创建私有仓库 `HatrixXXX/hatrix-content`，再检查并修正 remote：

```powershell
git -C .private-content remote -v
# 没有 origin 时使用 remote add；已有临时 origin 时使用 remote set-url
git -C .private-content remote set-url origin git@github.com:HatrixXXX/hatrix-content.git
git -C .private-content push -u origin master
```

如果 `remote -v` 没有任何输出，把上面的 `remote set-url` 改成 `remote add`。确认内容已经推到 GitHub 后，才能删除保存迁移仓库的旧 worktree。

新电脑克隆公开站点后，改为把私有仓库检出到被忽略的目录：

```powershell
git clone git@github.com:HatrixXXX/hatrix-content.git .private-content
```

在公开站点工作区根目录手动创建 `.env.local`：

```dotenv
HATRIX_ADMIN_KEY=<至少八字符的本机值>
```

`.env.local` 已加入 `.gitignore`。管理员 key 不得提交、写进文章或文档、发到聊天中，也不要放进私有内容仓库。它至少需要 8 个字符；本机值应与公开仓库 Actions Secret 中的 `HATRIX_ADMIN_KEY` 一致。

## 站点导航

主导航依次为首页、博客文章、作品橱窗、关于我和留言板。博客文章与关于我在桌面端使用横向二级菜单；`/blog/` 是全部文章索引，`/blog/<type>/` 按文章类型筛选。关于子页目前是占位页，`/guestbook/` 使用 Giscus 保存留言。

首页保留大尺寸题图。其他页面的顶部图片统一为桌面和平板 `240px`、手机 `200px`，所有题图直接衔接正文，不再使用波浪分隔；文章摘要和发布时间等信息位于题图下方。

页脚只保留版权和“保留所有权利”说明文字，不显示第三方许可链接。许可文件仍发布在 `/third-party-notices.txt`。

关于页、关于子页和文章页使用共享侧栏，依次显示作者资料、站点统计和音乐播放器；首页、博客列表、归档、作品、留言板和 404 不显示。访客数由生产环境的 `https://events.vercount.one/js` 提供，开发和测试环境不请求该服务；加载失败时只保留 `—`，不影响页面内容。

## 新增文章

在 `.private-content/posts/` 新建 Markdown 或 MDX 文件。文件名不决定公开地址，路由由 `legacySlug` 生成。完整 frontmatter 如下：

```yaml
---
title: 示例文章
description: 用一句话说明文章内容
pubDate: 2026-09-02
updatedDate: 2026-09-03
cover: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/example.png
type: 技术笔记
series: Astro 实践
seriesOrder: 0
draft: false
locked: false
math: false
mermaid: false
legacySlug: 示例文章
---
```

`type` 必填，只能是 `技术笔记`、`踩坑记录`、`生活动态`、`好物推荐` 或 `随笔杂谈`，用于生成 `/blog/<type>/` 类型页，不是已删除的旧分类或标签 taxonomy。`updatedDate` 可省略。`series` 和 `seriesOrder` 必须同时填写或同时省略，`seriesOrder` 是非负整数。`draft` 和 `locked` 省略时都按 `false` 处理，建议在文章里明确写出。

| `draft` | `locked` | 结果 |
| --- | --- | --- |
| `false` | `false` | 发布公开正文 |
| `false` | `true` | 发布公开元数据、封面和解锁外壳，正文与正文图片加密 |
| `true` | `false` 或 `true` | 不生成页面 |

加锁文章的标题、摘要、日期、类型、阅读时间、URL 和 `cover` 都是公开信息。封面可以继续使用带不可变 commit 的 jsDelivr URL。加锁正文图片必须保存在 `.private-content/posts/` 内，并用 Markdown 相对路径引用，例如：

```markdown
![示意图](./assets/private-image.png)
```

加锁正文不能使用远程图片、data URL、站点根绝对路径或原始 HTML `<img>`；这些写法会让构建失败。公开文章的远程正文图片继续遵守下方的图床固定提交和 inventory 规则。

文章改完后，只在私有仓库中提交并 push，不需要为文章改动提交公开仓库：

```powershell
git -C .private-content status
git -C .private-content add posts
git -C .private-content commit -m "content: update posts"
git -C .private-content push
```

不要把文章、加锁正文图片或其他私密资源复制回公开仓库。

## 新增作品

如果 `src/content/projects/` 不存在，先创建该目录，再添加 Markdown 或 MDX 文件。作品 frontmatter 的完整示例：

```yaml
---
title: 示例作品
description: 作品解决的问题和目前进度
status: active
cover: /images/default-cover.svg
tech:
  - Astro
  - TypeScript
links:
  - label: 源码
    url: https://github.com/HatrixXXX/example
featured: false
order: 10
---
```

`status` 只能是 `idea`、`active`、`done` 或 `archived`。`cover` 可省略；`tech`、`links`、`featured` 和 `order` 有默认值，但建议在内容文件里写清楚。集合为空时，作品页显示空状态。

## 添加音乐

在 `src/data/playlist.ts` 中加入符合 `Track` 类型的数据：

```ts
import type { Track } from '../types/content';

export const playlist: readonly Track[] = [
  {
    id: 'example-track',
    title: '曲名',
    artist: '作者',
    src: '/audio/example.mp3',
    cover: '/images/example-cover.webp'
  }
];
```

`id`、`title`、`artist` 和 `src` 必填，`cover` 可省略。播放器是关于页、关于子页和文章页共享侧栏的第三张卡片，不使用固定定位。播放列表为空时不会创建 `Audio` 对象，也不会请求音频文件。

## 图片策略

文章共引用 254 个去重后的 jsDelivr 图片 URL。现有发布文章全部固定到图床仓库提交 `85bc7b2b63bcf294f1079a98edf79ee1c9f41606`，不会随默认分支删改而漂移。新增文章引用同一图床时也必须使用带 `@<commit>` 的不可变 URL；如果改用新提交，要同时更新 `astro.config.ts` 的精确 `/img/**` 规则和图片 inventory 测试。

构建会检查这些地址，并把结果写到忽略提交的 `reports/image-check.json`：题图失败会终止构建，正文位图失败时会改用本地占位图并保留原地址。两篇 `src/drafts/` 草稿不参与发布和图片 inventory，因此没有机械改写其中的历史链接。

文章列表的 `cover` 由 Astro 的图片管线和 Sharp 生成 WebP、`srcset` 与尺寸信息。正文远程图片通过预检后仍使用 CDN 地址，并输出 `loading="lazy"` 和 `decoding="async"`；GIF 和 SVG 不做有损转换。

## 加锁内容

加锁发生在 Astro 服务端渲染期间，不是构建完成后的 HTML 替换。`ProtectedContent.astro` 读取 `HATRIX_ADMIN_KEY`，用公开的固定盐和 Argon2id 派生 AES-256-GCM key，然后直接加密渲染后的 slot。正文图片由 `/protected-content/assets/<id>.bin` 静态端点分别加密。实现没有随机 DEK 或 key envelope；页面、资源和 verifier 都直接使用同一个派生 key，并各自使用随机 IV 和不同 AAD。

浏览器只拿到公开 metadata、解锁外壳、KDF 参数和密文。正确解锁后，页面 HTML 在内存中挂载，图片解密为 Blob URL。原始 key 不会保存；浏览器在 IndexedDB 中保存不可导出的 AES `CryptoKey`，session 模式用 `sessionStorage` 引用，勾选“7 天免解锁”后用带到期时间的 `localStorage` 引用。凭据只对同一浏览器资料有效。

key 输入框使用 `autocomplete="off"`，但浏览器或扩展是否保存、自动填写 key 不受站点控制。

解锁界面会区分空输入、验证中、错误 key、密文损坏和网络失败。错误 key 前两次没有额外等待，第 3 次等待 5 秒、第 4 次 15 秒、第 5 次 60 秒，之后每次 5 分钟；冷却保存在 `localStorage`，刷新后仍在。成功解锁会清除失败计数。页头的“退出管理员身份”会删除 session 和七天凭据、清空 IndexedDB、撤销 Blob URL，并重新锁住当前页面。

纯静态方案不能阻止别人下载密文后离线猜测 key，前端冷却也可以被绕过。不可导出的 `CryptoKey` 不能防住恶意扩展、设备恶意软件或读取已解锁 DOM 的脚本。不要用这套功能保存真正敏感的信息。

### 更换管理员 key

同时修改本机 `.env.local` 和公开仓库 Actions Secret `HATRIX_ADMIN_KEY`，然后手动运行公开仓库 Pages workflow 或推送公开代码，重新生成全部加锁产物。旧浏览器凭据在下一次读取新 manifest 时验证失败并被清除，旧 key 也无法解密新产物。

如果 key、固定盐、Argon2id 参数和格式版本都没变，普通内容更新和重新构建不会让现有浏览器凭据失效，即使新密文因随机 IV 而不同。已经下载或缓存的旧密文无法从静态站追溯删除；知道旧 key 的人仍可能解密旧副本。

## 测试矩阵

| 命令 | 检查内容 |
| --- | --- |
| `pnpm test:run` | 内容 schema、旧文章 URL、排序分页、图片和构建检查脚本 |
| `pnpm check` | Astro 与 TypeScript 诊断 |
| `pnpm check:images` | 254 个去重后的远程图片 URL |
| `pnpm build` | 图片预检、67 页静态构建与加锁内容泄漏审计 |
| `pnpm check:protected` | 现有 `dist/` 的加锁正文、资源、索引和 sitemap 泄漏审计 |
| `pnpm check:site` | 旧文章路由、CNAME、4102 条站内链接和发布体积 |
| `pnpm test:e2e` | Chromium 的桌面、平板和手机检查，共 154 项；其中 18 张视觉快照在 Windows 生成，文件名不含平台后缀 |

Pages workflow 不运行视觉套件，避免 Linux 渲染差异改写 Windows 基线。合并前仍应在 Windows 本地运行 `pnpm test:e2e`。

新增或删除页面、导航项等内容后，如果站内链接总量发生了合理变化，先核对构建产物，再同步更新 `scripts/check-built-site.ts` 中的期望值；未更新时 `pnpm check:site` 会失败。

## 安全边界

生产页面通过 HTML CSP 限制脚本、框架、图片和其他资源来源，并使用 `strict-origin-when-cross-origin` Referrer Policy。CSP 只在生产构建输出，开发服务器仍使用 Vite HMR。Argon2 由 `hash-wasm` 执行，因此策略只为 WebAssembly 编译保留 `'wasm-unsafe-eval'`，不允许通用 `'unsafe-eval'`。生产环境额外允许经过审计的 Vercount 脚本 `https://events.vercount.one/js`；构建检查仍按完整 URL 拒绝同源下的其他脚本。新增第三方脚本、框架、远程图片或媒体来源时，先更新安全策略和构建产物测试，不能只放宽 `default-src`。

已发布 Markdown 会在构建期拒绝可执行原始 HTML、事件属性、危险 URL scheme 和未固定的远程图片。检查失败时修改内容或明确更新允许边界，不要用 sanitizer 静默删除正文。

GitHub Pages 无法由仓库配置 HSTS、`nosniff`、`frame-ancestors`、WAF、限流或可控 DDoS 防护。这些项目留给后续 Cloudflare 阶段；当前流量仍由 DNSPod 直接指向 GitHub Pages。

Pages workflow 的 Action 必须固定到完整 commit SHA，checkout 不保留凭据，手动部署只能使用 `master`。升级 Action 时同时更新版本注释和项目配置测试。

## 部署

`.github/workflows/pages-deploy.yml` 支持四种入口：

- 私有仓库 `master` push：`notify-site.yml` 发送 `content-updated` 和完整 `github.sha`。公开 workflow 校验 SHA，检出这个精确的内容提交，并核对实际 `git rev-parse HEAD` 后构建和部署。
- 公开仓库 `master` push：检出私有仓库默认分支当时的 HEAD，记录实际完整 SHA，再构建和部署。
- 手动运行公开 workflow：同样读取私有仓库默认分支当时的 HEAD，记录实际完整 SHA，再构建和部署。
- 公开仓库 pull request：只使用 `tests/fixtures/private-content` 和测试 key 运行单元测试、Astro check、build 与 fixture 模式的 `check:site`，不读取生产 Secret、正式私有仓库，也不部署。

生产构建或检查失败时，deploy job 不会运行，线上仍保留上一个 Pages 版本。自定义域名写在 `public/CNAME`，Astro 构建后必须原样出现在 `dist/CNAME`。

生产构建生成的 `.astro/` 是带密构建状态，里面可能有私有文章正文、渲染 HTML 和源路径，不得缓存、上传或提交。Pages workflow 在上传 `dist/` 前会删除它。

GitHub 需要三个 Secret，值不得写进仓库：

| Secret | 仓库 | 最小用途和权限 |
| --- | --- | --- |
| `HATRIX_ADMIN_KEY` | `HatrixXXX/hatrixxxx.github.io` | 构建加密使用；不是 token，至少 8 个字符 |
| `HATRIX_CONTENT_TOKEN` | `HatrixXXX/hatrixxxx.github.io` | fine-grained token，只授权 `HatrixXXX/hatrix-content` 的 Contents read |
| `HATRIX_SITE_DISPATCH_TOKEN` | `HatrixXXX/hatrix-content` | fine-grained token，只授权公开站点仓库的 Contents read/write，用于创建 `repository_dispatch` |

Giscus 深色主题源码位于 `src/styles/giscus-dark.css`。本地开发时，主题以内联 data URL 注入 iframe；生产构建会输出带 hash 的 HTTPS CSS。亮色模式继续使用 Giscus 内置的 `light` 主题。修改评论区配色时只改主题文件。

不要恢复根目录 `CNAME`，也不要提交 `.env.local`、`.private-content/`、`dist/`、`.astro/`、`reports/` 或 Playwright 运行产物。

## 构建失败排查

先区分图片预检和保护审计：

- `pnpm check:images` 检查 jsDelivr inventory 和远程地址，把结果写入 `reports/image-check.json`。如果视觉差异只发生在含远程图片的文章，先看报告。网络恢复后重跑 `pnpm check:images`，删除忽略目录 `.astro/`，执行 `pnpm exec astro sync`，再运行构建或视觉测试。不要用 inventory 或视觉基线更新掩盖远程图片失败。
- `pnpm check:protected` 检查现有 `dist/` 是否含加锁正文片段、原图片字节、原文件名、错误的索引规则或 sitemap URL。加锁正文使用远程图片、绝对路径或越界相对路径时，Astro 渲染会先失败。修正文或加密边界；不要放宽审计、替换期望密文，或把泄漏输出当成新基线。

生产构建还可能因 `.private-content/posts/` 缺失、`HATRIX_ADMIN_KEY` 未配置或不足 8 个字符、schema 错误、私有 token 权限不足而停止。排查 Secret 时只确认名称、所在仓库和授权范围，不要打印值。

## 后续 3D 页面

Three.js、Babylon.js 等 3D 依赖不能进入公共布局或普通页面的首屏脚本。新增 3D 功能时，把它放在独立客户端岛中，并在组件进入视口或用户操作后延迟加载。

## 许可证

当前站点源码与文章未另行授予开源许可；历史 Chirpy 许可和来源可从 Git 历史追溯。

本站使用 `sakana@1.0.8` 显示千束和泷奈。代码许可、上游元数据冲突、画师来源及插画非商业使用条件见 [`public/third-party-notices.txt`](public/third-party-notices.txt)。只要站点继续分发这两张插画，就必须保持非商业用途。
