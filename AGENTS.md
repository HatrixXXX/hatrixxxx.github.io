# 项目规则

这是 `https://hatrix.site` 的 Astro 纯静态站点。Node 版本固定为 24，包管理器使用 Corepack 管理的 pnpm。

## 协作与决策

- 修改内容时默认按推荐方案直接执行，不要求用户逐项复核方案。
- 只有涉及影响重大的修改，或需要确定统计、计数口径与计算路线时，才向用户确认；确认前先完成不依赖该决定的准备工作。
- 用户可能同时开启多个 Codex 会话。开始修改前先检查当前工作区和相关文件的最新状态；只改动本会话负责的范围，不覆盖、回退或整理其他会话尚未完成的修改。
- 发现并行修改、未提交内容或文件状态与预期不一致时，保留现有改动，调整自己的修改以兼容，并在必要时说明具体冲突。
- 验证范围与改动风险匹配。小型内容和样式调整只运行相关测试、类型检查与本地 HTTP 预览；不要自动安装浏览器，也不要默认运行全量 E2E 或视觉回归。只有用户明确要求，或改动涉及安全边界、构建发布、跨页面公共逻辑且轻量验证不足时，才扩大验证范围，并提前说明。
- 本地预览统一使用 `corepack pnpm astro dev --background --host 127.0.0.1 --port 4321` 启动；修改完成后先用 `corepack pnpm astro dev status` 和 HTTP 请求确认服务，再提供 `http://127.0.0.1:4321/`。

## 项目级前端设计 Skills

- 本项目在 `.agents/skills/` 安装 `impeccable`、`ui-ux-pro-max` 和 `frontend-design`，仅供本仓库及其子目录中的会话发现和调用。不要为这三个工具添加全局 skill、全局自动调用规则或全局 MCP 配置。来源、固定版本和使用命令见 `.agents/README.md` 与 `.agents/skills-sources.json`。
- 用户要求设计、重设计、美化页面或组件，调整排版、配色、响应式、交互或动效时，按下表读取对应 `SKILL.md`；纯内容编辑、后台逻辑和非视觉配置任务不自动加载它们。

| Skill | 项目内入口 | 使用时机 |
| --- | --- | --- |
| `ui-ux-pro-max` | `.agents/skills/ui-ux-pro-max/SKILL.md` | 查询设计规则、字体、配色、UX 和无障碍要求；涉及框架实现时明确使用 `astro`，局部问题只查相关 domain。 |
| `frontend-design` | `.agents/skills/frontend-design/SKILL.md` | 新建或重新设计页面、组件时确定构图与视觉方向，并落实为现有 Astro 架构下的代码。 |
| `impeccable` | `.agents/skills/impeccable/SKILL.md` | 审查和打磨已有界面，按需使用 `critique`、`audit`、`layout`、`typeset`、`polish`、`animate` 等命令；只加载当前任务需要的参考文件。 |

- 完整页面设计通常先查 `ui-ux-pro-max`，再用 `frontend-design` 实现，最后用 `impeccable` 审查；小改动只用相关工具，不重复生成三套方案。用户明确指定某个 skill 时优先使用该工具。
- 用户提供的参考图、参考站、明确偏好和本文件的稳定约束优先于 skill 的通用审美建议。参考只用于理解视觉特征，不复制他人源码、文案或个人资产。已有页面的局部调整应保留其他区域和功能。
- 用户可以只描述视觉效果；代码实现、运行预览、检查桌面和手机画面由 agent 完成。动效必须实际触发并检查减少动态效果设置，不能只用代码检查或静态截图判断完成。沿用本项目的协作与决策规则，不因多个 skill 叠加而逐项要求用户确认。
- 界面交互要有明确反馈：触发后让用户看见状态变化、结果或错误，键盘与触控的操作路径也要清楚。先理顺操作流程、状态转换、取消与返回，再设计动效；动效用于表达空间和状态的连续性，增强沉浸感而不拖慢操作。减少动态效果时直接呈现结果。
- UI UX Pro Max 上游示例中的 `${CLAUDE_PLUGIN_ROOT}` 不适用于本安装；统一从项目根目录运行 `python .agents/skills/ui-ux-pro-max/scripts/search.py`，或使用该脚本的绝对路径。
- Windows 下使用 `.agents/skills/impeccable/scripts/impeccable.cmd`；调用前在当前命令中将 `IMPECCABLE_HOME` 设为项目根目录下的 `.impeccable`。本安装不注册 MCP 服务或自动 hook，运行时文件和引擎二进制不提交。

## 后续全站 UI 设计倾向

