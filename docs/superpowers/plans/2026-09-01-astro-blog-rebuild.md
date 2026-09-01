# Astro 个人博客重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 GitHub Pages、自定义域名和旧文章 URL 的前提下，将现有 Jekyll/Chirpy 博客重写为参考 linn-ylz.com 视觉结构的 Astro 静态站点，并迁移 40 篇文章。

**Architecture:** Astro 在构建期读取经过 schema 校验的文章和作品集合，生成首页、文章、归档、分类、标签、作品、关于、RSS、站点地图和搜索索引。普通内容输出静态 HTML；搜索、移动端菜单、主题、灯箱、Mermaid 和音乐播放器使用小型客户端脚本。重构在独立 Git worktree 中完成，旧 Jekyll 站保留到新站全部验证通过后再清理。

**Tech Stack:** Node.js 24、pnpm、Astro、TypeScript、Vitest、Playwright、Astro Content Collections、Astro View Transitions、KaTeX、Mermaid、MiniSearch、PhotoSwipe、Giscus、GitHub Actions、GitHub Pages。

## Global Constraints

- 执行前必须调用 `superpowers:using-git-worktrees`，从当前 `master` 创建 `feature/astro-blog-rebuild` worktree；不得在对照用的旧站目录中直接重写。
- 实现和修复遵循 `karpathy-guidelines` 与 `superpowers:test-driven-development`：先写失败测试，再写最小实现。
- 输出必须是纯静态站点；不得增加服务器、数据库、上传、下载中心或对象存储。
- 保留 `public/CNAME`、`https://hatrix.site`、Giscus 参数和全部 `/posts/<文章名>/` 地址。
- 迁移 40 篇文章，正文不改写；只补充分类、标签、系列和日期等元数据。
- 音乐列表与作品集合首版为空，不放演示假数据。
- 不引入 3D 依赖。后续 3D 页面通过独立客户端岛接入。
- 视觉参考 linn-ylz.com，但代码、文案、图片、头像和 Logo 使用本项目自己的内容。
- 不复制参考站的超长空白、移动端重复内容等缺陷。
- 干净构建少于 8 分钟，发布目录小于 1 GB；首页客户端 JavaScript gzip 后不超过 160 KB，不计 Giscus iframe。
- 未经用户确认不得推送、合并、部署或修改远端 GitHub Pages 设置。

## File Map

下列路径均相对于 Astro worktree 根目录。

- `package.json`、`pnpm-lock.yaml`、`.node-version`：Node、依赖和命令入口。
- `astro.config.ts`、`tsconfig.json`、`src/content.config.ts`：Astro、Markdown、TypeScript 和内容 schema。
- `src/config/site.ts`：站名、域名、作者、社交链接和 Giscus 参数。
- `src/content/posts/`：迁移后的 40 篇文章。
- `src/content/projects/`：允许为空的作品集合；首次添加作品时创建目录。
- `src/drafts/`：从非标准 `_draft` 目录保留的两篇未发布草稿，不参与构建。
- `src/data/playlist.ts`：有类型约束的空播放列表。
- `src/lib/content.ts`：排序、分页、归档、分类、标签、系列和上下篇。
- `src/lib/urls.ts`：旧 slug 和站内 URL 生成。
- `src/lib/search.ts`：搜索文档序列化。
- `src/layouts/BaseLayout.astro`、`src/layouts/PostLayout.astro`：公共页面和文章骨架。
- `src/components/`：导航、题图、波浪、文章卡、侧栏、目录、搜索、播放器、作品空状态和页脚。
- `src/pages/`：所有静态路由、RSS、站点地图辅助端点和搜索索引。
- `src/styles/tokens.css`、`global.css`、`prose.css`：颜色、尺寸、响应式布局和正文样式。
- `src/scripts/`：浏览器端主题、菜单、目录、Mermaid、灯箱和播放器逻辑。
- `scripts/check-images.ts`、`scripts/check-built-site.ts`：图片预检和构建产物检查。
- `tests/unit/`、`tests/e2e/`：Vitest 与 Playwright。
- `.github/workflows/pages-deploy.yml`：Node/Astro Pages 部署。

---

### Task 1: 创建隔离 worktree，并搭好 Astro 测试骨架

**Files:**
- Create: `.node-version`
- Modify: `.gitignore`
- Replace: `package.json`
- Create: `astro.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/pages/index.astro`
- Create: `tests/unit/smoke.test.ts`
- Copy: `CNAME` -> `public/CNAME`

**Interfaces:**
- Consumes: 当前仓库 `HEAD` 和已确认的设计、计划文档。
- Produces: Node 24 + pnpm 的 Astro 工程，提供 `dev`、`build`、`check`、`test`、`test:run`、`test:e2e`、`migrate:posts`、`check:images`、`check:site` 命令。

- [ ] **Step 1: 创建 worktree**

调用 `superpowers:using-git-worktrees`，将新 worktree 放在与旧仓库同级且不冲突的目录，例如 `E:\CollegeData\hatrixxxx.github.io-astro`，分支名为 `feature/astro-blog-rebuild`。

Run: `git worktree list`

Expected: 原仓库仍位于 `master`；新目录位于 `feature/astro-blog-rebuild`。

- [ ] **Step 2: 写失败的测试骨架**

Create `tests/unit/smoke.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Astro project bootstrap', () => {
  it('keeps the production custom domain file', () => {
    expect(readFileSync('public/CNAME', 'utf8').trim()).toBe('hatrix.site');
  });

  it('defines a static build command', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.build).toBe('astro build');
  });
});
```

Run: `pnpm vitest run tests/unit/smoke.test.ts`

Expected: FAIL because `public/CNAME` and the Astro package scripts do not exist.

- [ ] **Step 3: 安装最小依赖并写配置**

First replace `package.json` with:

```json
{
  "name": "hatrix-blog",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "migrate:posts": "tsx scripts/migration/migrate-posts.ts",
    "check:images": "tsx scripts/check-images.ts",
    "check:site": "tsx scripts/check-built-site.ts"
  }
}
```

Then run:

```powershell
Set-Content -LiteralPath .node-version -Value '24'
corepack enable
pnpm add astro @astrojs/check @astrojs/rss @astrojs/sitemap gray-matter katex mermaid minisearch photoswipe reading-time rehype-katex remark-math
pnpm add -D typescript vitest @playwright/test tsx
New-Item -ItemType Directory -Force public | Out-Null
Copy-Item -LiteralPath CNAME -Destination public/CNAME
```

Create `astro.config.ts`:

```ts
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://hatrix.site',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'github-dark' }
  }
});
```

Create `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] }
});
```

Create `src/pages/index.astro` as the temporary valid Astro route:

```astro
---
const title = "Hatrix's 窝";
---

<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>{title}</title></head>
  <body><main><h1>{title}</h1></main></body>
</html>
```

Append to `.gitignore`:

