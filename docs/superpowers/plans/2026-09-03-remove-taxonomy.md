# Taxonomy Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 从站点数据、页面、搜索、路由、测试和现行文档中删除文章分类与标签功能。

**Architecture:** 文章集合只保留发布、展示和系列所需字段。所有页面直接消费按日期排序的文章集合，不再构建 taxonomy；搜索只索引标题、摘要和正文。旧分类、标签路由不生成，也不重定向。

**Tech Stack:** Astro 7、TypeScript 5.9、Vitest 4、Playwright 1.62、MiniSearch 7、Markdown frontmatter

## Global Constraints

- Node 版本固定为 24，包管理器使用 Corepack 管理的 pnpm。
- 保持纯静态输出。
- 保留全部 40 条 `/posts/<legacySlug>/` 路径和 Giscus pathname 映射。
- 不改写文章正文；`src/content/posts/2025-07-04-杂货铺.md` 已有用户改动，只修改 frontmatter，不覆盖或暂存正文改动。
- Giscus 的 `category` 与 `categoryId` 不属于文章 taxonomy，必须保留。
- `/categories/**` 和 `/tags/**` 直接消失，不生成重定向。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/` 或 Playwright trace。
- 完成后启动 `http://127.0.0.1:4321/` 本地开发预览并保持运行。

---

### Task 1: 把删除要求写成失败测试

**Files:**
- Modify: `tests/unit/content-schema.test.ts`
- Modify: `tests/unit/content-utils.test.ts`
- Modify: `tests/unit/urls.test.ts`
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/index-pages.spec.ts`
- Modify: `tests/e2e/no-js.spec.ts`
- Modify: `tests/e2e/post.spec.ts`

**Interfaces:**
- Consumes: 当前 `PostEntry`、`SearchDocument`、页面和路由行为。
- Produces: 不含 taxonomy 元数据、链接、页面和搜索字段的验收契约。

- [x] **Step 1: 新增 frontmatter 负向契约**

在 `tests/unit/content-schema.test.ts` 中保留 `SITE` 与歌单测试，加入以下检查：

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

it('does not carry category or tag metadata', async () => {
  for (const directory of ['src/content/posts', 'src/drafts']) {
    const root = join(process.cwd(), directory);
    const files = (await readdir(root)).filter((file) => /\.mdx?$/.test(file));
    for (const file of files) {
      const { data } = matter(await readFile(join(root, file), 'utf8'));
      expect(data, `${directory}/${file}`).not.toHaveProperty('category');
      expect(data, `${directory}/${file}`).not.toHaveProperty('tags');
    }
  }
});
```

删除 `POST_CATEGORIES` 的导入和六分类断言。

- [x] **Step 2: 改写内容工具与搜索契约**

在 `tests/unit/content-utils.test.ts` 中删除 `buildTaxonomy` 导入、fixture 的 `category/tags` 参数和 taxonomy 断言。搜索文档断言改为：

```ts
expect(document).toMatchObject({
  id: 'FPGA',
  url: '/posts/FPGA/',
  title: 'FPGA',
  description: 'description for FPGA'
});
expect(document).not.toHaveProperty('category');
expect(document).not.toHaveProperty('tags');
expect(document.text).toContain('FPGA description for FPGA');
expect(document.text.endsWith('a'.repeat(2000))).toBe(true);
```

在 `tests/unit/urls.test.ts` 中只保留 `postPath` 导入和 legacy URL 测试，删除 taxonomy URL 测试。

- [x] **Step 3: 改写浏览器契约**

做以下精确调整：

```ts
// tests/e2e/home.spec.ts
await expect(page.locator('[data-post-count]')).toHaveText('40');
await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);

// tests/e2e/index-pages.spec.ts
for (const route of ['/categories/', '/tags/']) {
  expect((await request.get(route)).status()).toBe(404);
}
for (const document of search) {
  expect(document).not.toHaveProperty('category');
  expect(document).not.toHaveProperty('tags');
}

// tests/e2e/no-js.spec.ts
await expect(headerLinks).toHaveCount(5);
for (const route of ['/archives/', '/projects/']) {
  test(`${route} remains directly readable without JavaScript`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
  });
}

// tests/e2e/post.spec.ts，加入 legacy post route 测试
await expect(page.locator('.breadcrumbs li')).toHaveCount(2);
await expect(page.locator('.post-tags')).toHaveCount(0);
await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);
```

删除 `index-pages.spec.ts` 中分类列表和标签云的正向检查，以及 `home.spec.ts` 中两个 taxonomy 计数断言。