- 新建或改造界面时，默认采用更大胆、更繁复的机甲工坊视觉。允许多层装甲外壳、局部透视和鲜明的状态反馈，让复杂结构形成美感；不要退回只有纯色矩形、图标和标题的通用卡片。先保证内容层级和操作路径清楚，再增加装饰层。
- `docs/design-references/mecha-elements/` 中的 18 张图片是机甲视觉参考。按任务查看相关图片，提取面甲轮廓、装甲咬合、中心舱核与环形仪表，以及阶梯切角、内凹槽、窄状态灯、电路走线、铆钉和刻度等造型规律。把这些元素与现有立绘、工坊背景和页面组件结合；无需让每个控件都像一张机甲面孔。该目录不作为网站运行时素材；素材许可未核实前，只能用原创 CSS／SVG 抽象这些规律，不直接复制图片、文字、品牌或具体界面。
- 颜色继续以 `src/styles/tokens.css` 和本文件的首页配色约束为准：深色底、操作金、链接青、铜色接缝及现有局部色区。参考图片只提供结构、材质和层次，不引入另一套主色。跨页面复用相同的边框粗细、金属层次、灯光语义和状态变化；各栏目可按内容调整密度，不强制使用同一张卡片模板。
- 视觉复杂度放在导航、容器外壳、卡片边缘、控件和过渡状态。文章正文、表单值、错误信息及主要入口名称保持清楚、稳定；装饰不能遮挡文字或缩小命中区域。手机布局重新安排层次，不把桌面机械框架等比压缩到窄屏。
- 动效用于交代展开、切换、选中、加载和返回等状态；悬停、键盘聚焦、按下、触控和失败反馈都要能辨认。实际触发并检查这些状态；减少动态效果时直接呈现结果，不依赖持续闪烁、扫描线或漫长的开场动画。
- 优先在现有组件和样式 token 上演进。涉及首页画布、人物、背景、面板位置或已选定素材时，先遵守下方稳定约束；新装饰不能改动既定功能、路径和内容。`DESIGN.md` 记录现状与后续视觉方向，完成实现后再把已落地的细节写成现行规则。

## 游戏化动效与交互反馈

- 后续涉及 UI 动效、交互反馈或视觉特效的设计与实现时，自动参考本节。以《炉石传说》富有力量感的卡牌操作为表现参考，目标是浮夸、流畅、华丽且操作结果清楚；借鉴表现手法，不照搬战斗叙事、素材或具体动画。
- 把 Game Feel（整体手感）作为体验目标：操作应立即得到回应，状态变化有可追踪的过程和明确的落点。Visual Feedback（视觉反馈）先交代悬停、聚焦、按下、执行中、成功、失败和可撤销等结果；Juice（表现力增强）再用局部光效、粒子、震动感、层次变化等放大关键瞬间；Animation Polish（动画打磨）负责蓄势、加速、缓动、回弹和收束的节奏。特效不能代替状态文字或遮住结果。
- 粒子特效（Particle Effects）和法术式特效（Spell VFX）可转译为能量流、火花、光点、辉光与短暂轨迹，用在搜索唤出、重要入口激活、内容揭示等有明确起点和终点的动作上。粒子应从触发位置或相关部件发出，并指向变化发生的位置；不要在整页持续飘散。
- 攻击特效与打击反馈（Attack Effects / Hit Feedback）只借用“蓄力—触发—回响”的力度：按钮按下时压缩或内陷，释放后有短促的亮边、位移或回弹；卡片选中、切换完成时可有局部冲击波或装甲咬合。页面不使用攻击、伤害等战斗语义，也不让全屏震动成为日常反馈。
- 召唤与死亡特效（Summoning / Death Effects）转译为组件登场与退场：弹层、抽屉、菜单、提示和卡片从所属入口展开、聚合或收回，关闭后焦点与操作路径回到合理位置。卡牌动画（Card Animation）可用于卡片翻转、叠放、抽出与归位，保持对象和位置的连续性，不让装饰性飞行拖延导航。
- 界面动效（UI Motion / UI VFX）覆盖按钮、导航、筛选、播放器、表单和加载状态；每个可操作控件都要有可辨认的悬停、键盘聚焦、触控按下及结果反馈。屏幕特效（Screen Effects）如全屏闪光、镜头震动和遮罩冲击只留给少数重要转场，控制亮度与频率，不影响阅读或造成误触。
- 动态插画（Animated Illustration）和 2D/3D 混合表现可让现有立绘、工坊背景、装甲边框与前景光效分层配合；先遵守首页画布、人物分块、共用透视平面和既定素材约束。效果应围绕真实交互发生，不强制让文章正文、所有卡片或空白区域持续运动。
- 按使用频率分配表现强度：首次进入和少数关键操作可以有完整演出；高频点击、输入、返回保持短促，随时能被下一次操作打断。视觉、声音和可选的触觉反馈要与同一结果同步；网页不得为装饰自动发声，播放器仍由用户控制。
- 实现时优先复用现有 CSS、SVG、Web Animations API 与组件状态，昂贵的粒子、模糊或画布效果限定范围并在页面隐藏时停下，不为普通反馈引入全站 3D 依赖。减少动态效果时直接呈现最终状态，保留文字、图标、边框或颜色等可理解的反馈；实际检查桌面、手机、键盘、触控及连续快速操作。
- 需要时间轴、错峰进场或多元素动画编排时，可以参考并按需使用 Anime.js（`animejs`）。引入前核对现有实现、打包体积和加载范围；动画仍须可中断，并在减少动态效果时直接呈现结果。

## 全站滚动

- 页面和组件内的可滚动区域都要避免位置突跳。滚轮滚动、锚点定位、返回顶部及按钮触发的滚动应在当前位置和目标位置之间加入可中断的缓动；新增滚动容器时检查它是否接入现有滚动机制，不只设置 `scroll-behavior: smooth`。
- 保留浏览器触控手势、键盘滚动、图库吸附和已有轮播的操作语义，避免两个滚动控制器同时接管同一区域。用户设置“减少动态效果”时直接到达目标位置；跨页导航的初始定位和浏览器历史位置恢复按导航语义处理。

