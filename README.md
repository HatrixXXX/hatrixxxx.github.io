# Hatrix Blog

这是 `https://hatrix.site` 的 Astro 源码。站点采用纯静态输出，文章、索引页、RSS 和站点地图都在构建期生成，发布产物位于 `dist/`。

文档入口见 [docs/README.md](docs/README.md)，包含现行规则和历史设计记录的阅读说明。

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
- `.private-snippets/snippets/`：随笔 Markdown。`.private-snippets/` 是另一个私有 Git 仓库，由公开仓库忽略
- `src/content/projects/`：作品集合；填写规则见[新增作品](#新增作品)
- `src/data/playlist.ts`：音乐列表
- `public/assets/`：网站图片、图标、纹理、光标和音频；首页原图与人物分块源图也在此目录
- `public/`：CNAME、manifest 和第三方告知等站点根文件

公开仓库不跟踪任何已发布文章或随笔的 Markdown。文章和随笔通过校验后都会生成页面；具体内容数和页面数以私有仓库及当前构建结果为准。

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

## 随笔内容

随笔保存在私有仓库 `HatrixXXX/hatrix-snippets`，本机目录为 `.private-snippets/`。新电脑上克隆站点后，再把该仓库克隆到站点根目录：

```powershell
git clone https://github.com/HatrixXXX/hatrix-snippets.git .private-snippets
```

在 `.private-snippets/snippets/` 中新建 Markdown 文件。文件名会转为 URL slug，作为 `/snippets/<slug>/` 的路径；frontmatter 必填 `title` 和仅含日期的 `date`（如 `2026-10-12`），可选 `description` 和 `cover`。封面图放在公开站点的 `public/` 内，`cover` 写站点根路径，例如 `/assets/images/snippets/wallpaper.webp`。远程图片地址不能直接作为封面。

随笔总览和每篇详情使用现有 `HATRIX_ADMIN_KEY` 解锁。标题、摘要、日期、正文和 Markdown 相对图片进入加密产物；正文图片应保存在 `.private-snippets/snippets/` 内。随笔 URL 和放在 `public/` 下的封面仍可公开访问，封面不要放需保密的图片。

内容提交并推送到随笔仓库的 `master` 后，`notify-site.yml` 会发送 `snippets-updated` 和完整提交 SHA，触发公开站点构建部署；该仓库需配置 `HATRIX_SITE_DISPATCH_TOKEN`。公开站点的 `master` 推送和手动运行也会读取随笔仓库的最新提交。生产工作流使用只读 deploy key 和站点仓库 Secret `HATRIX_SNIPPETS_DEPLOY_KEY` 读取随笔，pull request 则使用空的测试目录。

## 站点导航

首页卡片对应根级路径：博客文章 `/blogs/`、作品橱窗 `/creation/`、关于我 `/about/`、随笔 `/snippets/`、收藏夹 `/favorites/`、工具箱 `/toolbox/`、计划 `/plans/`、资讯 `/digest/`、实验场 `/playground/`、友链 `/friends/`、留言板 `/guestbook/`。旧入口保留跳转。

博客文章详情返回 `/blogs/`。从随笔总览进入详情后，左上返回按钮回到总览的原滚动位置；直接打开详情时返回总览顶部。其余页面返回首页。

非首页主导航在顶部按视口居中，依次为首页、博客文章、作品橱窗、关于我、随笔、收藏夹、工具箱、计划、资讯、友链、留言板、实验场；宽度小于 `1200px` 时改用同顺序的折叠菜单。搜索按钮位于顶栏右侧，管理员退出图标紧邻其左侧，不影响导航居中。`/blogs/` 直接显示全部文章，`/blog/all/` 保留为兼容重定向。`/snippets/` 按日期展示随笔，没有随笔时显示空状态。工具箱按 `src/data/software-tools.ts` 的清单顺序显示软件卡片，桌面端每行 9 张，窄屏依次调整为 8、6、3 列。卡片显示软件名、统一透明背景的本地图标、用途短语和“软件”标记；悬停或键盘聚焦时在卡片上方显示完整介绍。`/guestbook/` 将 Twikoo 留言区放入 `public/assets/guestbook/terminal-frame.png` 的透明开口；页面固定在视口内，仅屏幕区域可以滚动，滚动条隐藏。

站内搜索支持普通文章的标题和正文。结果会显示命中片段并高亮关键词；点击后文章页会滚动到对应段落，段落背景短暂突出后渐变恢复。加锁文章不会进入公开搜索索引。

首页采用参考图的两侧透视卡片排布，中央展示透明角色立绘，位于背景之上、入口面板之下。`1920×1080` 画布按有效 CSS 视口等比缩放；超宽屏将左右两组移向屏幕边缘，组内排布保持不变，竖屏保留上下空白。`src/pages/index.astro` 用 `leftPanels` 定义左侧四角，用 `rightPanels` 定义右侧平面内矩形；右侧全部卡片共用父层的一次 `matrix3d` 投影，主要行列间隔为 12 个设计像素。首页没有滚动条，也不渲染普通导航栏、页脚或 Sakana。

左上以小图标提供站内搜索，中左保留等级圆环和 Hatrix 名称。左下的金句、播放器、友链、留言板与实验场共用仿射平面：金句与下排、三张小卡片彼此间隔 8 个设计像素，三张小卡片叠起后与高 289px 的播放器对齐。金句语料位于 `src/data/home-quotes.ts`，每 6 秒按随机轮次切换；长句自动缩小字号并保持单行，减少动态效果时取消切换动画。右上辉光管时钟每秒显示本地时间。博客卡片进入 `/blogs/`；随笔占分组左侧整高，右侧“效率提升”标题下方并排收藏夹和工具箱。右侧底部是计划和资讯，左下实验场仍进入 `/playground/`；计划和资讯暂为空状态；实验场在全站导航、搜索、返回按钮和内页背景下展示三维电子工作台。当前布局细节见 `DESIGN.md`，历史方案见[首页设计记录](docs/superpowers/specs/2026-09-25-home-dashboard-design.md)。

直接打开或刷新任意页面时，splash 覆盖到首屏图片、背景和字体加载结束；首页还等待人物分块与播放器布局。播放器布局另有 8 秒降级；人物图片实际加载失败时，不显示残缺立绘。

站内默认不能拖选文字，文章正文和输入、编辑控件例外。页面空白使用本站 `pointer.cur`，普通链接使用斜十字 `link.cur`；顶栏使用裁去透明边距的同款准星，备用指针保持全站正常尺寸。

主导航栏目页不显示 Hero 主标题或副标题栏，正文直接接在固定导航下方。博客页的文章卡片在导航栏下方居中，上下各留约 `16px`，基本占满剩余视口高度。归档、旧分页和 404 的紧凑 Hero 在桌面和平板高 `240px`、手机高 `200px`。文章详情以标题与元信息开头，不渲染题图横幅；全站不使用波浪分隔。

当前文章页启用页脚，显示版权、“保留所有权利”和站点统计；普通布局默认不显示页脚。版权区不显示第三方许可链接，许可文件仍发布在 `/third-party-notices.txt`。

`SidebarStack` 承载作者资料，站点统计由页面的 `showStats` 决定；当前关于页及其子页只显示作者资料。文章侧栏显示完整的二至四级目录和最近文章；宽屏下整个侧栏能放入可用视口时才固定，放不下时跟随页面滚动，不使用侧栏内部滚动。文章页滚动超过 `480px` 后显示右下角返回顶部按钮，减少动态效果时直接返回。音乐播放器独立于侧栏，在首页卡片中常驻，在所有非首页页面显示左侧唱片入口。访客数由生产环境的 `https://events.vercount.one/js` 提供，开发和测试环境不请求该服务；加载失败时只保留 `—`，不影响页面内容。

## 新增文章

在 `.private-content/posts/` 新建 Markdown 或 MDX 文件。文件名只写标题，不加日期前缀；它不决定公开地址，路由由 `legacySlug` 生成。完整 frontmatter 如下：

```yaml
---
title: 示例文章
summary: 介绍示例文章的主要内容。
pubDate: 2026-09-02
updatedDate: 2026-09-03
cover: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/example.png
locked: false
legacySlug: 示例文章
---
```

`summary` 必填，不超过 100 字，博客文章卡片直接显示它。随笔属于另一个集合，不使用这条博客文章规则。正文更新后检查摘要是否仍准确；只有主题、主要结论、覆盖范围或关键内容明显变化时才重写。`updatedDate` 和 `cover` 可省略，`locked` 省略时按 `false` 处理。未填写 `cover` 时，文章列表和社交元信息使用默认封面。数学公式与 Mermaid 图表由文章内容自动触发，不需要额外的 frontmatter 开关。

| `locked` | 结果 |
| --- | --- |
| `false` | 发布公开正文 |
| `true` | 发布公开元数据、封面和解锁外壳，正文与正文图片加密 |

加锁文章的标题、摘要、日期、阅读时间、URL 和 `cover` 都是公开信息。封面可以继续使用带不可变 commit 的 jsDelivr URL。加锁正文图片必须保存在 `.private-content/posts/` 内，并用 Markdown 相对路径引用，例如：

```markdown
![示意图](./assets/private-image.png)
```

加锁正文不能使用远程图片、data URL、站点根绝对路径或原始 HTML `<img>`；这些写法会让构建失败。公开文章的远程正文图片继续遵守下方的图床固定提交和 inventory 规则。

文章改完后，在私有仓库提交；用户要求推送时，再推送私有仓库。不需要为文章改动提交公开仓库：

```powershell
git -C .private-content status
git -C .private-content add posts
git -C .private-content commit -m "content: update posts"
```

要提交并推送博客、随笔、计划三个私有仓库的所有文件改动，可双击项目根目录的 `push-posts.cmd`。它会先检查三个仓库，再提交各仓库全部未提交改动，并推送有新提交的仓库；窗口会停留以便查看结果，需要本机安装 Git。脚本不运行本地测试或构建；存在合并冲突或本地分支与 `origin/master` 分叉时，会在推送前停止。计划仓库首次推送无需 `origin/master`。各私有仓库推送后由 GitHub Actions 通知站点构建部署。

要从远端更新这三个私有仓库，可双击项目根目录的 `pull-posts.cmd`。脚本逐个获取 `origin/master` 并仅作快进更新；有未提交或未跟踪文件、分支不符或提交分叉的仓库会跳过并显示原因，其余仓库继续处理。它不会自动暂存、覆盖本地文件、创建合并提交或推送，窗口会停留以便查看结果。

不要把文章、加锁正文图片或其他私密资源复制回公开仓库。

## 新增作品

如果 `src/content/projects/` 不存在，先创建该目录，再添加 Markdown 或 MDX 文件。作品 frontmatter 的完整示例：

```yaml
---
title: 示例作品
description: 作品解决的问题和目前进度
status: active
cover: /assets/project-images/example-cover.webp
coverAlt: 示例作品的实物照片
gallery:
  - src: /assets/project-images/example-01.webp
    alt: 从侧面拍摄的作品
    caption: 第一版样机
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

`status` 只能是 `idea`、`active`、`done` 或 `archived`。`description` 建议不超过 100 字；填写 `cover` 时必须填写 `coverAlt`。`cover` 和 `gallery` 图片放在 `public/assets/project-images/`，`gallery` 按数组顺序展示，每张必须有 `src` 和 `alt`，`caption` 可选。`cover` 可省略；`tech`、`links`、`featured` 和 `order` 有默认值，但建议在内容文件里写清楚。集合为空时，作品页显示空状态。

## 添加音乐

将音频文件放入 `public/assets/audio/`，再在 `src/data/playlist.ts` 中加入符合 `Track` 类型的数据：

```ts
import type { Track } from '../types/content';

export const playlist: readonly Track[] = [
  {
    id: 'example-track',
    title: '曲名',
    artist: '作者',
    src: '/assets/audio/example.mp3',
    cover: '/assets/images/example-cover.webp'
  }
];
```

`id`、`title`、`artist` 和 `src` 必填，`cover` 可省略。文件名含空格、中文或 `+` 等字符时，可用 `encodeURI(filename)` 生成 `src` 中的文件名部分。首页播放器嵌在左下透视卡片内，始终展开。非首页页面默认折叠到左侧，只露出半张唱片；点击入口展开，点击卡片空白或按 Escape 折叠。单击唱片播放或暂停，双击随机下一曲。播放器通过 `transition:persist` 保留 DOM 和 Audio，客户端页面导航时继续播放，并按当前路径切换首页或侧边模式。播放列表为空时不会创建 `Audio` 对象，也不会请求音频文件。

## 图片策略

文章中的 jsDelivr 图片 URL 按当前 inventory 去重检查。允许的图床仓库不可变提交为 `85bc7b2b63bcf294f1079a98edf79ee1c9f41606` 和 `b4dd348363960f7d4b41f3cd95d9c6f00a02fe48`。新增文章引用同一图床时也必须使用带 `@<commit>` 的不可变 URL；增加 ref 时，要同时更新 `astro.config.ts` 中 jsDelivr 与 GitHub Raw 的同仓库、同 commit、精确 `/img/**` 规则，以及图片 inventory 测试。Astro 会逐跳校验远程图片重定向；jsDelivr 跳转到 GitHub Raw 时，目标仍须匹配已批准的 commit，不能放宽整个 GitHub Raw 主机。

构建会检查这些地址，并把结果写到忽略提交的 `reports/image-check.json`：题图失败会终止构建，正文位图失败时会改用本地占位图并保留原地址。

人物运行时资源为 `public/assets/home/character-parts/*.webp`，分块源 PNG 位于 `public/assets/home/character-parts-source/`；原始 v5 PNG 保留作合成和视觉核对基准。禁用 JavaScript 时显示同目录的静态 WebP 回退图；启用 JavaScript 时不请求该图。首页使用 `public/assets/home/cover.webp`，原图为同目录的 `cover.png`，以灰紫色调衔接人物；其他页面使用用户选定的 `public/assets/backgrounds/background.png`，独立维护。人物立绘未改。

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
| `pnpm check:images` | 远程图片 inventory、固定 commit 与可访问性 |
| `pnpm build` | 图片预检、静态构建与加锁内容泄漏审计 |
| `pnpm check:protected` | 现有 `dist/` 的加锁正文、资源、索引和 sitemap 泄漏审计 |
| `pnpm check:site` | 文章、随笔和计划路由、CNAME、站内链接和发布体积 |
| `pnpm test:e2e` | Chromium 的桌面、平板和手机检查，以及 Windows 视觉基线 |

Pages workflow 不运行视觉套件，避免 Linux 渲染差异改写 Windows 基线。小型改动只运行相关测试和本地预览；完整 E2E 与视觉回归仅在用户明确要求或大范围界面改动确有需要时运行。

浏览器套件覆盖博客路径、文章数量、普通页页脚、Coverflow、实验场三维场景、About 装饰层和视觉基线。
随笔为空时，`check:site` 使用代码中的固定链接基线；有随笔时逐条检查站内链接，不锁总数。新增或删除页面、导航项后的机械更新流程见 `docs/operations/testing.md`，不要在 README 中复制当前总数。

## 安全边界

生产页面通过 HTML CSP 限制脚本、框架、图片和其他资源来源，并使用 `strict-origin-when-cross-origin` Referrer Policy。CSP 只在生产构建输出，开发服务器仍使用 Vite HMR。Argon2 由 `hash-wasm` 执行，因此策略只为 WebAssembly 编译保留 `'wasm-unsafe-eval'`，不允许通用 `'unsafe-eval'`。生产环境额外允许经过审计的 Vercount 脚本 `https://events.vercount.one/js`；构建检查仍按完整 URL 拒绝同源下的其他脚本。新增第三方脚本、框架、远程图片或媒体来源时，先更新安全策略和构建产物测试，不能只放宽 `default-src`。

已发布 Markdown 会在构建期拒绝可执行原始 HTML、事件属性、危险 URL scheme 和未固定的远程图片。检查失败时修改内容或明确更新允许边界，不要用 sanitizer 静默删除正文。

生产流量现在由 Cloudflare 代理到 GitHub Pages。Cloudflare 使用 Full (strict) TLS、强制 HTTPS、最低 TLS 1.2 和六个月 HSTS，并在边缘补充 `frame-ancestors`、Permissions Policy、`nosniff` 等响应头；权威 DNS 同时启用 DNSSEC。仓库中的完整资源 CSP 仍以 `src/config/security.ts` 为唯一来源，边缘只补充无法通过 HTML `<meta>` 生效的策略，避免维护两份完整 CSP。

Cloudflare 没有启用 HSTS preload、Bot Fight Mode、全站验证码、全站限流或自定义缓存规则。外部配置、验证命令和回退顺序见 [`docs/operations/cloudflare.md`](docs/operations/cloudflare.md)。

Pages workflow 的 Action 必须固定到完整 commit SHA，checkout 不保留凭据，手动部署只能使用 `master`。升级 Action 时同时更新版本注释和项目配置测试。

生产依赖审计只忽略 `GHSA-ch52-4w7c-c8xp`。该公告影响共享 HTTP 缓存，当前没有修复版本；本站只在 Astro 静态构建阶段引入相关包，部署产物不包含共享缓存服务。Astro 解析到修复版本后应删除此项豁免。不得改用 `--ignore-unfixable` 或降低审计等级。

## 部署

`.github/workflows/pages-deploy.yml` 支持六种入口：

- 文章私有仓库 `master` push：`notify-site.yml` 发送 `content-updated` 和完整 `github.sha`。公开 workflow 校验 SHA，检出这个精确的文章提交，并核对实际 `git rev-parse HEAD` 后构建和部署。
- 随笔私有仓库 `master` push：`notify-site.yml` 发送 `snippets-updated` 和完整 `github.sha`。公开 workflow 校验 SHA，检出这个精确的随笔提交，并核对实际 `git rev-parse HEAD` 后构建和部署。
- 计划私有仓库 `master` push：`notify-site.yml` 发送 `plans-updated` 和完整 `github.sha`。公开 workflow 校验 SHA，检出这个精确的计划提交，并核对实际 `git rev-parse HEAD` 后构建和部署。
- 公开仓库 `master` push：检出私有仓库默认分支当时的 HEAD，记录实际完整 SHA，再构建和部署。
- 手动运行公开 workflow：同样读取私有仓库默认分支当时的 HEAD，记录实际完整 SHA，再构建和部署。
- 公开仓库 pull request：只使用 `tests/fixtures/private-content`、`tests/fixtures/private-snippets`、`tests/fixtures/private-plans` 和测试 key 运行单元测试、Astro check、build 与 fixture 模式的 `check:site`，不读取生产 Secret、正式私有仓库，也不部署。

生产构建或检查失败时，deploy job 不会运行，线上仍保留上一个 Pages 版本。自定义域名写在 `public/CNAME`，Astro 构建后必须原样出现在 `dist/CNAME`。

生产构建生成的 `.astro/` 是带密构建状态，里面可能有私有文章正文、渲染 HTML 和源路径，不得缓存、上传或提交。Pages workflow 在上传 `dist/` 前会删除它。

GitHub 需要以下 Secret，值不得写进仓库：

| Secret | 仓库 | 最小用途和权限 |
| --- | --- | --- |
| `HATRIX_ADMIN_KEY` | `HatrixXXX/hatrixxxx.github.io` | 构建加密使用；不是 token，至少 8 个字符 |
| `HATRIX_CONTENT_TOKEN` | `HatrixXXX/hatrixxxx.github.io` | fine-grained token，只授权 `HatrixXXX/hatrix-content` 的 Contents read |
| `HATRIX_SNIPPETS_DEPLOY_KEY` | `HatrixXXX/hatrixxxx.github.io` | 随笔私有仓库的只读 deploy key 私钥，用于构建时检出随笔 |
| `HATRIX_PLANS_DEPLOY_KEY` | `HatrixXXX/hatrixxxx.github.io` | 计划私有仓库的只读 deploy key 私钥，用于构建时检出计划 |
| `HATRIX_SITE_DISPATCH_TOKEN` | `HatrixXXX/hatrix-content` | fine-grained token，只授权公开站点仓库的 Contents read/write，用于创建 `repository_dispatch` |
| `HATRIX_SITE_DISPATCH_TOKEN` | `HatrixXXX/hatrix-snippets` | fine-grained token，只授权公开站点仓库的 Contents read/write，用于创建 `repository_dispatch` |
| `HATRIX_SITE_DISPATCH_TOKEN` | `HatrixXXX/hatrix-plans` | fine-grained token，只授权公开站点仓库的 Contents read/write，用于创建 `repository_dispatch` |

Twikoo 前端脚本固定为 2.0.13，按需加载并校验 SRI；文章和留言板共用 `src/components/TwikooComments.astro`，样式在 `src/styles/twikoo.css`。访客只需填写昵称，同一浏览器会记住上次填写的昵称；邮箱和网址不显示。评论数据保存在独立的 Cloudflare Worker 和 D1，部署、检查与回退见 `docs/operations/twikoo.md`。原 GitHub Discussions 留言保留在 GitHub，不迁移。

不要恢复根目录 `CNAME`，也不要提交 `.env.local`、`.private-content/`、`.private-snippets/`、`.private-plans/`、`dist/`、`.astro/`、`reports/` 或 Playwright 运行产物。

## 构建失败排查

先区分图片预检和保护审计：

- `pnpm check:images` 检查 jsDelivr inventory 和远程地址，把结果写入 `reports/image-check.json`。如果视觉差异只发生在含远程图片的文章，先看报告。网络恢复后重跑 `pnpm check:images`，清理根目录 `.astro/` 和 `node_modules/.astro/data-store.json`，执行 `pnpm exec astro sync`，再运行构建或视觉测试。不要用 inventory 或视觉基线更新掩盖远程图片失败。
- `pnpm check:protected` 检查现有 `dist/` 是否含加锁正文片段、原图片字节、原文件名、错误的索引规则或 sitemap URL。加锁正文使用远程图片、绝对路径或越界相对路径时，Astro 渲染会先失败。修正文或加密边界；不要放宽审计、替换期望密文，或把泄漏输出当成新基线。

生产构建还可能因 `.private-content/posts/`、`.private-snippets/snippets/` 或 `.private-plans/plans/` 缺失、`HATRIX_ADMIN_KEY` 未配置或不足 8 个字符、schema 错误、私有 token、随笔或计划只读 deploy key 权限不足而停止。排查 Secret 时只确认名称、所在仓库和授权范围，不要打印值。


## 实验场与后续 3D 页面

实验场的场景结构、样式和交互集中在 `src/lab.html`，内嵌 Three.js 0.180.0 与 MIT 许可。`src/pages/playground/index.astro` 提取其中的样式与正文，放入全站 `BaseLayout`，不再使用专用 endpoint 或 middleware。页面主体只有居中的三维场景，播放器在左侧折叠显示。站内跳转时双瓣转场等场景首帧完成后退场；直接打开页面时显示首次加载环。模型、表面纹理和原创屏幕画面由程序生成，`docs/design-references/color-saturation-reference.png` 仅用于构图和色彩核对。旧贝塞尔鼠标轨迹代码与功能已移除。

实验场的 3D 引擎仅随 `/playground/` 加载。Three.js、Babylon.js 等 3D 依赖不能进入公共布局或普通页面的首屏脚本；其他新增 3D 功能放在独立客户端岛中，并在组件进入视口或用户操作后延迟加载。

## 许可证

当前站点源码与文章未另行授予开源许可；历史 Chirpy 许可和来源可从 Git 历史追溯。

实验场内嵌的 Three.js 0.180.0 使用 MIT 许可，完整许可随场景 HTML 和 [`public/third-party-notices.txt`](public/third-party-notices.txt) 发布。

本站使用 `sakana@1.0.8` 显示千束和泷奈。代码许可、上游元数据冲突、画师来源及插画非商业使用条件见 [`public/third-party-notices.txt`](public/third-party-notices.txt)。只要站点继续分发这两张插画，就必须保持非商业用途。

### 共构城视觉方向（2026-10-13）

现行主题以[共构城世界观](docs/design-references/共构城-世界观与主题设计指南.md)为准：立体城区中的机甲作业、边缘 AI 硬件加速与共享 AI-Infra 共同支撑人和 AI 的协作。全站颜色、字体、图标、图片外框和交互反馈沿用首页及 v5 立绘的浅色装甲、石墨、灰紫和铜色关系。主导航栏目页不显示 Hero 主标题或副标题栏；归档、旧分页和 404 保留紧凑 Hero。正文采用 17px / 1.85 排版。完整规则见 [DESIGN.md](DESIGN.md)。