- [x] **Step 4: 运行测试并确认失败原因**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/content-schema.test.ts tests/unit/content-utils.test.ts tests/unit/urls.test.ts
corepack pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/index-pages.spec.ts tests/e2e/post.spec.ts --grep "home renders|content index|legacy post route"
```

Expected: Vitest 因现有 frontmatter 或 `post.data.tags.join` 失败；Playwright 因现有 taxonomy 链接、页面或文章布局失败。失败应来自待删除功能，而不是环境或语法错误。

- [x] **Step 5: 提交测试契约**

```powershell
git add -- tests/unit/content-schema.test.ts tests/unit/content-utils.test.ts tests/unit/urls.test.ts tests/e2e/home.spec.ts tests/e2e/index-pages.spec.ts tests/e2e/no-js.spec.ts tests/e2e/post.spec.ts
git commit -m "test: define taxonomy removal contract"
```

### Task 2: 删除内容模型、元数据和 taxonomy 工具

**Files:**
- Modify: `src/config/site.ts`
- Modify: `src/content.config.ts`
- Modify: `src/types/content.ts`
- Modify: `src/lib/content.ts`
- Modify: `src/lib/urls.ts`
- Modify: `src/lib/search.ts`
- Modify: `src/scripts/search.ts`
- Modify: `src/components/SearchOverlay.astro`
- Modify: all 40 Markdown files in `src/content/posts/`
- Modify: `src/drafts/2025-07-27-编码与开发.md`

**Interfaces:**
- Consumes: `postPath(legacySlug: string): string` 和 `PostEntry`。
- Produces: 不含 `category`、`tags` 的文章 schema、类型与 `SearchDocument`。

- [x] **Step 1: 删除 schema 与类型字段**

`src/content.config.ts` 的文章字段改为：

```ts
schema: z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    cover: z.string().min(1),
    series: z.string().optional(),
    seriesOrder: z.number().int().nonnegative().optional(),
    draft: z.boolean().default(false),
    math: z.boolean().default(false),
    mermaid: z.boolean().default(false),
    legacySlug: z.string().min(1)
  })
```

删除 `POST_CATEGORIES` 常量、相关 import、`PostCategory` 类型以及 `PostData.category/tags`。

- [x] **Step 2: 删除所有文章和草稿中的 taxonomy frontmatter**

对 `rg -l -g '*.md' '^category:|^tags:' src/content/posts src/drafts` 返回的 41 个文件逐一应用补丁：删除单行 `category: ...`，并删除从 `tags:` 到下一个顶层 YAML 键之前的标签列表。不得删除正文中自然语言里的“分类”“标签”或 Git `tag` 内容。

对 `src/content/posts/2025-07-04-杂货铺.md` 只删除 frontmatter：

```diff
-category: 随笔与资源
-tags:
-  - 资源
```

保留该文件当前未提交的四组正文链接。

- [x] **Step 3: 删除 taxonomy helper，收窄搜索文档**

从 `src/lib/content.ts` 删除 `buildTaxonomy`，从 `src/lib/urls.ts` 删除 `categoryPath`、`tagPath`。

`src/lib/search.ts` 的接口和序列化改为：

```ts
export interface SearchDocument {
  id: string;
  url: string;
  title: string;
  description: string;
  text: string;
}

export function toSearchDocument(post: PostEntry): SearchDocument {
  const body = (post as PostEntry & { body?: string }).body ?? '';
  const metadata = markdownToPlainText(`${post.data.title} ${post.data.description}`);
  const summary = markdownToPlainText(body, 2000);

  return {
    id: post.id,
    url: postPath(post.data.legacySlug),
    title: post.data.title,
    description: post.data.description,
    text: [metadata, summary].filter(Boolean).join(' ')
  };
}
```

`src/scripts/search.ts` 使用：

```ts
fields: ['title', 'description', 'text'],
storeFields: ['url', 'title', 'description']
```

搜索结果副标题改为 `meta.textContent = String(match.description);`。`SearchOverlay.astro` 的 placeholder 改为“输入标题、摘要或正文关键词”。

- [x] **Step 4: 运行单元测试和源码残留扫描**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/content-schema.test.ts tests/unit/content-utils.test.ts tests/unit/urls.test.ts
rg -n "POST_CATEGORIES|PostCategory|buildTaxonomy|categoryPath|tagPath|post\.data\.(category|tags)|^category:|^tags:" src tests/unit
```

Expected: 三个测试文件通过；扫描无输出。Giscus 的 `SITE.giscus.category` 不在扫描模式内。

- [x] **Step 5: 提交模型与搜索改动，排除用户正文 hunk**