## 首页视觉设计参考

- 六张首页界面截图、一张配色参考图和两份设计文档保存在 `docs/design-references/`。四张 PNG 对应布局分析中的图 1～4，两张 JPG 用于比较不同背景与卡片美术处理。调整首页前，按任务需要查看图片和相关章节，并核对当前 v5 立绘、v10 加速计算测试舱背景及实际页面；不要只凭参考图决定改动。
- `共构城-世界观与主题设计指南.md` 约束人物、AI 侧脸、机甲、边缘加速计算、共享 AI-Infra、材质与色彩的含义。`明日方舟首页布局分析与复刻Prompt.md` 用于理解卡片分组、文字层次、透视和角色留出的空间；其中的完整 Prompt 是早期布局草案，坐标和实现步骤需与现行代码及用户最新要求核对。游戏截图只作视觉分析，不把其中的角色、品牌、文案或图标直接用在网站上。
- 首页以文字信息为主，图像元素为辅。功能卡片不能只呈现纯色底、一个简单图标和两行标题；用有意义的辅助信息、局部结构线、材质层次和适量交互增加视觉内容，不靠放大文字填空，也不让装饰盖过入口名称。
- 中文是主标题，英文是较小的副标题。博客卡片虽大，标题只比作品橱窗略大，标题组位于视觉中部略偏上，与底部提示留出间距。栏目名称沿用当前中英文配对：博客文章／Blogs、作品橱窗／Creation、关于我／About、随笔／Snippets、收藏夹／Favorites、工具箱／Toolbox、计划／Plans、资讯／Digest、实验场／Playground、友链／Friends、留言板／Guestbook。
- 图标应提炼栏目主题中可辨认的形状，采用简洁、扁平且统一的造型；避免无关装饰，也避免简单到失去辨识度。引用外部素材前核对许可并记录来源。
- 纹理从立绘和工坊背景中的机柜、接缝、电路、铜导线、金属板及状态灯取形。固定尺寸平铺，用渐变控制显隐，让细节可见但不抢文字；不拉伸原图，不把图标放大重画成背景，也不用细三角织纹。多种纹理交叉使用，相邻卡片避免相同纹理。
- 当前纹理按卡片位置保留：关于我、友链、随笔及右侧资讯用电路纹理；作品橱窗、计划及左下实验场用防滑金属板；收藏夹、留言板用导线与状态灯；工具箱用蓝灰金属板；博客文章用工坊机柜纹理。调整分配时仍应检查相邻卡片及其与背景、人物的关系。
- 随笔、收藏夹和工具箱共用青绿色底色、悬停色、点缀色和图标色；底色透明度与其他功能卡片一致。工具箱的金属纹理保留清晰的接缝，但不改变卡片的青绿色相。
- 博客和语录卡片都使用深色填充。语录以不同的点缀色与播放器、友链和留言板区分；所有卡片外边框的视觉粗细与播放器一致，播放器外框使用内部的暗黄铜色。卡片的配色、图标、纹理和背景应形成同一场景。
- `docs/design-references/color-saturation-reference.png` 用于校准现有金色、青色、灰紫和浅蓝区域的饱和度。保留原有背景、立绘、卡片位置和纹理；参考图中的大块紫色墙面、橙色工作台及人物、品牌不进入网页。
- 当前深色配色的操作金为 `#FFD200`（悬停 `#FFE360`），链接青为 `#00DDEB`，边缘铜色为 `#D88C3C`；首页时钟、播放器和入口卡片在原有区域内提色。作品橱窗与资讯共用 `--tile-bg`、`--tile-hover`、`--tile-accent`、`--tile-glyph` 四项色值；左下实验场使用工具箱的这四项色值。改色时核对 `src/styles/tokens.css`、`src/styles/home-tiles.css`、`src/pages/index.astro` 与 `DESIGN.md`。
- 参考图和两份设计文档只保存在 `docs/`，不作为网页运行时素材引用。新的首页设计先提取构图与材质规律，再按本站内容、现有功能和可读性落实；实际浏览器中的桌面与手机效果是最终核对依据。

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

- `.private-content/posts/`：16 篇已发布文章，文件名只保留标题，不加日期前缀；公开路径由 `legacySlug` 生成。`.private-content/` 是独立的私有 Git 仓库；公开仓库不跟踪文章 Markdown。
- `.private-snippets/snippets/`：随笔 Markdown，位于独立的私有 Git 仓库 `HatrixXXX/hatrix-snippets`；文件名转为 URL slug 后生成 `/snippets/<slug>/`。公开仓库不跟踪随笔源文件。
- `.env.local`：本机 `HATRIX_ADMIN_KEY`，至少 8 个字符；文件已忽略，禁止提交、分享或复制到任何内容仓库。
- `src/content/projects/`：作品集合；当前含 10 个明确标注的示例作品，后续可直接替换为真实项目。
- `src/data/playlist.ts`：允许为空的音乐列表。
- `src/config/navigation.ts`：主导航、关于子页和首页快捷链接的唯一来源。
- `src/config/site.ts`：域名、作者、社交链接、Twikoo 后端地址和站点验证信息。
- `public/assets/`：网站图片、图标、纹理、光标和音频的统一目录；首页原图及人物分块源 PNG 在 `public/assets/home/`，`src/` 不存放素材。
- `src/pages/`、`src/layouts/`、`src/components/`：路由和页面结构。
- `scripts/`：图片预检与构建产物检查，不放一次性迁移脚本。
- `public/CNAME`：自定义域名唯一来源；构建后应复制到 `dist/CNAME`。
- `tests/unit/`、`tests/e2e/`：Vitest、Playwright 和视觉基线。