```gitignore
dist/
.astro/
.pnpm-store/
playwright-report/
test-results/
reports/
```

- [ ] **Step 4: 验证工程骨架**

Run: `pnpm test:run`

Expected: PASS, 2 tests。

Run: `Test-Path CNAME; Test-Path public/CNAME`

Expected: both values are `True`。

- [ ] **Step 5: 提交**

```bash
git add .node-version .gitignore package.json pnpm-lock.yaml astro.config.ts tsconfig.json vitest.config.ts src/pages/index.astro tests/unit/smoke.test.ts public/CNAME
git commit -m "build: bootstrap Astro project"
```

---

### Task 2: 定义站点配置和内容 schema

**Files:**
- Create: `src/config/site.ts`
- Create: `src/content.config.ts`
- Create: `src/types/content.ts`
- The projects collection may stay absent while empty; create `src/content/projects/` with the first real entry.
- Create: `src/data/playlist.ts`
- Create: `tests/unit/content-schema.test.ts`

**Interfaces:**
- Produces: `SITE`、`POST_CATEGORIES`、`PostData`、`ProjectData`、`Track`、`playlist`。
- Consumers: 所有 layout、页面、迁移脚本和内容查询工具。

- [ ] **Step 1: 写 schema 和空集合测试**

Create `tests/unit/content-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { POST_CATEGORIES, SITE } from '../../src/config/site';
import { playlist } from '../../src/data/playlist';

describe('content contracts', () => {
  it('uses the six approved categories', () => {
    expect(POST_CATEGORIES).toEqual([
      'FPGA 与数字系统', '嵌入式与硬件', 'AI 与图形计算',
      '软件工程与工具', '数学与基础', '随笔与资源'
    ]);
  });

  it('starts with empty projects and playlist data', () => {
    expect(playlist).toEqual([]);
    expect(SITE.giscus.mapping).toBe('pathname');
  });
});
```

Run: `pnpm vitest run tests/unit/content-schema.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 2: 实现站点配置**

Create `src/config/site.ts`:

```ts
export const POST_CATEGORIES = [
  'FPGA 与数字系统',
  '嵌入式与硬件',
  'AI 与图形计算',
  '软件工程与工具',
  '数学与基础',
  '随笔与资源'
] as const;

export const SITE = {
  title: "Hatrix's 窝",
  tagline: '轻松即单纯，速成即精准',
  description: '技术研发、学习记录与作品展示',
  url: 'https://hatrix.site',
  author: {
    name: 'Hatrix',
    email: '3113624526@qq.com',
    avatar: '/images/avatar.jpg'
  },
  socials: [
    { label: 'GitHub', url: 'https://github.com/HatrixXXX' },
    { label: 'Gitee', url: 'https://gitee.com/hatrixxxx' },
    { label: 'Bilibili', url: 'https://space.bilibili.com/352420563' },
    { label: '知乎', url: 'https://www.zhihu.com/people/hatrixxxx' }
  ],
  giscus: {
    repo: 'hatrixxxx/hatrixxxx.github.io',
    repoId: 'R_kgDORB9GlQ',
    category: 'Comments',
    categoryId: 'DIC_kwDORB9Glc4DACF_',
    mapping: 'pathname'
  },
  verification: { bing: '3B97E495A5055898AEC92C5FF736F169' }
} as const;
```

- [ ] **Step 3: 实现集合与类型**

Create `src/types/content.ts`:

```ts
import { POST_CATEGORIES } from '../config/site';
export type PostCategory = (typeof POST_CATEGORIES)[number];

export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
  cover?: string;
}
```

Create `src/data/playlist.ts`:

```ts
import type { Track } from '../types/content';
export const playlist: readonly Track[] = [];
```

Create `src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { POST_CATEGORIES } from './config/site';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    cover: z.string().min(1),
    category: z.enum(POST_CATEGORIES),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    seriesOrder: z.number().int().nonnegative().optional(),
    draft: z.boolean().default(false),
    math: z.boolean().default(false),
    mermaid: z.boolean().default(false),
    legacySlug: z.string().min(1)
  }).superRefine((value, ctx) => {
    if ((value.series === undefined) !== (value.seriesOrder === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'series and seriesOrder must be set together' });
    }
  })
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['idea', 'active', 'done', 'archived']),
    cover: z.string().optional(),
    tech: z.array(z.string()).default([]),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    featured: z.boolean().default(false),
    order: z.number().int().default(0)
  })
});