```powershell
git add -- src/config/site.ts src/content.config.ts src/types/content.ts src/lib/content.ts src/lib/urls.ts src/lib/search.ts src/scripts/search.ts src/components/SearchOverlay.astro src/drafts/2025-07-27-编码与开发.md
git add -- 'src/content/posts/*.md' ':(exclude)src/content/posts/2025-07-04-杂货铺.md'
git commit -m "refactor: remove taxonomy data model"
```

`src/content/posts/2025-07-04-杂货铺.md` 先保持未暂存。核心实现验证后，只暂存并提交 frontmatter 删除；用户正文改动继续留在工作区。

### Task 3: 删除 taxonomy 页面和所有界面入口

**Files:**
- Delete: `src/pages/categories/index.astro`
- Delete: `src/pages/categories/[category].astro`
- Delete: `src/pages/tags/index.astro`
- Delete: `src/pages/tags/[tag].astro`
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/components/ProfileSidebar.astro`
- Modify: `src/components/PostCard.astro`
- Modify: `src/components/Breadcrumbs.astro`
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/page/[page].astro`
- Modify: `src/pages/archives/index.astro`

**Interfaces:**
- Consumes: `PostEntry`, `postPath` 和文章总数。
- Produces: 五项主导航、单项作者统计和无 taxonomy 链接的文章页面。

- [x] **Step 1: 删除静态路由**

删除四个 taxonomy 页面文件。不要增加重定向或 replacement route。

- [x] **Step 2: 删除导航、卡片和文章页 taxonomy UI**

`SiteHeader.astro` 的链接固定为：

```ts
const links = [
  { label: '首页', href: '/' },
  { label: '文章', href: '/#articles' },
  { label: '归档', href: '/archives/' },
  { label: '作品', href: '/projects/' },
  { label: '关于', href: '/about/' }
];
```

`ProfileSidebar.astro` 只接收 `postCount: number`，`<dl>` 中只保留文章总数，布局改为单列。`PostCard.astro` 删除分类 import、链接和 `.post-category` 样式，标题上边距改为 `0`。

`Breadcrumbs.astro` 只接收 `title: string`，只渲染首页和当前文章。`PostLayout.astro` 传入 `title`，删除 `tagPath`、文末 `.post-tags` 结构和样式。

- [x] **Step 3: 删除页面侧栏的 taxonomy 计算**

`src/pages/index.astro`、`src/pages/page/[page].astro`、`src/pages/archives/index.astro` 删除 `buildTaxonomy` import 和两个计数，只保留：

```astro
<ProfileSidebar postCount={posts.length} />
```

- [x] **Step 4: 运行类型检查和浏览器契约**

Run:

```powershell
corepack pnpm check
corepack pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/index-pages.spec.ts tests/e2e/no-js.spec.ts tests/e2e/post.spec.ts
```

Expected: Astro/TypeScript 无错误；指定 E2E 测试通过，旧 taxonomy 路由返回 404。

- [x] **Step 5: 提交页面删除**

```powershell
git add -- src/pages/categories src/pages/tags src/components/SiteHeader.astro src/components/ProfileSidebar.astro src/components/PostCard.astro src/components/Breadcrumbs.astro src/layouts/PostLayout.astro src/pages/index.astro 'src/pages/page/[page].astro' src/pages/archives/index.astro
git commit -m "refactor: remove taxonomy pages and UI"
```

### Task 4: 更新视觉套件和构建产物门禁

**Files:**
- Modify: `tests/e2e/visual.spec.ts`
- Delete: `tests/e2e/visual.spec.ts-snapshots/-categories--desktop-1440.png`
- Delete: `tests/e2e/visual.spec.ts-snapshots/-categories--tablet-768.png`
- Delete: `tests/e2e/visual.spec.ts-snapshots/-categories--mobile-390.png`
- Delete: `tests/e2e/visual.spec.ts-snapshots/-tags--desktop-1440.png`
- Delete: `tests/e2e/visual.spec.ts-snapshots/-tags--tablet-768.png`
- Delete: `tests/e2e/visual.spec.ts-snapshots/-tags--mobile-390.png`
- Modify: remaining PNG files in `tests/e2e/visual.spec.ts-snapshots/`
- Modify: `scripts/check-built-site.ts`

**Interfaces:**
- Consumes: 删除 taxonomy 后的静态页面集合。
- Produces: 15 条视觉用例、15 张 Windows 基线和准确的站内链接总数。

- [x] **Step 1: 收窄视觉路由列表并删除失效基线**

`tests/e2e/visual.spec.ts` 的 `routes` 改为：

```ts
const routes = [
  '/',
  '/posts/本科数学大杂烩/',
  '/archives/',
  '/projects/',
  '/404.html'
];
```

删除六张分类、标签 PNG。