## 稳定约束

- 网站保持纯静态输出；评论由独立的 Twikoo Cloudflare Worker 和 D1 提供，不在网站构建中增加服务器、数据库、上传、下载中心或对象存储。
- 保留全部 `/posts/<legacySlug>/` 路径，Twikoo 使用这些 pathname 区分文章评论；原 GitHub Discussions 留言不迁移、不删除。
- 已发布文章只在 `.private-content/posts/` 中编辑。每次完成文章内容修改后，必须在 `.private-content` 独立仓库提交；用户要求推送修改时，也要推送该仓库的文章提交，不留下未提交的文章内容修改。禁止把文章、加锁正文图片或其他私密资源复制回公开仓库。文章正文属于用户内容，除非任务明确要求，不改写正文；schema 调整也要保持旧 URL。
- 本项目的“博客文章”仅指 `.private-content/posts/` 中的文章；`.private-snippets/snippets/` 中的随笔不算博客文章。每篇博客文章的 frontmatter 必须有不超过 100 字的 `summary`，概括全文实际内容，供博客列表卡片显示；加锁文章的摘要也会公开，不能包含受保护的信息。更新博客文章正文时先检查摘要是否仍准确：若主题、主要结论、覆盖范围或关键内容发生足以影响读者预期的变化，就重新生成并更新摘要；错别字、措辞、排版或少量不影响主旨的补充不触发改写。只修改摘要不改动正文时，不改 `updatedDate`。
- 随笔只在 `.private-snippets/snippets/` 中编辑并由独立仓库提交。当前随笔详情页公开正文，尚未加锁；需要保密的内容暂不写入。封面放在公开站点 `public/` 下，frontmatter 的 `cover` 使用站点根路径。
- 所有通过校验的文章都生成页面。`locked` 省略时为 `false`；`locked: true` 只公开 metadata、Hero 和封面，正文与正文图片必须输出密文。
- 加锁正文图片必须使用 `.private-content/posts/` 内文件的 Markdown 相对路径。禁止远程/data URL、站点根绝对路径、越界路径和原始 HTML `<img>`；加锁文章的 `cover` 仍是公开资源。
- 非首页主导航在顶部按视口居中，顺序固定为首页、博客文章、作品橱窗、关于我、随笔、收藏夹、工具箱、计划、资讯、友链、留言板、实验场；宽度小于 `1200px` 时使用同顺序的折叠菜单。首页博客卡片直接进入展示全部文章的 `/blog/`，不提供文章类型分类或二级菜单。
- 页面返回按钮使用固定目标：文章详情返回 `/blog/`；其余页面统一返回 `/`，包括关于子页、归档、旧分页和 404。
- 站内页面默认不能拖选文字；仅文章详情的 `article[data-post] .prose` 和输入框、选择框、可编辑控件允许文本选择。跨源 iframe 中的文字不受宿主页面 CSS 控制。
- 页面空白区域使用站点的 `pointer.cur`，链接和按钮使用斜十字准星 `link.cur`；顶栏使用从 `link.cur` 裁去透明边距的 `link-nav.png`，可见图案仍为正常大小，热点对齐准星中心。顶栏准星无法显示时，备用 `pointer.cur` 也必须按全站正常尺寸呈现，不能直接使用 128px 原图。导航按钮的完整矩形区域必须命中自定义光标，不要在博客列表外层恢复系统默认光标。
- 首页首次访问时，splash 从首帧覆盖页面，直到背景和人物分块解码、字体加载结束。播放器布局仍可在 8 秒后降级，但不能因计时到点就把仍在加载的人物标记为失败并露出首页；图片实际失败时保留现有错误处理。
- 作品状态若填写，只能是 `idea|active|done|archived`。作品橱窗显示 FPGA-3DGS渲染、CoNet在线笔记、RoboMaster步兵、DreamChaser战队周边、实验室文化墙五张数字档案卡；没有提供的介绍、经历和照片明确标为待补充。桌面采用三张加两张的图鉴墙，窄屏单列；点击卡片展开同一作品的档案，多张照片在档案中横向浏览。内容填写方式见 `docs/projects-content.md`。`ToolSpecimen.astro` 不再用于作品橱窗；工具箱由 `ToolModule.astro` 和 `src/data/software-tools.ts` 实现，不显示分类标题或右侧读取台。桌面端每行 9 张卡片，窄屏依次调整为 8、6、3 列；卡片按用途类别使用不同荧光边框，顶部显示名称和两侧短灯，中部显示本地图标与“软件／在线”标记，底部显示用途短语。鼠标悬停或键盘聚焦时，在卡片上方居中显示深灰色圆角气泡，内含一句功能介绍。图标来源记录在 `public/assets/tool-icons/SOURCES.txt`。歌单、计划和实验场为空是合法状态，不填演示数据；空歌单不会创建 `Audio` 对象。
- 音乐播放器在首页左下透视卡片中常驻，所有非首页页面默认固定折叠到左侧，只露半张唱片；点击露出的唱片展开，点击卡片空白或按 Escape 折叠。展开后单击唱片播放或暂停，双击随机下一曲；随机顺序与金句相同，轮内不重复、跨轮不连续重复。悬停或键盘聚焦唱片时，在上方显示“歌名-歌手名”。首次进入时唱臂离盘；播放时落针、唱片旋转，减少动态效果时直接显示状态。卡片不显示旧的进度、音量、上一曲、下一曲和文字播放按钮。全站只挂载一个播放器，以 `transition:persist` 保留 DOM 和 Audio；跨客户端导航后按当前路径更新首页/侧边模式，不依赖保留下来的旧 props。
- 双击切歌时唱臂先离盘，旧唱片向左退出、新唱片从右侧进入，曲目信息在换片中点更新，动画完成后播放；减少动态效果或侧边卡片折叠时直接切换。鼠标移出唱片后曲目信息沿进入路径向下回落并淡出，约 220ms 后隐藏；键盘导航聚焦唱片时仍可查看。唱片外围的亮金色圆环只表示键盘焦点，按住唱片时内侧金色反馈只表示按压，二者都不代表播放状态。
- 已发布文章中的 Hatrix 图床 URL 必须固定到不可变 commit；当前允许 `85bc7b2b63bcf294f1079a98edf79ee1c9f41606` 和 `b4dd348363960f7d4b41f3cd95d9c6f00a02fe48`。新增同源图片也要带 `@<commit>`；增加 ref 时，同时更新 `astro.config.ts` 中 jsDelivr 与 GitHub Raw 的同仓库、同 commit、精确 `/img/**` remote pattern，以及 inventory 测试。Astro 会逐跳校验重定向，不能为了接受 jsDelivr 的 GitHub Raw 跳转而放宽整个主机。文章列表题图走 Astro/Sharp，正文远程图片经过构建预检后保留 CDN 地址，并使用 lazy/async 属性。
- Playwright 当前收集 244 项检查，保留 18 张 Windows 视觉基线，命名不含平台后缀。首页基线覆盖桌面、平板和手机，包含 v5 分块立绘、当前首页背景、年龄等级、Hatrix 名称和左下金句。收集数量不代表通过数量。Pages workflow 不运行视觉套件。
- 首页使用 `1920×1080` 设计画布并等比缩放。右侧 7 个面板共用一个 `matrix3d` 父平面，子卡片只设置局部位置和尺寸，不单独旋转；组内间距保持固定。超宽屏用纯 CSS 平移左右两组贴近视口边缘，竖屏留上下空白，不改为单列。角色层运行时使用 `public/assets/home/character-parts/*.webp` 裁边 WebP，分块源 PNG 位于 `public/assets/home/character-parts-source/`。用户明确选定的原始 v5 PNG `public/assets/home/hatrix-character-v5.png` 仍是合成和视觉核对基准，保留该版本的全部人物与外围元素；此前迭代中的元素删减要求不再用于改写这张已选定图片。立绘按前景近景比例裁在画布内；首页背景使用 `public/assets/home/cover.webp`，原图 `public/assets/home/cover.png` 同目录保留，墙面采用与人物灰紫装甲协调的低对比色；其他页面背景使用用户选定的 `public/assets/backgrounds/background.png`，独立维护。首页候选图和其他非内页背景图不放入 `public/assets/backgrounds/`。原始 v8 归档在 `docs/design-references/previous-backgrounds/`，未选用背景留作对比素材。人物位于背景之上、入口面板之下，允许与卡片重叠，不拦截输入；不恢复旧打字、箭头或拖动揭开逻辑。首页无滚动，不渲染普通导航栏、页脚、Sakana 或 CursorTrail。
- 首页金句语料在 `src/data/home-quotes.ts`，每 6 秒按随机轮次自动切换；每轮完整播放全部语录，轮内不重复，跨轮不连续重复。正常动效为 420ms 竖向滚动和透明度变化；正文保持单行，超出一行时自动缩小字号，出处字号为当前正文字号的 0.618；正文左对齐并在卡片内垂直居中，出处右对齐且行盒底边与正文对齐；不提供手动切换或暂停控制；减少动态效果时仍每 6 秒换字，只取消动画。金句卡片高 70 个设计像素，正文行盒到上下边框的局部距离与到左边框的距离均约为 24 个设计像素。金句、播放器、友链、留言板和左下实验场共用一个仿射平面，均为上下边平行、左右边竖直的 2D 平行四边形；金句与下排、友链与留言板、留言板与左下实验场各隔 8 个设计像素。播放器局部宽 376、高 289 个设计像素；三张小卡片局部宽 216、高 91 个设计像素，叠放后与播放器同到局部 y=289。侧边播放器宽 330px、高 254px。金句使用不可交互的 live region，采用深蓝灰底、浅色正文和蓝灰色出处，与播放器、友链和留言板的深色面板形成区分；金句和友链共用 `--home-panel-radius: 3px`。辉光管时钟按本地时间每秒更新，格式为 `YYYY/MM/DD HH:mm:ss`。随笔卡片占分组左侧整高；“效率提升”仅作右侧标题，下方是收藏夹和工具箱；计划和实验场分别为 `/plans/`、`/lab/`。
- 首页左下卡片组整体上移 60 个设计像素，仿射平面四角为 `[(399,708),(606,696),(606,784),(399,796)]`。三张小卡片左边缘向播放器扩 8 个设计像素，横向间隔为 8 个设计像素。留言板下方间隔 8 个设计像素再放一张同尺寸的实验场卡片，仍链接 `/lab/`；右下原实验场位置改为资讯，链接 `/digest/`，保留原配色、电路纹理与尺寸。资讯图标依照用户提供的 `icon-information.svg` 重画为左右错层的信息板剪影；资讯页无内容时显示空状态。
- 首页左侧等级圆环保留，Hatrix 名称位于其右侧，使用本地 Orbitron 800 字重与少量链接青辉光；卡片英文副标题仍使用 Arial 字体栈。生日为 `2002-07-29`，等级按北京时间的周岁计算，每年 7 月 29 日零点升级；进度为距上次生日的整天数除以两次生日之间的实际天数（365 或 366）。浏览器进入首页、跨日和恢复页面时更新，不使用构建日期；无 JavaScript 时显示未知等级。
- 主导航对应的栏目页不渲染 Hero 主标题或副标题栏，正文直接接在固定导航下方；桌面端主要内容上沿与作品橱窗柜体上沿对齐。博客页卡片在导航栏下方居中，上下各留约 16px，基本占满剩余视口高度。归档、旧分页和 404 仍可使用紧凑 Hero；文章详情保持标题和元信息开头，不恢复题图横幅；全站不渲染波浪分隔。
- 当前仅文章页启用页脚及站点统计，普通布局默认不显示页脚；页脚版权区显示版权与“保留所有权利”，不提供第三方许可入口；`public/third-party-notices.txt` 仍随构建产物发布。只有配置真实备案信息后才允许增加法规要求的备案链接。
- `SidebarStack` 承载作者资料，统计按页面配置显示；当前关于页及子页只显示作者资料。文章侧栏显示完整的二至四级目录和最近文章；桌面宽屏下整个侧栏能放入可用视口时才固定，否则跟随页面且不启用内部滚动。文章页滚动超过 `480px` 时显示右下角返回顶部按钮，其他页面不挂载。播放器独立于侧栏。Vercount 只在生产环境加载固定脚本 `https://events.vercount.one/js`；开发和测试不得请求该服务，加载失败时访客数保持 `—`。
- Sakana 的许可和素材来源告知固定在 `public/third-party-notices.txt`，构建后必须复制到 `dist/third-party-notices.txt`。内置千束与泷奈插画只用于非商业网页；站点用途或依赖版本变化时必须重新核对授权。
- 若视觉差异只出现在含远程图片的文章，先核对 `reports/image-check.json`。临时失败恢复后应重跑 `check:images`、清理根目录 `.astro/` 和 `node_modules/.astro/data-store.json`，再执行 `astro sync`；不要直接更新视觉基线。
- `check:images` 负责远程图片，`check:protected` 负责 `dist/` 明文与原资源泄漏。保护审计或密文测试失败时先找泄漏根因，不得放宽检查、替换期望密文或直接更新密文基线。
- 生产构建生成的 `.astro/` 是带密构建状态，可能包含私有文章正文、渲染 HTML 和源路径，不得缓存、上传或提交；生产 workflow 必须在上传产物前删除它。
- 全站固定使用深色配色，不提供日夜切换按钮或动画。Twikoo 评论直接渲染在页面 DOM 中，样式由 `src/styles/twikoo.css` 管理；前端脚本固定到 2.0.13 并使用 SRI，评论后端为独立的 `comments.hatrix.site`。Astro 客户端跳转时须保留 Twikoo 注入的 `style[data-twikoo]`，否则头像和控件会失去尺寸。后端评论表单只显示并要求昵称，表情、排序、系统及浏览器信息关闭；前端不显示评论数、访客网址跳转。站长头像只用于经管理员身份标记的留言。评论卡片操作栏在鼠标移入或键盘聚焦时显现，触控设备常显。
- 生产 CSP 和 Referrer Policy 的唯一来源是 `src/config/security.ts`。`hash-wasm` 的 Argon2 依赖 `'wasm-unsafe-eval'`，不得换成通用 `'unsafe-eval'`。新增第三方脚本、框架、远程图片或媒体来源时，必须同时更新策略、构建产物测试和生产预览取证，不能只放宽 `default-src`。
- 已发布 Markdown 由 `remark-content-security.ts` 拒绝可执行原始 HTML、危险 URL、任意 `srcset` 和未固定的远程图片；原始 `style` 只允许单条 `zoom: <正整数>%`。不要用 sanitizer 静默改写正文。
- Pages workflow 的 Action 固定到完整 commit SHA，checkout 不保留凭据，手动发布只能来自 `master`；升级 Action 时同步更新版本注释和配置测试。
- `hatrix.site` 的权威 DNS 和网站代理位于 Cloudflare，源站仍是 GitHub Pages；当前 NS 是 `eugene.ns.cloudflare.com` 与 `millie.ns.cloudflare.com`。外部配置保持 Full (strict)、最低 TLS 1.2、六个月 HSTS、DNSSEC 和全站安全响应头。修改 NS、DNSSEC、HSTS、代理状态或响应头前先按 `docs/operations/cloudflare.md` 核对顺序，不能只改仓库。
- `check:site` 在随笔集合为空时固定校验 1799 条站内链接。随笔集合非空时仍逐条校验站内链接，但不要求固定总数；其他固定结构变更须按本文件的站内链接计数流程更新基线。
- 未来的 3D 功能使用独立客户端岛并延迟加载，不把 3D 依赖放进公共布局。