export const collections = { posts, projects };
```

- [ ] **Step 4: 运行检查**

Run: `pnpm test:run`

Expected: PASS, 4 tests。

Run: `pnpm check`

Expected: PASS, no errors。

- [ ] **Step 5: 提交**

```bash
git add src tests/unit
git commit -m "feat: define site and content contracts"
```

---

### Task 3: 用可重复脚本迁移 40 篇文章

**Files:**
- Create: `scripts/migration/classify-post.ts`
- Create: `scripts/migration/migrate-posts.ts`
- Create: `tests/unit/classify-post.test.ts`
- Create: `tests/unit/migrate-posts.test.ts`
- Create: `src/content/posts/*.md` (40 files, generated)
- Create: `src/drafts/*.md` (2 files, copied verbatim and never published)

**Interfaces:**
- Produces: `classifyPost(title): Classification`、`seriesFor(title): SeriesInfo | undefined`、`toPostFrontmatter(...)`。
- Consumers: 迁移脚本和迁移测试；生成的文章供 Content Collections 使用。

- [ ] **Step 1: 写分类失败测试**

Create `tests/unit/classify-post.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyPost, seriesFor } from '../../scripts/migration/classify-post';

describe('post classification', () => {
  it.each([
    ['FPGA开发(3)AXI协议', 'FPGA 与数字系统'],
    ['旋翼飞行器硬件选型', '嵌入式与硬件'],
    ['3DGS前向渲染(2)CUDA光栅化', 'AI 与图形计算'],
    ['Docker简介', '软件工程与工具'],
    ['本科数学大杂烩', '数学与基础'],
    ['杂货铺', '随笔与资源']
  ])('%s -> %s', (title, category) => {
    expect(classifyPost(title).category).toBe(category);
  });

  it('extracts numbered series order', () => {
    expect(seriesFor('画板子系列(2)个人规范')).toEqual({ name: '画板子系列', order: 2 });
  });
});
```

Run: `pnpm vitest run tests/unit/classify-post.test.ts`

Expected: FAIL because the classifier does not exist.

- [ ] **Step 2: 实现确定性分类规则**

Create `scripts/migration/classify-post.ts`:

```ts
import type { PostCategory } from '../../src/types/content';

export interface Classification { category: PostCategory; tags: string[] }
export interface SeriesInfo { name: string; order: number }

const CATEGORY_RULES: Array<[PostCategory, RegExp]> = [
  ['FPGA 与数字系统', /Verilog|FPGA|ZYNQ|AXI|数字集成电路/i],
  ['嵌入式与硬件', /STM32|嵌入式|通讯协议|旋翼|标准件|RLC|CMOS|灵巧手|FOC|画板子|PCB/i],
  ['AI 与图形计算', /3DGS|GEMM|AI加速器|加速器芯片|CUDA|光栅化/i],
  ['软件工程与工具', /ROS2|设计模式|Docker|Bash|Linux|git|github|工具箱/i],
  ['数学与基础', /数学|计算机组成/i]
];

const TAG_RULES: Array<[string, RegExp]> = [
  ['Verilog', /Verilog/i], ['Vivado', /Vivado/i], ['Vitis', /Vitis/i],
  ['FPGA', /FPGA|ZYNQ|AXI|Verilog|数字集成电路/i], ['Zynq', /ZYNQ/i],
  ['AXI', /AXI/i], ['STM32', /STM32/i], ['嵌入式', /嵌入式|通讯协议/i],
  ['硬件', /旋翼|标准件|RLC|CMOS|画板子|FOC/i], ['3DGS', /3DGS/i],
  ['CUDA', /CUDA|GEMM|3DGS/i], ['AI 加速器', /AI加速器|加速器芯片/i],
  ['ROS 2', /ROS2/i], ['Docker', /Docker/i], ['Linux', /Linux|Bash/i],
  ['Git', /git|github/i], ['数学', /数学/i], ['博客', /博客搭建/i],
  ['资源整理', /工具箱|杂货铺/i]
];

const SERIES_RULES: Array<[string, RegExp]> = [
  ['CMOS 系列', /^CMOS系列\((\d+)\)/],
  ['3DGS 前向渲染', /^3DGS前向渲染\((\d+)\)/],
  ['Verilog', /^Verilog\((\d+)\)/],
  ['FPGA 开发', /^FPGA开发\((\d+)\)/],
  ['画板子系列', /^画板子系列\((\d+)\)/]
];

export function classifyPost(title: string): Classification {
  const category = CATEGORY_RULES.find(([, rule]) => rule.test(title))?.[0] ?? '随笔与资源';
  const tags = TAG_RULES.filter(([, rule]) => rule.test(title)).map(([tag]) => tag);
  return { category, tags: [...new Set(tags)] };
}

export function seriesFor(title: string): SeriesInfo | undefined {
  for (const [name, rule] of SERIES_RULES) {
    const match = title.match(rule);
    if (match) return { name, order: Number(match[1]) };
  }
}
```

- [ ] **Step 3: 写迁移集成测试**

Create `tests/unit/migrate-posts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { basename } from 'node:path';
import { toPostFrontmatter } from '../../scripts/migration/migrate-posts';

describe('Jekyll frontmatter migration', () => {
  it('preserves URL identity and media flags', () => {
    const result = toPostFrontmatter(
      basename('2026-02-25-FPGA开发(3)AXI协议.md'),
      { title: 'FPGA开发(3)AXI协议', description: 'AXI', math: true, mermaid: true,
        image: { path: 'https://cdn.jsdelivr.net/example.png' } },
      '2026-02-26T00:00:00+08:00'
    );
    expect(result.legacySlug).toBe('FPGA开发(3)AXI协议');
    expect(result.seriesOrder).toBe(3);
    expect(result.cover).toContain('https://');
    expect(result.math).toBe(true);
  });
});
```

Run: `pnpm vitest run tests/unit/migrate-posts.test.ts`

Expected: FAIL because the migration module does not exist.

- [ ] **Step 4: 实现并运行迁移**

Create `scripts/migration/migrate-posts.ts` with these exported rules:

```ts
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import { classifyPost, seriesFor } from './classify-post';

export function toPostFrontmatter(fileName: string, source: Record<string, any>, updatedDate?: string) {
  const match = fileName.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/u);
  if (!match) throw new Error(`Unsupported post filename: ${fileName}`);
  const title = String(source.title ?? match[2]);
  const classification = classifyPost(title);
  const series = seriesFor(title);
  return {
    title,
    description: String(source.description ?? title),
    pubDate: match[1],
    ...(updatedDate ? { updatedDate } : {}),
    cover: String(source.image?.path ?? '/images/default-cover.svg'),
    category: classification.category,
    tags: classification.tags,
    ...(series ? { series: series.name, seriesOrder: series.order } : {}),
    draft: false,
    math: Boolean(source.math),
    mermaid: Boolean(source.mermaid),
    legacySlug: title
  };
}

function lastModified(path: string): string | undefined {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', path], { encoding: 'utf8' }).trim() || undefined;
  } catch { return undefined; }
}

async function main() {
  const sourceDir = '_posts';
  const outputDir = 'src/content/posts';
  const files = (await readdir(sourceDir)).filter((name) => name.endsWith('.md')).sort();
  if (files.length !== 40) throw new Error(`Expected 40 posts, found ${files.length}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  for (const file of files) {
    const sourcePath = join(sourceDir, file);
    const parsed = matter(await readFile(sourcePath, 'utf8'));
    const data = toPostFrontmatter(file, parsed.data, lastModified(sourcePath));
    await writeFile(join(outputDir, basename(file)), matter.stringify(parsed.content, data), 'utf8');
  }
  const draftDir = 'src/drafts';
  await rm(draftDir, { recursive: true, force: true });
  await mkdir(draftDir, { recursive: true });
  for (const file of (await readdir('_draft')).filter((name) => name.endsWith('.md'))) {
    await writeFile(join(draftDir, file), await readFile(join('_draft', file), 'utf8'), 'utf8');
  }
}

if (process.argv[1]?.endsWith('migrate-posts.ts')) await main();
```

Run: `pnpm migrate:posts`

Expected: `src/content/posts` contains exactly 40 Markdown files; `src/drafts` contains exactly 2 Markdown files and is not registered as a content collection.

Run: `pnpm test:run && pnpm check`

Expected: PASS; Astro reports 40 valid post entries and zero schema errors.

- [ ] **Step 5: 人工核对迁移差异并提交**

Run:

```powershell
(Get-ChildItem _posts -File).Count
(Get-ChildItem src/content/posts -File).Count
(Get-ChildItem src/drafts -File -Filter '*.md').Count
rg -n "^legacySlug:|^category:|^series:" src/content/posts
```

Expected: the first two counts are 40 and the draft count is 2；每篇发布文章都有 `legacySlug` 和 `category`；五个编号系列含 `series`。

```bash
git add scripts/migration src/content/posts src/drafts tests/unit
git commit -m "feat: migrate Jekyll posts into Astro collections"
```

---

### Task 4: 实现内容查询、旧 URL 和索引工具

**Files:**
- Create: `src/lib/content.ts`
- Create: `src/lib/urls.ts`
- Create: `src/lib/search.ts`
- Create: `tests/unit/content-utils.test.ts`
- Create: `tests/unit/urls.test.ts`

**Interfaces:**
- Produces: `sortPosts`、`paginatePosts`、`buildArchives`、`buildTaxonomy`、`getAdjacentPosts`、`postPath`、`toSearchDocument`。
- Consumers: 首页、分页、归档、分类、标签、文章页、页脚和搜索索引。

- [ ] **Step 1: 写失败测试**

Create `tests/unit/content-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildArchives, buildTaxonomy, getAdjacentPosts, paginatePosts, sortPosts, type PostEntry } from '../../src/lib/content';

const post = (id: string, date: string, category = '软件工程与工具', tags = ['Git']) => ({
  id,
  data: { title: id, description: id, pubDate: new Date(date), cover: '/x.svg',
    category, tags, draft: false, math: false, mermaid: false, legacySlug: id }
}) as PostEntry;

const fixtures = [
  post('old', '2025-01-02'),
  post('new', '2026-02-03'),
  post('middle', '2025-06-04', 'FPGA 与数字系统', ['FPGA'])
];

describe('content utilities', () => {
  it('sorts without mutating input', () => {
    expect(sortPosts(fixtures).map((item) => item.id)).toEqual(['new', 'middle', 'old']);
    expect(fixtures[0].id).toBe('old');
  });
  it('paginates with six items by default', () => {
    const page = paginatePosts(Array.from({ length: 7 }, (_, i) => post(String(i), `2025-01-${String(i + 1).padStart(2, '0')}`)), 2);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
  });
  it('groups archives and taxonomies', () => {
    expect(buildArchives(fixtures).map((group) => [group.year, group.month, group.posts.length]))
      .toEqual([[2026, 2, 1], [2025, 6, 1], [2025, 1, 1]]);
    expect(buildTaxonomy(fixtures, 'category').get('软件工程与工具')).toHaveLength(2);
    expect(buildTaxonomy(fixtures, 'tags').get('FPGA')).toHaveLength(1);
  });
  it('returns chronological neighbours from newest-first input', () => {
    const adjacent = getAdjacentPosts(sortPosts(fixtures), 'middle');
    expect(adjacent.previous?.id).toBe('new');
    expect(adjacent.next?.id).toBe('old');
  });
});
```

Create `tests/unit/urls.test.ts`:

```ts
import { expect, it } from 'vitest';
import { postPath } from '../../src/lib/urls';

it('preserves the legacy Chinese post route', () => {
  expect(postPath('FPGA开发(3)AXI协议')).toBe('/posts/FPGA开发(3)AXI协议/');
});
```

Run: `pnpm vitest run tests/unit/content-utils.test.ts tests/unit/urls.test.ts`

Expected: FAIL because the utility modules do not exist.

- [ ] **Step 2: 实现明确接口**

Create `src/lib/content.ts`:

```ts
import type { CollectionEntry } from 'astro:content';
export type PostEntry = CollectionEntry<'posts'>;
export interface Page<T> { items: T[]; current: number; total: number }
export interface ArchiveMonth { year: number; month: number; posts: PostEntry[] }

export function sortPosts(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export function paginatePosts(posts: PostEntry[], current: number, size = 6): Page<PostEntry> {
  const total = Math.max(1, Math.ceil(posts.length / size));
  if (!Number.isInteger(current) || current < 1 || current > total) throw new RangeError('invalid page');
  return { items: posts.slice((current - 1) * size, current * size), current, total };
}

export function buildArchives(posts: PostEntry[]): ArchiveMonth[] {
  const groups = new Map<string, ArchiveMonth>();
  for (const post of sortPosts(posts)) {
    const year = post.data.pubDate.getFullYear();
    const month = post.data.pubDate.getMonth() + 1;
    const key = `${year}-${month}`;
    const group = groups.get(key) ?? { year, month, posts: [] };
    group.posts.push(post);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function buildTaxonomy(posts: PostEntry[], field: 'category' | 'tags'): Map<string, PostEntry[]> {
  const result = new Map<string, PostEntry[]>();
  for (const post of sortPosts(posts)) {
    const values = field === 'category' ? [post.data.category] : post.data.tags;
    for (const value of values) result.set(value, [...(result.get(value) ?? []), post]);
  }
  return result;
}

export function getAdjacentPosts(posts: PostEntry[], currentId: string) {
  const index = posts.findIndex((post) => post.id === currentId);
  if (index < 0) return {};
  return { previous: posts[index - 1], next: posts[index + 1] };
}
```

Rules: drafts are filtered before calling these functions; default page size is 6; maps and arrays use newest-first posts; archive groups are newest year/month first; returned arrays never mutate inputs.

Create `src/lib/urls.ts`:

```ts
export const postPath = (legacySlug: string) => `/posts/${legacySlug}/`;
export const categoryPath = (category: string) => `/categories/${encodeURIComponent(category)}/`;
export const tagPath = (tag: string) => `/tags/${encodeURIComponent(tag)}/`;
```

Create `src/lib/search.ts`:

```ts
import type { PostEntry } from './content';
import { postPath } from './urls';

export interface SearchDocument {
  id: string; url: string; title: string; description: string;
  category: string; tags: string[]; text: string;
}

export function toSearchDocument(post: PostEntry): SearchDocument {
  return {
    id: post.id,
    url: postPath(post.data.legacySlug),
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    text: `${post.data.title} ${post.data.description} ${post.data.category} ${post.data.tags.join(' ')} ${((post as PostEntry & { body?: string }).body ?? '').slice(0, 2000)}`
  };
}
```

- [ ] **Step 3: 运行测试和类型检查**

Run: `pnpm vitest run tests/unit/content-utils.test.ts tests/unit/urls.test.ts && pnpm check`

Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add src/lib tests/unit
git commit -m "feat: add content query and legacy URL utilities"
```

---

### Task 5: 建立参考站视觉骨架

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/styles/prose.css`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/HeroBanner.astro`
- Create: `src/components/WaveDivider.astro`
- Create: `src/components/SiteFooter.astro`
- Copy: `assets/img/avatar.jpg` -> `public/images/avatar.jpg`
- Copy: `assets/img/favicons/*` -> `public/`
- Create: `public/images/default-cover.svg`
- Create: `playwright.config.ts`
- Test: `tests/e2e/shell.spec.ts`

**Interfaces:**
- `BaseLayout` props: `{ title: string; description?: string; image?: string; bodyClass?: string }`。
- `HeroBanner` props: `{ title: string; subtitle?: string; image: string; compact?: boolean }`。
- Produces: 所有页面共享的导航、题图、波浪、背景和页脚。

- [ ] **Step 1: 写页面外壳失败测试**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } }]
});
```

Create `tests/e2e/shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('home shell exposes reference layout landmarks', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('[data-hero]')).toBeVisible();
  await expect(page.locator('[data-wave-divider]')).toBeVisible();
  await expect(page.locator('footer[data-site-footer]')).toBeVisible();
});
```

Run: `pnpm exec playwright install chromium` then `pnpm test:e2e tests/e2e/shell.spec.ts`

Expected: FAIL because the page and components do not exist.

- [ ] **Step 2: 定义视觉变量和布局规则**

Create `src/styles/tokens.css` with these root values:

```css
:root {
  --color-bg: #161a20;
  --color-surface: #1d2229;
  --color-surface-raised: #242a32;
  --color-text: #d8d9dc;
  --color-muted: #9298a1;
  --color-accent: #ff8fa6;
  --color-accent-strong: #ff6f91;
  --color-line: rgb(255 255 255 / 10%);
  --shadow-panel: 0 16px 40px rgb(0 0 0 / 28%);
  --content-width: 1180px;
  --reading-width: 780px;
  --header-height: 56px;
  --radius-card: 12px;
}
```

In `global.css`, implement border-box sizing, dark body background, Mulish/PingFang/Microsoft YaHei font stack, 1180 px centered container, focus-visible outline, reduced-motion overrides, 768 px mobile breakpoint and 1024 px sidebar breakpoint. Do not set fixed page heights or minimum heights that create empty space.

- [ ] **Step 3: 实现公共组件**

`BaseLayout.astro` must import `tokens.css` and `global.css`, emit canonical/OG metadata and `<meta name="msvalidate.01" content={SITE.verification.bing}>`, include Astro `ClientRouter`, and render `SiteHeader`、`slot`、`SiteFooter`。`SiteHeader` must expose desktop links：首页、文章、归档、分类、标签、作品、关于；mobile uses one button with `aria-expanded` and a hidden menu. `HeroBanner` uses a semantic heading and overlay, not text baked into an image. `WaveDivider` uses local SVG/CSS rather than reference assets.

- [ ] **Step 4: 添加临时首页并验证**

Create `src/pages/index.astro` using `BaseLayout`、`HeroBanner` and `WaveDivider`, with a temporary semantic `<main><h2>文章列表</h2></main>` only for this task.

Run: `pnpm test:e2e tests/e2e/shell.spec.ts`

Expected: PASS at desktop and mobile projects configured by Playwright later; current Chromium run passes once.

- [ ] **Step 5: 提交**

```bash
git add src/styles src/layouts src/components src/pages/index.astro public playwright.config.ts tests/e2e/shell.spec.ts
git commit -m "feat: add Shoka-inspired site shell"
```

---

### Task 6: 完成首页、分页、作者侧栏和页脚数据

**Files:**
- Create: `src/components/PostCard.astro`
- Create: `src/components/PostList.astro`
- Create: `src/components/Pagination.astro`
- Create: `src/components/ProfileSidebar.astro`
- Modify: `src/components/SiteFooter.astro`
- Replace: `src/pages/index.astro`
- Create: `src/pages/page/[page].astro`
- Create: `tests/e2e/home.spec.ts`

**Interfaces:**
- `PostCard` consumes `{ post: PostEntry; index: number }` and alternates image position by `index % 2`。
- `Pagination` consumes `{ current: number; total: number; basePath: string }`。
- `ProfileSidebar` consumes counts derived from collections, not hard-coded numbers。

- [ ] **Step 1: 写首页失败测试**

Create `tests/e2e/home.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('home renders six alternating post cards and live author counts', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('article[data-post-card]');
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(0)).toHaveAttribute('data-side', 'left');
  await expect(cards.nth(1)).toHaveAttribute('data-side', 'right');
  await expect(page.locator('[data-post-count]')).toHaveText('40');
  await expect(page.locator('[data-category-count]')).not.toHaveText('0');
  await expect(page.locator('[data-tag-count]')).not.toHaveText('0');
  await page.goto('/page/2/');
  await expect(page.locator('article[data-post-card]').first()).toBeVisible();
});

test('home has no mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBe(sizes.client);
});
```

Run: `pnpm test:e2e tests/e2e/home.spec.ts`

Expected: FAIL because cards and pagination do not exist.

- [ ] **Step 2: 实现首页组件和路由**

Both homepage routes call `getCollection('posts', ({ data }) => !data.draft)` then `sortPosts` and `paginatePosts(..., 6)`. Page 1 lives at `/`; pages 2+ are generated by `src/pages/page/[page].astro`. Each card renders optimized cover, title, excerpt, date, reading time, category and `postPath(legacySlug)`.

CSS rules: desktop cards use a 42/58 image/content split and alternate direction; mobile cards stack image above text; no fixed list height. Sidebar is sticky only above 1024 px and becomes a normal block below it.

- [ ] **Step 3: 实现页脚内容**

Use a deterministic date-based seed to choose ten random posts at build time, and use the ten newest posts for “最近更新”。Do not fetch Giscus discussions for the footer.

- [ ] **Step 4: 验证并提交**

Run: `pnpm test:e2e tests/e2e/home.spec.ts && pnpm check`

Expected: PASS。

```bash
git add src/components src/pages tests/e2e/home.spec.ts
git commit -m "feat: build paginated home page"
```

---

### Task 7: 完成文章渲染、目录、数学、Mermaid 和 Giscus

**Files:**
- Create: `src/layouts/PostLayout.astro`
- Create: `src/components/PostMeta.astro`
- Create: `src/components/Breadcrumbs.astro`
- Create: `src/components/TableOfContents.astro`
- Create: `src/components/GiscusComments.astro`
- Create: `src/pages/posts/[slug].astro`
- Create: `src/scripts/toc.ts`
- Create: `src/scripts/mermaid.ts`
- Create: `tests/e2e/post.spec.ts`

**Interfaces:**
- Post route consumes one `PostEntry`, `getAdjacentPosts`, and Astro render headings.
- `TableOfContents` consumes Astro heading objects and emits anchor links.
- Giscus config comes only from `SITE.giscus`。

- [ ] **Step 1: 写文章页失败测试**

Create `tests/e2e/post.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('legacy post route renders enhanced article content', async ({ page }) => {
  const response = await page.goto('/posts/本科数学大杂烩/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('article[data-post] h1')).toContainText('本科数学');
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.locator('[data-table-of-contents] a').first()).toHaveAttribute('href', /^#/);
  await expect(page.locator('script[src="https://giscus.app/client.js"]')).toHaveAttribute('data-mapping', 'pathname');
  await expect(page.locator('[data-adjacent-posts] a').first()).toHaveAttribute('href', /^\/posts\//);
});

test('Mermaid-enabled posts expose render targets', async ({ page }) => {
  await page.goto('/posts/FPGA开发(3)AXI协议/');
  await expect(page.locator('[data-mermaid], .mermaid').first()).toBeAttached();
});
```

Run: `pnpm test:e2e tests/e2e/post.spec.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 2: 实现静态文章路径**

`getStaticPaths()` returns:

```ts
return posts.map((post) => ({
  params: { slug: post.data.legacySlug },
  props: { post }
}));
```

Render content with `const { Content, headings } = await render(post)`。Set canonical URL with `postPath`。Do not generate a second date-prefixed route.

- [ ] **Step 3: 实现正文增强**

Import `katex/dist/katex.min.css` only through `PostLayout`。`mermaid.ts` dynamically imports Mermaid only when `.language-mermaid` exists and runs again on `astro:page-load`。`toc.ts` uses `IntersectionObserver` to mark the current heading, and is a no-op when no headings exist.

- [ ] **Step 4: 实现评论和退化状态**

`GiscusComments.astro` renders a `<section aria-label="评论">` and injects `https://giscus.app/client.js` with `data-repo`、`data-repo-id`、`data-category`、`data-category-id`、`data-mapping="pathname"` and `data-strict="0"`。A `<noscript>` explains that comments require JavaScript. The script `error` handler replaces the loading text with “评论暂时无法加载，正文内容不受影响”。

- [ ] **Step 5: 验证并提交**

Run: `pnpm test:e2e tests/e2e/post.spec.ts && pnpm check`

Expected: PASS。

```bash
git add src/layouts src/components src/pages/posts src/scripts tests/e2e/post.spec.ts
git commit -m "feat: render posts with toc math mermaid and comments"
```

---

### Task 8: 完成归档、分类、标签、作品、关于、404、RSS 和搜索数据

**Files:**
- Create: `src/pages/archives/index.astro`
- Create: `src/pages/categories/index.astro`
- Create: `src/pages/categories/[category].astro`
- Create: `src/pages/tags/index.astro`
- Create: `src/pages/tags/[tag].astro`
- Create: `src/pages/projects/index.astro`
- Create: `src/pages/about.astro`
- Create: `src/pages/404.astro`
- Create: `src/pages/rss.xml.ts`
- Create: `src/pages/search-index.json.ts`
- Create: `src/components/EmptyState.astro`
- Create: `tests/e2e/index-pages.spec.ts`

**Interfaces:**
- Taxonomy routes consume `buildArchives` and `buildTaxonomy`。
- Search endpoint returns `SearchDocument[]`。
- Projects page consumes the empty projects collection and renders `EmptyState`。

- [ ] **Step 1: 写索引页失败测试**

Create `tests/e2e/index-pages.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('content index pages reflect migrated data', async ({ page, request }) => {
  await page.goto('/archives/');
  await expect(page.locator('[data-archive-total]')).toHaveText('40');
  await page.goto('/categories/');
  for (const name of ['FPGA 与数字系统', '嵌入式与硬件', 'AI 与图形计算', '软件工程与工具', '数学与基础', '随笔与资源']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await page.goto('/tags/');
  await expect(page.locator('[data-tag-link]').first()).toBeVisible();
  await page.goto('/projects/');
  await expect(page.getByText('作品内容还没添加')).toBeVisible();
  await page.goto('/about/');
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /HatrixXXX/);
  const rss = await (await request.get('/rss.xml')).text();
  expect((rss.match(/<item>/g) ?? []).length).toBe(40);
  const search = await (await request.get('/search-index.json')).json();
  expect(search).toHaveLength(40);
  expect(search[0].text).not.toContain('<article');
});

test('404 retains site navigation', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('header[data-site-header]')).toBeVisible();
});
```

Run: `pnpm test:e2e tests/e2e/index-pages.spec.ts`

Expected: FAIL because routes do not exist.

- [ ] **Step 2: 实现纯静态索引页**

Use the same `BaseLayout`、`HeroBanner`、`WaveDivider` and sidebar system. Dynamic category/tag paths use the taxonomy map keys in `getStaticPaths()` and pass the original Unicode value as a prop. Empty project collection must not fail the build.

- [ ] **Step 3: 实现 RSS 和搜索 JSON**

`rss.xml.ts` uses `@astrojs/rss`, `SITE` and `postPath`。`search-index.json.ts` returns `JSON.stringify(posts.map(toSearchDocument))` with `Content-Type: application/json; charset=utf-8`。

- [ ] **Step 4: 验证并提交**

Run: `pnpm test:e2e tests/e2e/index-pages.spec.ts && pnpm build`

Expected: PASS; `dist` contains every route, `rss.xml`, `sitemap-index.xml` or sitemap output, and search JSON.

```bash
git add src/pages src/components/EmptyState.astro tests/e2e/index-pages.spec.ts
git commit -m "feat: add archives taxonomies and static index pages"
```

---

### Task 9: 实现搜索、主题、移动菜单、灯箱和空音乐播放器

**Files:**
- Create: `src/components/SearchOverlay.astro`
- Create: `src/components/MusicPlayer.astro`
- Create: `src/scripts/navigation.ts`
- Create: `src/scripts/theme.ts`
- Create: `src/scripts/search.ts`
- Create: `src/scripts/lightbox.ts`
- Create: `src/scripts/music-player.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/SiteHeader.astro`
- Test: `tests/e2e/interactions.spec.ts`

**Interfaces:**
- Search loads `/search-index.json` on first open and builds one MiniSearch index.
- Music player imports `playlist`, persists as `transition:persist="music-player"`, and stores only volume and UI state when the list is empty.

- [ ] **Step 1: 写交互失败测试**

Create `tests/e2e/interactions.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('search, theme and empty player survive navigation', async ({ page }) => {
  const audioRequests: string[] = [];
  page.on('request', (request) => { if (request.resourceType() === 'media') audioRequests.push(request.url()); });
  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.getByRole('searchbox').fill('FPGA');
  await expect(page.locator('[data-search-result]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换主题' }).click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('link', { name: '归档' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
  await expect(page.getByText('歌单待添加')).toBeVisible();
  expect(audioRequests).toEqual([]);
});

test('mobile navigation and image lightbox are operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: '切换导航栏' });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.goto('/posts/本科数学大杂烩/');
  await page.locator('article img').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
});
```

Run: `pnpm test:e2e tests/e2e/interactions.spec.ts`

Expected: FAIL because interactive components do not exist.

- [ ] **Step 2: 实现导航和主题**

Initialize scripts on both first load and `astro:page-load`。Theme values are `dark` and `light`, stored under `hatrix-theme`。Before first paint, an inline head script applies the stored value to `document.documentElement.dataset.theme` to prevent flashing. Mobile menu closes on route change and Escape.

- [ ] **Step 3: 实现延迟搜索和灯箱**

Search fetches once, indexes `title`、`description`、`category`、`tags`、`text`, and caps visible results at 20. PhotoSwipe is dynamically imported only after an article image is activated.

- [ ] **Step 4: 实现播放器空壳**

Render disabled previous/play/next controls, empty progress, volume control and “歌单待添加”。`music-player.ts` must return before constructing `Audio` when `playlist.length === 0`。Keep the component across navigation with `transition:persist`。

- [ ] **Step 5: 验证并提交**

Run: `pnpm test:e2e tests/e2e/interactions.spec.ts && pnpm build`

Expected: PASS; no audio requests; search and theme survive Astro navigation.

```bash
git add src/components src/scripts src/layouts/BaseLayout.astro tests/e2e/interactions.spec.ts
git commit -m "feat: add search theme lightbox and music shell"
```

---

### Task 10: 检查远程图片并建立构建降级规则

**Files:**
- Create: `scripts/check-images.ts`
- Create: `src/plugins/remark-image-status.ts`
- Create: `public/images/image-unavailable.svg`
- Create: `tests/unit/check-images.test.ts`
- Modify: `astro.config.ts`

**Interfaces:**
- `extractImageUrls(markdown): string[]` returns unique jsDelivr image URLs。
- `checkImages(urls, concurrency)` returns `{ ok: Set<string>; failed: Map<string,string> }`。
- The remark plugin replaces only URLs listed as failed and preserves alt text plus original URL in `data-original-src`。

- [ ] **Step 1: 写图片检查失败测试**

Create `tests/unit/check-images.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkImages, extractImageUrls } from '../../scripts/check-images';

afterEach(() => vi.unstubAllGlobals());

describe('remote image checking', () => {
  it('deduplicates markdown image URLs', () => {
    const md = '![](https://cdn.jsdelivr.net/a.png)\n![](https://cdn.jsdelivr.net/a.png)';
    expect(extractImageUrls(md)).toEqual(['https://cdn.jsdelivr.net/a.png']);
  });
  it('records failed responses without losing successful URLs', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(null, { status: url.endsWith('ok.png') ? 200 : 404 })));
    const result = await checkImages(['https://x/ok.png', 'https://x/missing.png'], 12);
    expect([...result.ok]).toEqual(['https://x/ok.png']);
    expect(result.failed.get('https://x/missing.png')).toContain('404');
  });
});
```

Add a plugin fixture in the same file that passes a Markdown AST image node with `alt: 'diagram'` and a failed URL; assert output URL is `/images/image-unavailable.svg`, `alt` stays `diagram`, and `data-original-src` contains the failed URL.

Run: `pnpm vitest run tests/unit/check-images.test.ts`

Expected: FAIL because checker and plugin do not exist.

- [ ] **Step 2: 实现预检和报告**

Scan only `src/content/posts/**/*.{md,mdx}`。Use HEAD first and GET with `Range: bytes=0-0` if HEAD is rejected. Timeout each request after 10 seconds. Write `reports/image-check.json` with `checkedAt`、`total`、`ok` and `failed`。Exit nonzero only when an article cover fails; inline failures are replaced by the plugin.

- [ ] **Step 3: 接入 Astro 图片缓存和降级**

Authorize `cdn.jsdelivr.net` through Astro image remote patterns. Add the remark plugin after `remark-math`。Do not transform GIF or SVG. Cache `.astro/` in GitHub Actions later.

- [ ] **Step 4: 测量构建时间**

Run:

```powershell
Measure-Command { pnpm check:images }
Measure-Command { pnpm build }
```

Final calibration: the migrated posts contain 254 unique URLs, all pinned to immutable image-repository commit `85bc7b2b63bcf294f1079a98edf79ee1c9f41606`; future same-repository references must also include an immutable ref. The inventory guard excludes unpublished drafts. The production implementation optimizes post-list `cover` images through Astro/Sharp, while inline jsDelivr images remain CDN-backed with `loading="lazy"` and `decoding="async"`. A clean build must still finish within 8 minutes.

- [ ] **Step 5: 提交**

```bash
git add scripts/check-images.ts src/plugins public/images/image-unavailable.svg tests/unit/check-images.test.ts astro.config.ts
git commit -m "feat: validate and degrade remote images"
```

---

### Task 11: 建立桌面和移动端视觉回归

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/visual.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/no-js.spec.ts`
- Create: `tests/e2e/visual.spec.ts-snapshots/*` (generated after review)
- Modify: responsive styles and components found by tests

