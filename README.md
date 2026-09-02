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
pnpm build
pnpm check:site
pnpm test:e2e
```

`pnpm build` 会先运行远程图片预检，再生成静态站点。只想检查图片时，可单独运行 `pnpm check:images`。这两个命令会自动启用 Node 的环境代理支持；本机需要代理联网时，保留标准的 `HTTPS_PROXY` 配置即可。

## 内容目录

- `src/content/posts/`：已发布文章
- `src/drafts/`：不参与构建的草稿
- `src/content/projects/`：作品集合，目录可以为空
- `src/data/playlist.ts`：音乐列表
- `public/`：CNAME、favicon、头像和本地静态资源

当前仓库有 40 篇文章和 2 篇草稿；一次完整构建会生成 80 个 HTML 页面。

## 新增文章

在 `src/content/posts/` 新建 Markdown 或 MDX 文件。文件名不决定公开地址，路由由 `legacySlug` 生成。完整 frontmatter 如下：

```yaml
---
title: 示例文章
description: 用一句话说明文章内容
pubDate: 2026-09-02
updatedDate: 2026-09-03
cover: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/example.png
category: 软件工程与工具
tags:
  - Astro
  - TypeScript
series: Astro 实践
seriesOrder: 0
draft: false
math: false
mermaid: false
legacySlug: 示例文章
---
```

`updatedDate` 可省略。`series` 和 `seriesOrder` 必须同时填写或同时省略，`seriesOrder` 是非负整数。其余字段都要保留；`tags` 可以是空数组。

`category` 只接受以下六类：

- `FPGA 与数字系统`
- `嵌入式与硬件`
- `AI 与图形计算`
- `软件工程与工具`
- `数学与基础`
- `随笔与资源`

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

`id`、`title`、`artist` 和 `src` 必填，`cover` 可省略。播放列表为空时，播放器位于页脚后的普通文档流，不会创建 `Audio` 对象或请求音频文件；列表有曲目后才固定在页面右下角。

## 图片策略

文章共引用 254 个去重后的 jsDelivr 图片 URL。现有发布文章全部固定到图床仓库提交 `85bc7b2b63bcf294f1079a98edf79ee1c9f41606`，不会随默认分支删改而漂移。新增文章引用同一图床时也必须使用带 `@<commit>` 的不可变 URL；如果改用新提交，要同时更新 `astro.config.ts` 的精确 `/img/**` 规则和图片 inventory 测试。

构建会检查这些地址，并把结果写到忽略提交的 `reports/image-check.json`：题图失败会终止构建，正文位图失败时会改用本地占位图并保留原地址。两篇 `src/drafts/` 草稿不参与发布和图片 inventory，因此没有机械改写其中的历史链接。

文章列表的 `cover` 由 Astro 的图片管线和 Sharp 生成 WebP、`srcset` 与尺寸信息。正文远程图片通过预检后仍使用 CDN 地址，并输出 `loading="lazy"` 和 `decoding="async"`；GIF 和 SVG 不做有损转换。

## 测试矩阵

| 命令 | 检查内容 |
| --- | --- |
| `pnpm test:run` | 内容 schema、URL、聚合逻辑、图片和构建检查脚本 |
| `pnpm check` | Astro 与 TypeScript 诊断 |
| `pnpm check:images` | 254 个去重后的远程图片 URL |
| `pnpm build` | 图片预检与 80 页静态构建 |
| `pnpm check:site` | 旧文章路由、CNAME、4653 条站内链接和发布体积 |
| `pnpm test:e2e` | Chromium 的桌面、平板和手机检查，共 62 项；其中 21 张视觉快照在 Windows 生成，文件名不含平台后缀 |

Pages workflow 不运行视觉套件，避免 Linux 渲染差异改写 Windows 基线。合并前仍应在 Windows 本地运行 `pnpm test:e2e`。

如果视觉差异只出现在含远程图片的文章，先查看 `reports/image-check.json`。临时失败恢复后，重新运行 `pnpm check:images`，删除 `.astro/` 并执行 `pnpm exec astro sync`，再运行视觉测试。不要把远程图片未加载完整造成的页面高度变化写入基线。

新增或删除页面、导航项等内容后，如果站内链接总量发生了合理变化，先核对构建产物，再同步更新 `scripts/check-built-site.ts` 中的期望值；未更新时 `pnpm check:site` 会失败。

## 部署

`.github/workflows/pages-deploy.yml` 在 `master` push 或手动触发时构建 `dist/` 并发布到 GitHub Pages；pull request 只执行构建门禁，不部署。自定义域名写在 `public/CNAME`，Astro 构建后必须原样出现在 `dist/CNAME`。

不要恢复根目录 `CNAME`，也不要提交 `dist/`、`.astro/`、`reports/` 或 Playwright 运行产物。

## 后续 3D 页面

Three.js、Babylon.js 等 3D 依赖不能进入公共布局或普通页面的首屏脚本。新增 3D 功能时，把它放在独立客户端岛中，并在组件进入视口或用户操作后延迟加载。

## 许可证

当前站点源码与文章未另行授予开源许可；历史 Chirpy 许可和来源可从 Git 历史追溯。