## CI 常见陷阱

### 生产依赖审计
- `pnpm-workspace.yaml` 只忽略 `GHSA-ch52-4w7c-c8xp`。该公告影响共享 HTTP 缓存，当前没有修复版本；本站只在 Astro 静态构建阶段引入相关包，Pages 产物不运行共享缓存服务。
- Astro 解析到修复版 `http-cache-semantics` 后删除此项豁免。不得改用 `--ignore-unfixable`、降低审计等级或增加无关 GHSA。

### 远程图片审计（`check:site`）
- `check:site` 会扫描构建产物所有 HTML 的 `<img src>`，凡不在 jsDelivr 固定 commit 白名单内的外部域名均报错。
- **不能**把外部 URL 直接写进 Astro 模板的 `src` 属性；必须放在 `data-*` 属性里，由客户端 JS 赋值。
- 若某个页面的图片来源属于已知可信的外部域（如友链头像），在 `scripts/check-built-site.ts` 的 `imageSourceErrors` 函数中按路由豁免，不要放宽全局白名单。
- 豁免格式：`if (route !== '/about/friends/') { errors.push(...) }`

### 站内链接计数（`check:site` / 单元测试）
- `EXPECTED_LOCAL_LINKS` 同时存在于 `scripts/check-built-site.ts`（第 20 行）和 `tests/unit/check-built-site.test.ts`（`toBe(...)`）两处，**必须同步修改**，否则单元测试和 CI 各报一个错。
- 计数逻辑：脚本用正则扫所有构建产物 HTML 中的 `href=` 和 `src=` 属性，过滤出站内路径后累加。导航栏、页脚、组件内的每个站内 `href`/`src` 都会在**每个页面**重复计入，因此每新增一个全局导航项，计数增量约等于总页面数。
- **只有在明确知道增删了多少链接节点时才修改这个值**——不要看到 CI 报错就跟着 CI 日志的"found N"改；CI 偶发的构建差异（缓存、私有文章数变化）会导致数字不稳定。
- 正确流程：本地执行 `corepack pnpm build && corepack pnpm check:site` 失败后，日志第一行 `Checked N local links` 的 N 才是当前稳定值，以此更新两处。