**Interfaces:**
- Playwright projects: `desktop-1440`、`tablet-768`、`mobile-390`。
- Snapshot baselines belong to this project; do not store screenshots copied from linn-ylz.com。

- [ ] **Step 1: 将 Playwright 配置扩展为三种视口并写失败断言**

Replace the `projects` array with:

```ts
projects: [
  { name: 'desktop-1440', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  { name: 'tablet-768', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } } },
  { name: 'mobile-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } }
]
```

Create `tests/e2e/visual.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

for (const path of ['/', '/posts/本科数学大杂烩/', '/archives/', '/categories/', '/tags/', '/projects/', '/404.html']) {
  test(`${path} has stable responsive structure`, async ({ page }) => {
    await page.goto(path);
    const metrics = await page.evaluate(() => ({
      bodies: document.querySelectorAll('body').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      emptyTallBlocks: [...document.querySelectorAll('main *')].filter((el) =>
        !el.textContent?.trim() && !el.querySelector('img,svg,canvas,video') && el.getBoundingClientRect().height > innerHeight
      ).length
    }));
    expect(metrics.bodies).toBe(1);
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.emptyTallBlocks).toBe(0);
    await expect(page).toHaveScreenshot(`${path.replaceAll('/', '_') || 'home'}.png`, { fullPage: true });
  });
}
```

