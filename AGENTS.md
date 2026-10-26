# 项目规则

这是 `https://hatrix.site` 的 Astro 纯静态站点。Node 版本固定为 24，包管理器使用 Corepack 管理的 pnpm。

## 协作、自主性与批准

- 用户要求修改后，默认按范围最小的推荐方案直接执行，不要求逐项复核设计、计划或实现细节。
- 只有以下情况需要停下确认：会改变用户可见需求或任务范围的选择；不可逆或破坏性操作；安全、隐私、凭据边界变化；生产或外部系统写入；统计指标的定义、数据源或解释口径存在多个合理方案。
- 本文件和运维文档已规定的机械计数、基线同步和测试更新无需另行确认；需要运行检查才能确定的计数、基线和问题修复留到推送前统一处理。确认前先完成不依赖该决定的只读检查与本地准备。
- “提前说明”是进度通知，不表示等待批准。安装软件、操作外部系统或命中上一条确认边界时才暂停。
- 用户可能同时开启多个 Codex 会话。开始修改前检查工作区和相关文件的最新状态；只改本会话范围，不覆盖、回退或整理其他会话的改动。发现并行修改时保留现状，调整自己的修改以兼容。
- 默认在当前工作区工作，不因存在实施计划自动创建 worktree。只有用户明确要求隔离，或并行修改使原地工作不安全时才询问或创建。新 worktree 使用 Node 24 和 `corepack pnpm install --frozen-lockfile`，不得运行 `npm install`。

## 修改、验证与本地预览

- Codex 执行任何本地修改时只完成修改本身，不在完成该次修改后运行验证或测试；不自动执行类型检查、单元测试、构建、图片与安全检查、E2E、浏览器预览、HTTP 探测、截图或其他用于验收改动的检查。修改测试文件不等于运行测试。开始修改前为避免覆盖并行工作所做的只读检查不属于验收。
- 只有用户明确要求推送到远程仓库时，才在推送前对尚未统一验收的相关修改执行 [docs/operations/testing.md](docs/operations/testing.md) 规定的推送门禁和必要的专项验证、测试。发现问题先修复根因并复跑受影响的检查；通过后再推送。向用户报告验证结果，以及每项问题的修复内容；门禁未通过时不推送，并说明剩余问题。
- 本节关于验证时机的规定优先于本文件其他“完成前验证”“实际检查”要求、运维文档和通用 Skill 的默认验证流程。日常修改不因风险、页面渲染或动效而提前运行检查；所需检查积累到推送前统一执行。
- 推送前确需本地预览时，固定使用 `http://127.0.0.1:4321/`，不得使用自动顺延的其他端口。先以 HTTP 请求检查 4321：若是本项目的服务则直接复用；未运行时才启动 `corepack pnpm astro dev --background --host 127.0.0.1 --port 4321`，并以 4321 的 HTTP 响应确认。`corepack pnpm astro dev status` 仅作辅助；若它返回其他端口，不能把该端口作为预览地址。4321 被其他服务占用时先查明并报告，不自动改用其他端口。
- 不重复启动同端口服务。用户可能继续查看时保持预览运行；仅用于推送前验证且不再需要时，可停止本会话启动的进程，不停止其他会话进程。不自动安装浏览器，也不默认运行全量 E2E 或视觉回归；按推送涉及的风险选择必要范围。
- 详细命令、推送门禁、CI 陷阱和基线更新流程见 [docs/operations/testing.md](docs/operations/testing.md)。

## 项目级前端设计 Skills

项目在 `.agents/skills/` 安装 `ui-ux-pro-max`、`frontend-design`、`impeccable` 和 `visual-asset-upgrade`，只供本仓库使用。不要为它们添加全局 Skill、全局自动调用规则或全局 MCP 配置；上游版本和更新方式见 `.agents/README.md` 与 `.agents/skills-sources.json`。

| Skill | 使用时机 |
| --- | --- |
| `ui-ux-pro-max` | 查询设计规则、字体、配色、UX 与无障碍要求；框架查询使用 `astro`，局部问题只查相关 domain。 |
| `frontend-design` | 新建或实质性重设计页面、组件时确定视觉方向并落实到现有 Astro 架构。 |
| `impeccable` | 审查和打磨已有界面，按需使用 `critique`、`audit`、`layout`、`typeset`、`polish`、`animate`。 |
| `visual-asset-upgrade` | 用户指定页面或组件做视觉素材质感升级时，完成原创位图规划、生成、处理和接入；验证留到推送前。 |