### TypeScript 检查（`check`）
- Astro 模板 frontmatter 中定义的变量不能在模板体里使用未声明的别名；`getStaticPaths` 传入的 `props` 中没有的变量名会在 `corepack pnpm check` 时报 `ts(2304)`。
- 新增或修改动态路由页面后，局部运行 `corepack pnpm check` 确认无类型错误再推送。

### 访客计数不显示（`SiteStats` + Vercount）
- `bindSiteStats()` 在 `showClock={false}` 时不渲染 `canvas`/`time` 元素；若守卫条件把 `canvas`/`time` 和 `visitors` 绑定在同一个 `return`，无时钟的 `SiteStats` 永远不会把访客数同步到页面。
- 规则：`visitors.setAttribute('data-visitor-count', '')` 必须在 `canvas`/`time` 检查**之前**执行；无时钟时单独调用 `synchronizeVisitorCount()` 后 return。

### 测试 fixture 中的预期报错
- `tests/unit/` 下的部分测试会故意构造违规 Markdown（含 `<img>` 原始 HTML、forbidden URL 等）来验证 remark 插件的拒绝行为。构建日志中出现 `"包含原始 HTML 图片"` 或 `"forbidden raw HTML tag"` 并指向 `/tmp/` 或 `/E:/post.md` 路径时，属于测试 fixture 的正常输出，不是需要修复的 bug。