Create `tests/e2e/accessibility.spec.ts` to tab through the header and assert a visible focus outline; emulate `reducedMotion: 'reduce'` and assert all elements marked `[data-decorative-motion]` have zero animation duration.

Create `tests/e2e/no-js.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('articles and ordinary navigation remain usable without JavaScript', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '归档' }).click();
  await expect(page.locator('[data-archive-total]')).toHaveText('40');
  await page.goto('/posts/本科数学大杂烩/');
  await expect(page.locator('article[data-post]')).toBeVisible();
  await expect(page.locator('noscript')).toContainText('评论需要 JavaScript');
});
```

- [ ] **Step 2: 修复布局直到结构断言通过**

Desktop: 1180 px content, article/sidebar two columns. Tablet: sidebar becomes normal block. Mobile: single-column cards, collapsible nav and TOC, 16 px minimum body text, 44 px minimum interactive targets. Never fix overflow with global `overflow-x: hidden` before locating the offending component.

- [ ] **Step 3: 生成本项目快照并人工查看**

Run: `pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots`

Expected: snapshots generated for all required routes/viewports. Review them against the reference site for layout rhythm, palette, hero, wave, cards and sidebar, while retaining Hatrix content.

- [ ] **Step 4: 运行全套浏览器检查并提交**