- [x] **Step 2: 构建并取得真实链接计数**

Run:

```powershell
corepack pnpm build
corepack pnpm check:site
```

Expected: 构建成功；第一次 `check:site` 只因 `EXPECTED_LOCAL_LINKS` 仍为 4653 而失败，并打印新计数。确认没有 broken local link 后，把 `scripts/check-built-site.ts` 的 `EXPECTED_LOCAL_LINKS` 改为该计数，再次运行 `corepack pnpm check:site`，预期通过。

- [x] **Step 3: 确认构建产物不含 taxonomy**

Run:

```powershell
@(Test-Path 'dist/categories'), (Test-Path 'dist/tags')
rg -n "/categories/|/tags/" dist -g '*.html' -g 'sitemap*.xml' -g 'search-index.json'
```

Expected: 两个布尔值都是 `False`；`rg` 无输出。

- [x] **Step 4: 更新并复核 Windows 视觉基线**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
corepack pnpm exec playwright test tests/e2e/visual.spec.ts
```

Expected: 15 个视觉测试通过，目录中只有 15 张 PNG。人工检查首页、文章页、归档、作品和 404 的桌面、平板、手机截图，确认导航、侧栏和文章内容没有空洞或错位。

- [x] **Step 5: 提交视觉与构建门禁**

```powershell
git add -- tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots scripts/check-built-site.ts
git commit -m "test: update taxonomy-free site baselines"
```

### Task 5: 同步现行文档并完成验证

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md`
- Modify: `docs/superpowers/plans/2026-09-01-astro-blog-rebuild.md`
- Modify: `docs/superpowers/plans/2026-09-03-remove-taxonomy.md`

**Interfaces:**
- Consumes: 新构建给出的 HTML、链接、Playwright 用例和视觉基线数量。
- Produces: 与代码一致的项目说明和完成证据。

- [x] **Step 1: 更新当前文档**

README 的 frontmatter 示例删除 `category/tags`，字段说明不再提六分类。把页面数、站内链接数、Playwright 用例数和视觉快照数改成验证所得值。

AGENTS 删除“文章分类只能使用六个值”约束，并把目录、测试和 `check:site` 数量改成验证所得值；加入本设计和实施计划的链接。

在旧重建设计和计划标题下加入：

```markdown
> 历史说明：本文档中的文章分类与标签设计已由 `2026-09-03-remove-taxonomy-design.md` 废止。其余内容仍作为当时的设计与实施记录保留。
```

- [x] **Step 2: 清理源码和现行文档残留**

Run:

```powershell
rg -n "POST_CATEGORIES|PostCategory|buildTaxonomy|categoryPath|tagPath|data-category-count|data-tag-count|/categories/|/tags/|^category:|^tags:" src tests README.md AGENTS.md
rg -n "category|tags" dist/search-index.json
```

Expected: 第一条只允许 Giscus 测试或配置中明确限定的 `data-category`、`data-category-id`；第二条无输出。文章正文里的自然语言和 Git `tag` 不属于功能残留，不用删除。

- [x] **Step 3: 使用完成前验证流程运行全套检查**

Run:

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e
corepack pnpm exec vitest list
corepack pnpm exec playwright test --list
git diff --check
```

Expected: 所有命令退出码为 0；测试清单数量与 README、AGENTS 一致；无空白错误。

- [x] **Step 4: 检查文章 URL、Giscus 与用户改动**

Run:

```powershell
rg -c '^legacySlug:' src/content/posts | Measure-Object -Property Values -Sum
rg -n "category: 'Comments'|categoryId:|data-category|data-category-id|mapping: 'pathname'" src tests/e2e/post.spec.ts
git diff -- 'src/content/posts/2025-07-04-杂货铺.md'
```

Expected: legacySlug 总数为 40；Giscus 配置与测试仍在；《杂货铺》的提交差异只包含 frontmatter 删除，未暂存差异只包含用户新增链接。

- [ ] **Step 5: 提交文档并启动预览**

先按 `neat-freak` 检查 README、AGENTS、docs 与代码是否一致，再提交不含用户正文 hunk 的文档和计划：

```powershell
git add -- README.md AGENTS.md docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md docs/superpowers/plans/2026-09-01-astro-blog-rebuild.md docs/superpowers/plans/2026-09-03-remove-taxonomy.md
git commit -m "docs: remove taxonomy from active architecture"
corepack pnpm dev --host 127.0.0.1
```

Expected: 开发服务器监听 `http://127.0.0.1:4321/` 并保持运行。最终汇报通过的命令、真实计数、提交列表，并说明《杂货铺》的未暂存差异只剩用户正文链接。