### 推送前必须先跑单元测试和站点检查
- **每次推送前必须按顺序本地执行以下两步，全部通过后才能 `git push`**；不要依赖 CI 来发现失败：
  1. `corepack pnpm test:run` — 单元测试全部通过
  2. `corepack pnpm build && corepack pnpm check:site` — 构建产物通过站点链接检查
- **新增或删除页面、组件、导航项等导致站内链接数量变化时**，`check:site` 会报 `Expected N links, found M`；正确流程：本地跑完 `build && check:site` 后，以日志第一行 `Checked M local links` 的 M 为准，同步更新 `scripts/check-built-site.ts`（第 20 行 `EXPECTED_LOCAL_LINKS`）和 `tests/unit/check-built-site.test.ts`（`toBe(...)`）两处，再重跑 `test:run` 和 `check:site` 确认通过。
- 修改以下任何一项时，必须同步检查并更新对应测试：
  - `src/config/navigation.ts`（路径、标签变动）→ `tests/unit/navigation-config.test.ts` 中的 href/label 断言。
  - `src/scripts/music-player.ts`（逻辑、DOM 结构变动）→ `tests/unit/music-player.test.ts` 中的 source contains 断言和 fixture。
  - `src/components/MusicPlayer.astro`（data 属性增删）→ `tests/unit/music-player.test.ts` 中对应的 `toContain` 断言。