Run: `pnpm test:e2e`

Expected: PASS in all three projects; no duplicate mobile content or oversized blank region. Final suite: 59 Playwright cases and 21 Windows-generated snapshots. Snapshot names are platform-neutral; the Pages workflow intentionally does not run the visual suite.

```bash
git add playwright.config.ts tests/e2e src/styles src/components src/layouts src/pages
git commit -m "test: add responsive visual regression coverage"
```

---

### Task 12: 重写 GitHub Pages 工作流和产物检查

**Files:**
- Replace: `.github/workflows/pages-deploy.yml`
- Create: `scripts/check-built-site.ts`
- Create: `tests/unit/check-built-site.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- `check-built-site` verifies 40 post routes, CNAME, 404, RSS, sitemap, internal links, asset existence and output size。
- Workflow uses Node 24, pnpm lockfile and official Pages artifact/deploy actions。

- [ ] **Step 1: 写产物检查失败测试**

Create `tests/unit/check-built-site.test.ts`:

```ts
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { inspectBuiltSite } from '../../scripts/check-built-site';

it('reports missing routes and broken local links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-site-'));
  await mkdir(join(root, 'posts', 'present'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<a href="/missing/">broken</a>');
  await writeFile(join(root, 'posts', 'present', 'index.html'), '<h1>present</h1>');
  const result = await inspectBuiltSite(root, ['/posts/present/', '/posts/absent/']);
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.stringContaining('/missing/'), expect.stringContaining('/posts/absent/')
  ]));
});
```

Add a second test fixture containing `index.html`, `404.html`, `CNAME`, `rss.xml`, `sitemap-0.xml` and all expected post files; assert `errors` is empty.

Run: `pnpm vitest run tests/unit/check-built-site.test.ts`

Expected: FAIL because the checker does not exist.

- [ ] **Step 2: 实现产物检查**

The checker reads `dist`, parses local `href`/`src`, ignores external URLs and fragments, and verifies the expected routes derived from `src/content/posts`。It fails if output exceeds 1 GB or generated post count is not 40.

- [ ] **Step 3: 写 Pages 工作流**

Workflow jobs:

1. checkout with full history for `updatedDate`。
2. setup Node 24 and pnpm cache。
3. `pnpm install --frozen-lockfile`。
4. restore/cache `.astro` image cache。
5. `pnpm test:run`、`pnpm check`、`pnpm build`、`pnpm check:site`；`pnpm build` 自动先运行 `check:images`。
6. upload `dist` with `actions/upload-pages-artifact`。
7. deploy with `actions/deploy-pages` only on `master` pushes or manual dispatch; pull requests run build but skip deploy。

Keep permissions limited to `contents: read`, `pages: write`, `id-token: write`。

- [ ] **Step 4: 本地验证并提交**

Run: `pnpm test:run && pnpm check && pnpm check:images && pnpm build && pnpm check:site`

Expected: PASS; 40 post routes, `dist/CNAME`, 404, RSS and sitemap exist; output under 1 GB.

```bash
git add .github/workflows/pages-deploy.yml scripts/check-built-site.ts tests/unit/check-built-site.test.ts .gitignore
git commit -m "ci: deploy Astro site to GitHub Pages"
```

---

### Task 13: 清理 Jekyll/Chirpy，并同步项目文档

**Files:**
- Delete: `Gemfile`, `_config.yml`, `_layouts/`, `_includes/`, `_sass/`, `_javascript/`, `_plugins/`, `_data/`, `_tabs/`, `_posts/`, `_draft/`
- Delete: `scripts/migration/`, `tests/unit/classify-post.test.ts`, `tests/unit/migrate-posts.test.ts`; remove `migrate:posts` from `package.json` after migration is committed
- Delete: Chirpy-only assets under `assets/`, old `tools/`, `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, `.github/workflows/publish.yml`, `.github/workflows/starter/` and obsolete `.devcontainer/`
- Delete: old `purgecss.js`, `rollup.config.js` and theme build configuration no longer referenced
- Modify: `README.md`
- Delete: root `CNAME` after confirming `public/CNAME` is tracked and produces `dist/CNAME`
- Delete: root `LICENSE` because it only covers the removed Cotes/Chirpy theme and would misstate the new Astro repository's licensing
- Preserve: `public/CNAME`, migrated `src/content/posts/`, `src/drafts/`, used avatar/favicons and design/plan docs