- 完整页面设计通常依次使用 `ui-ux-pro-max`、`frontend-design` 和 `impeccable`；小改动只用必要工具，不叠加多套方案或批准门。
- 视觉实现以用户提供的参考、[DESIGN.md](DESIGN.md)、现有页面和代码为准。现有文档已经说明产品、受众和主题时，不要求用户重复确认。
- `visual-asset-upgrade` 只在新图片能明显改善材质或体积时触发；纯内容或不需要新图的小型样式调整不触发。每件素材的完整提示词保存在 `docs/design-references/<目标部位>/prompts.md`，不让用户逐张选图或下载。
- 用户提供的参考只用于提取视觉规律，不复制他人源码、文案、品牌或个人资产。未经许可核实的参考图不作为运行时素材。
- 实现动画或动效时，尽量参考 [Anime.js](https://animejs.com/) 的能力与示例，制作炫酷且流畅的动画；按需使用动画库，不为简单效果增加不必要的依赖。
- 动效必须反馈真实状态，可中断，并在减少动态效果时直接呈现结果。涉及动效的桌面、手机、键盘、触控和 `prefers-reduced-motion` 检查留到推送前；不为普通反馈引入全站 3D 依赖或自动发声。
- UI UX Pro Max 从项目根目录运行 `python .agents/skills/ui-ux-pro-max/scripts/search.py`。Windows 下调用 `.agents/skills/impeccable/scripts/impeccable.cmd`，并把 `IMPECCABLE_HOME` 设为项目内 `.impeccable`；运行时文件和引擎二进制不提交。

一句常用的prompt：用 visual-asset-upgradeup 提升质感，要求素材符合我网站的整体风格、配色方案、视觉元素和设计、背景和世界观设定；要科幻工业机械风格。

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

## 目录与内容边界

- `.private-blogs/posts/` 是已发布博客文章的唯一正文来源，位于独立私有仓库 `HatrixXXX/hatrix-blogs`。公开仓库不跟踪文章 Markdown、加锁正文图片或其他私密资源。
- `.private-sanctuary/sanctuary/` 是秘境来源，位于独立私有仓库 `HatrixXXX/hatrix-sanctuary`。秘境总览和详情使用现有管理员 key 加锁，文本进入加密产物。封面默认用已批准的固定提交图床 URL，也兼容 `/assets/` 路径；未配置 `cover` 时使用统一默认封面。正文公开图片与旧相对图片的规则见下方“内容、路径与提交”。
- `.private-snippets/snippets/` 是随笔来源，位于独立私有仓库 `HatrixXXX/hatrix-snippets`；公开仓库不跟踪随笔源文件。随笔总览和详情使用现有管理员 key 加锁，标题、摘要和正文进入加密产物；URL 与封面仍公开。
- `.env.local` 保存本机 `HATRIX_ADMIN_KEY`，至少 8 个字符；禁止提交、分享或复制到内容仓库。
- `src/content/projects/` 是作品集合，填写规则见 [README.md 的“新增作品”](README.md#新增作品)；作品状态只能是 `idea|active|done|archived`。
- `src/data/playlist.ts` 允许为空；空歌单不创建 `Audio` 对象，也不填演示数据。秘境为空同样合法。
- `src/config/navigation.ts` 是主导航、关于子页和首页快捷链接的唯一来源；`src/config/site.ts` 保存域名、作者、社交链接、Twikoo 后端和站点验证信息。
- `public/assets/` 是本地网站图片、图标、纹理、光标和音频的统一目录；文章图片默认使用批准的公开图床。`src/` 不存放运行时素材。首页分块源图与运行时资源只放在 `public/assets/home/` 对应目录。
- `scripts/` 只放可复用的检查和构建脚本，不放一次性迁移脚本。`public/CNAME` 是自定义域名唯一来源。

## 内容、路径与提交

- 网站保持纯静态输出。Twikoo Cloudflare Worker 和 D1 独立运行，不在站点构建中增加服务器、数据库、上传、下载中心或对象存储。
- 保留已发布文章的 `/posts/<legacySlug>/` 路径；用户确认删除的《杂货铺》及 `/posts/杂货铺/` 为例外。Twikoo 以 pathname 区分评论；原 GitHub Discussions 留言不迁移、不删除。
- 完成博客正文修改后，必须在 `.private-blogs` 独立仓库提交。完成随笔修改后，必须在 `.private-snippets` 独立仓库提交。用户要求推送时，同时推送任务涉及的私有仓库提交；不留下未提交的内容修改。
- 文章正文属于用户内容，除非任务明确要求，不改写正文。schema 调整保持旧 URL。只修改摘要时不改 `updatedDate`。
- 每篇博客文章的公开 `summary` 不超过 100 字并准确概括正文。正文主题、主要结论或覆盖范围明显变化时同步更新摘要，错别字和不影响主旨的小改不触发。
- 所有通过校验的博客文章都生成公开页面，正文、正文图片、搜索、RSS 和站点地图不提供博客加锁开关。博客源码仓库仍保持私有。
- 随笔、秘境和资讯继续使用管理员 key 加锁；随笔与秘境正文默认引用已批准的固定提交公开图床 URL，图片引用在解锁后才挂载，图片文件本身不受页面锁保护。旧内容目录内的 Markdown 相对图片仍兼容随正文加密；未批准的远程地址、data URL、站点根绝对路径、越界路径和原始 HTML `<img>` 仍禁止。
- 随笔和秘境集合使用 `src/lib/protected-glob.ts` 保留源正文，禁止 Astro 为受保护正文登记原生渲染模块或图片导入；图片由专用受保护正文渲染器处理，不能替换为普通 `glob` 或仅设置 `deferRender`。
- 为随笔拟新标题时，使用隐晦、荒诞且带有当代年轻人“发疯”语感的表达；避免直接对应正文的事件、人物、地点、技术关键词或结论，让人单看标题无法推断正文大致写了什么。
- 随笔封面默认使用已批准的固定提交图床 URL，也兼容公开站点 `public/` 内素材的站点根路径；未配置时使用统一默认封面。
- 首页入口使用 `/blogs/`、`/creation/`、`/about/`、`/snippets/`、`/favorites/`、`/toolbox/`、`/sanctuary/`、`/digest/`、`/playground/`、`/friends/`、`/guestbook/`。关于子页保留 `/about/<section>/`，文章详情保留 `/posts/<legacySlug>/`。
- 文章详情返回 `/blogs/`，随笔详情返回 `/snippets/`；从总览进入随笔时恢复离开位置，直接打开详情时返回总览顶部。普通内页、关于子页、归档、旧分页和 404 返回 `/`。

## 运行时与界面硬约束

- 非首页主导航顺序固定为：首页、博客文章、作品橱窗、关于我、随笔、收藏夹、工具箱、秘境、资讯、友链、留言板、实验场；小于 `1200px` 时使用同顺序折叠菜单。博客不提供类型分类或二级菜单。
- 主导航栏目页不显示 Hero 主副标题栏；归档、旧分页和 404 可使用紧凑 Hero。文章详情以标题和元信息开头，不恢复题图横幅或波浪分隔。
- 站内页面默认不能拖选文字；只有文章正文和输入、选择、可编辑控件允许选择。空白区域、链接、按钮和顶栏使用现有自定义光标，热点与尺寸规则以当前 CSS 和 `DESIGN.md` 为准。
- 直接打开或刷新任意站点页面时使用 splash；站内链接和历史返回使用 Astro 客户端 transition。退场等待目标页资源或场景首帧就绪，超时只处理失败，不决定动画类型。
- 全站只挂载一个播放器，以 `transition:persist` 保留 DOM 和 Audio；首页常驻，非首页折叠到左侧。具体交互、尺寸、金句、首页画布、作品图鉴、收藏夹、工具箱、友链、留言板和实验场规则以 [DESIGN.md](DESIGN.md) 与当前组件为准。
- 用户明确选定的 `public/assets/home/hatrix-character-v5.png`、首页背景、人物分块、作品图鉴和其他已选素材不得因一般视觉改造重新生成、删减或改写。设计参考目录不作为网页运行时素材。
- 只有文章页启用页脚和站点统计。Vercount 只在生产环境加载固定脚本 `https://events.vercount.one/js`；开发和测试不得请求该服务，加载失败时访客数保持 `—`。

## 图片、构建与安全

- 博客、随笔和秘境的封面与正文图片默认上传公开图床 `HatrixXXX/Hatrix-s-Blog-Image`，替换为批准的固定提交 URL 后可删除对应本地原文件。公开图片不受管理员 key 保护；统一默认封面由 `src/config/article-images.ts` 的 `DEFAULT_ARTICLE_COVER` 提供，不保留本地副本。
- Hatrix 图床 URL 必须固定到不可变 commit；当前允许 `85bc7b2b63bcf294f1079a98edf79ee1c9f41606`、`b4dd348363960f7d4b41f3cd95d9c6f00a02fe48`、`102d16687d19b8ba0b77fe930830465245d78294`、`a34cd33600165dd0b2b40e041434f85c54aaed07` 和 `ecfcb3dda864171cefb1378d825d72b8dfb888b1`。增加 ref 时同步更新 `src/lib/safe-url.ts` 的批准前缀、`astro.config.ts` 中 jsDelivr 与 GitHub Raw 的同仓库、同 commit、精确 `/img/**` pattern，以及 inventory 测试；不得放宽整个主机。文章列表题图走 Astro/Sharp，正文远程图片保留 CDN 地址并使用 lazy/async 属性。
- `check:images` 检查博客、随笔、秘境的封面与正文远程图片，以及统一默认封面；`check:protected` 检查 `dist/` 受保护文本和本地相对图片原资源泄漏。失败时修复根因，不放宽检查、替换期望密文或直接更新密文基线。
- 生产构建生成的 `.astro/` 可能包含私有正文、渲染 HTML 和源路径，不得缓存、上传或提交；生产 workflow 在上传产物前删除它。
- 生产 CSP 与 Referrer Policy 的唯一来源是 `src/config/security.ts`。`hash-wasm` 的 Argon2 只允许 `'wasm-unsafe-eval'`，不得换成通用 `'unsafe-eval'`。新增第三方脚本、框架、远程图片或媒体来源时同步更新策略、构建测试和生产预览取证，不放宽 `default-src`。
- `remark-content-security.ts` 拒绝可执行原始 HTML、危险 URL、任意 `srcset` 和未固定远程图片；原始 `style` 只允许单条 `zoom: <正整数>%`。不得用 sanitizer 静默改写正文。
- Pages workflow 的 Action 固定到完整 commit SHA，checkout 不保留凭据，手动发布只能来自 `master`。升级 Action 时同步更新版本注释和配置测试。
- Sakana 的许可和素材来源固定在 `public/third-party-notices.txt`，构建后复制到 `dist/third-party-notices.txt`。内置千束与泷奈插画只用于非商业网页；站点用途或依赖版本变化时重新核对授权。
- `hatrix.site` 的权威 DNS 和代理位于 Cloudflare，源站为 GitHub Pages。修改 NS、DNSSEC、HSTS、代理状态或响应头前阅读 `docs/operations/cloudflare.md`；仓库修改不代表已授权修改生产配置。
- 3D 代码只随 `/playground/` 加载；其他 3D 功能使用独立客户端岛并延迟加载，不把 3D 依赖放进公共布局。

## 禁止事项与远端操作

- 不恢复 Ruby、旧主题目录、一次性迁移脚本或根目录 `CNAME`。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/`、Playwright trace、`.env.local`、`.private-blogs/`、`.private-snippets/`、`.private-sanctuary/` 或其中的私密内容。
- 未经用户明确要求，不推送、合并、部署或修改远端 Pages、Cloudflare 和其他生产设置。
- 部署后只自动清理本次任务创建并明确拥有的临时 worktree，且它必须已经合并、工作区干净、提交已推送。其他 worktree 只报告状态，不停止进程或删除；未提交、未推送、用途不明或仍在开发的 worktree 不得删除。
- 不复制参考站源码、文案、品牌或个人资产。

## 按需文档

- 当前视觉、素材和组件状态：[DESIGN.md](DESIGN.md)
- 测试、构建、CI 与基线更新：[docs/operations/testing.md](docs/operations/testing.md)
- Cloudflare 和 Twikoo 运维：[docs/operations/cloudflare.md](docs/operations/cloudflare.md)、[docs/operations/twikoo.md](docs/operations/twikoo.md)
- 历史设计和实施记录索引：[docs/superpowers/README.md](docs/superpowers/README.md)

只读取当前任务涉及的文档。旧设计和计划是历史证据，不覆盖当前代码、测试、用户要求和本文硬约束。