- **fixture 需跟进脚本改动**：若脚本新增了对 DOM 属性（如 `player.style`、`panel.style`）的访问，测试 fixture 里的模拟对象也要同步加上该属性，否则会抛 `Cannot set properties of undefined`。
- **source-contains 断言需跟进代码改动**：测试用 `readFile` 做字符串断言时，断言内容必须与源码完全一致，包括括号和运算符（如 `tracks.length - 1` vs `tracks.length`）。
## 禁止事项

- 不恢复 Ruby、旧主题目录或一次性迁移脚本。
- 不恢复根目录 `CNAME`；只修改 `public/CNAME`。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/` 或 Playwright trace。
- 不提交 `.env.local`、`.private-content/`、`.private-snippets/` 或其中任何私密内容。
- 未经用户明确要求，不推送、合并、部署或修改远端 Pages 设置。
- 用户明确要求推送或部署时，部署确认成功后必须检查公开仓库和 `.private-content` 私有仓库的 `git worktree list`，停止占用待删 worktree 的预览进程，删除已合并、工作区干净且提交已推送的临时 worktree，再执行 `git worktree prune`。仍在开发、含未提交或未推送内容、用途不明的 worktree 不得删除。
- 不复制参考站源码、文案或个人资产。
- 每次完成项目改动后，自动启动本地开发预览，并在最终回复中提供可 Ctrl+点击的 `http://127.0.0.1:4321/` Markdown 链接。除非用户明确要求停止，预览保持运行。

## 深入文档

- `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md`：范围、架构、内容模型与验收标准。
- `docs/superpowers/plans/2026-09-01-astro-blog-rebuild.md`：任务拆分、测试设计和实现顺序。
- `docs/superpowers/specs/2026-09-03-remove-taxonomy-design.md`：删除文章分类与标签后的架构约束。
- `docs/superpowers/plans/2026-09-03-remove-taxonomy.md`：分类与标签删除步骤和验证记录。
- `docs/superpowers/specs/2026-09-03-navigation-content-hubs-design.md`：已移除文章类型功能的历史导航设计。
- `docs/superpowers/plans/2026-09-03-navigation-content-hubs.md`：已移除文章类型功能的历史实施记录。
- `docs/superpowers/specs/2026-09-03-non-home-banner-design.md`：非首页 Banner 高度、文章信息布局和波浪边界。
- `docs/superpowers/plans/2026-09-03-non-home-banner.md`：非首页 Banner 压缩的测试与实施步骤。
- `docs/superpowers/specs/2026-09-03-cursor-trail-design.md`：实验场鼠标尾迹的动画、生命周期和性能边界。
- `docs/superpowers/plans/2026-09-03-cursor-trail-activation-regions.md`：已被全视口触发规则取代的正文高度门控历史记录。
- `docs/superpowers/plans/2026-09-04-cursor-trail-multi-session.md`：多轨迹会话、自然收敛和导航保留的实施记录。
- `docs/superpowers/plans/2026-09-04-cursor-trail-blog-exclusion.md`：博客菜单路由禁用轨迹的实施记录。
- `docs/superpowers/specs/2026-09-03-horizontal-post-rail-design.md`：横向文章栏、博客视图切换和无 JavaScript 降级设计。
- `docs/superpowers/plans/2026-09-03-horizontal-post-rail.md`：横向文章栏的实施与验证记录。
- `docs/superpowers/specs/2026-09-03-compact-legal-footer-design.md`：极简法律页脚和备案信息边界。
- `docs/superpowers/plans/2026-09-03-compact-legal-footer.md`：法律页脚的实施与验证记录。
- `docs/superpowers/specs/2026-09-03-security-hardening-design.md`：仓库安全策略、内容边界和 Cloudflare 分阶段方案。
- `docs/superpowers/plans/2026-09-03-security-hardening.md`：仓库安全加固的测试与实施步骤。
- `docs/operations/cloudflare.md`：Cloudflare、权威 DNS、DNSSEC、响应头和回退操作。
- `docs/superpowers/specs/2026-09-03-protected-content-design.md`：私有内容仓库、SSR 加密、浏览器凭据、部署与安全边界。
- `docs/superpowers/plans/2026-09-03-protected-content.md`：加锁内容的任务拆分和验证记录。
- `docs/superpowers/specs/2026-09-04-contextual-sidebar-design.md`：关于页与文章页共享侧栏、站点统计和点阵时钟设计。
- `docs/superpowers/plans/2026-09-04-contextual-sidebar.md`：共享侧栏的任务拆分、第三方统计边界和验证步骤。
- `docs/superpowers/specs/2026-09-04-homepage-cover-reveal-design.md`：旧首页全屏封面、打字文案和拖动揭开设计，仅作历史记录。
- `docs/superpowers/plans/2026-09-04-homepage-cover-reveal.md`：旧首页封面与揭开切换的测试和实施记录。
- `docs/superpowers/specs/2026-09-25-home-dashboard-design.md`：现行首页透视画布、入口、金句、时钟及全站播放器模式。