**Interfaces:**
- Produces: 只含 Astro 源码、内容、测试和 Pages 工作流的干净仓库。

- [ ] **Step 1: 清理前记录基线**

Run: `pnpm test:run && pnpm check && pnpm build && pnpm check:site`

Expected: PASS。Save `git status --short` and `git ls-files` output for review, but do not commit generated reports.

- [ ] **Step 2: 删除已替代文件**

Resolve each path inside the worktree before deletion. Do not use broad globs against the repository root. Remove only paths listed above after confirming their Astro replacement exists. Keep user-owned images when any migrated content or site config still references them.

- [ ] **Step 3: 更新 README**

README sections and exact content requirements:

- `开发环境`：Node 24、Corepack、`pnpm install --frozen-lockfile`。
- `常用命令`：逐行列出 `pnpm dev`、`pnpm test:run`、`pnpm check`、`pnpm build`、`pnpm check:site`、`pnpm test:e2e`。
- `新增文章`：列出 Task 2 的全部文章 frontmatter 字段及六个合法分类。
- `新增作品`：给出完整 frontmatter 示例，状态只允许 `idea|active|done|archived`。
- `添加音乐`：给出 `Track` 示例并说明空数组不会请求音频。
- `部署`：说明 workflow 从 `master` 构建 `dist`，域名文件位于 `public/CNAME`。
- `后续 3D`：说明 3D 组件必须使用独立客户端岛并延迟加载。

Before saving this Chinese documentation, invoke `humanizer-zh`。

- [ ] **Step 4: 清理后跑完整验证**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm test:run
pnpm check
pnpm check:images
pnpm build
pnpm check:site
pnpm test:e2e
```

Expected: all commands PASS. `rg -n "jekyll|chirpy|bundle exec|Gemfile" package.json astro.config.ts .github README.md tests` finds no active legacy build references. Matches under the preserved “博客搭建” article and unpublished draft are historical content, not build configuration, and remain unchanged.

- [ ] **Step 5: 检查性能和差异**

Run Lighthouse locally for desktop and mobile. Expected: desktop performance >= 90, mobile >= 80, CLS < 0.1. Confirm homepage JS gzip <= 160 KB excluding Giscus, build time < 8 minutes and `dist` < 1 GB.

Review `git diff --stat` and `git status --short`。All deletions must trace to a working Astro replacement or obsolete theme file.

- [ ] **Step 6: 提交清理**

```bash
git add -A
git commit -m "refactor: remove legacy Jekyll site"
```

- [ ] **Step 7: 完成前审查**

Invoke `superpowers:requesting-code-review`, address verified findings, then invoke `superpowers:verification-before-completion` and rerun the full command set from Step 4. Do not merge or push.

If the user later asks to push or submit to GitHub, invoke `neat-freak` first, reconcile README/design/plan with the final code, then ask the user to choose merge/push handling through `superpowers:finishing-a-development-branch`。
