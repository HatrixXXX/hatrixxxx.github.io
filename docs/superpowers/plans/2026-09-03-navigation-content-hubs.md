# Navigation Content Hubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把主导航改成五个指定入口，补齐两组二级菜单、五种文章类型页、九个关于子页和 Giscus 留言板。

**Architecture:** `src/config/navigation.ts` 集中保存稳定标签、slug 和层级关系，Header 与静态动态路由共用这份数据。桌面菜单使用 CSS `:hover`/`:focus-within`，移动菜单直接显示嵌套链接；文章 frontmatter 使用必填 `type` 字段筛选，不恢复旧 taxonomy。

**Tech Stack:** Astro 7、TypeScript 5.9、Vitest 4、Playwright 1.62、pnpm/Corepack、Node 24

## Global Constraints

- 保持 Astro 纯静态输出，不增加服务器、数据库或对象存储。
- 保留全部 40 条 `/posts/<legacySlug>/` 和 Giscus pathname 映射。
- 不恢复 `/categories/**`、`/tags/**`、标签或旧分类展示。
- 不改文章正文；只给 frontmatter 增加 `type`。
- 关于子页无用户内容时显示空状态，不填演示资料。
- 桌面支持悬浮和键盘聚焦；移动链接保持至少 44 px 高。
- Node 固定为 24，使用 `corepack pnpm`。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/` 或 Playwright trace。

---

### Task 1: 导航配置和文章类型数据

**Files:**
- Create: `src/config/navigation.ts`
- Modify: `src/content.config.ts:1-26`
- Modify: `src/content/posts/*.md`（40 个已发布文章 frontmatter）
- Modify: `tests/unit/content-schema.test.ts:1-20`
- Modify: `tests/unit/content-utils.test.ts:9-21`
- Create: `tests/unit/navigation-config.test.ts`

**Interfaces:**
- Produces: `POST_TYPES`、`POST_TYPE_LINKS`、`ABOUT_SECTION_LINKS`、`PRIMARY_NAV_ITEMS`。
- Produces: `PostEntry['data']['type']`，值为五种中文类型之一。

- [x] **Step 1: 写配置和内容契约的失败测试**

`tests/unit/navigation-config.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  ABOUT_SECTION_LINKS,
  POST_TYPE_LINKS,
  POST_TYPES,
  PRIMARY_NAV_ITEMS
} from '../../src/config/navigation';

describe('navigation config', () => {
  it('defines the requested primary and secondary navigation', () => {
    expect(PRIMARY_NAV_ITEMS.map(({ label }) => label)).toEqual([
      '首页', '博客文章', '作品橱窗', '关于我', '留言板'
    ]);
    expect(POST_TYPE_LINKS.map(({ label }) => label)).toEqual(POST_TYPES);
    expect(ABOUT_SECTION_LINKS.map(({ label }) => label)).toEqual([
      '我的爱好', '我的研究', '我爱看的', '我爱玩的', '我的相簿',
      '我的装备', '我的工具', '我的书签', '我的友链'
    ]);
  });

  it('uses unique absolute paths', () => {
    const hrefs = [
      ...PRIMARY_NAV_ITEMS.map(({ href }) => href),
      ...POST_TYPE_LINKS.map(({ href }) => href),
      ...ABOUT_SECTION_LINKS.map(({ href }) => href)
    ];
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith('/') && href.endsWith('/'))).toBe(true);
  });
});
```

把 `tests/unit/content-schema.test.ts` 的 taxonomy 测试替换为：

```ts
it('assigns every published post one supported content type without restoring taxonomy', async () => {
  const counts = new Map(POST_TYPES.map((type) => [type, 0]));
  const root = join(process.cwd(), 'src/content/posts');
  const files = (await readdir(root)).filter((file) => /\.mdx?$/.test(file));

  for (const file of files) {
    const { data } = matter(await readFile(join(root, file), 'utf8'));
    expect(POST_TYPES, file).toContain(data.type);
    counts.set(data.type, (counts.get(data.type) ?? 0) + 1);
    expect(data, file).not.toHaveProperty('category');
    expect(data, file).not.toHaveProperty('categories');
    expect(data, file).not.toHaveProperty('tags');
  }

  expect(Object.fromEntries(counts)).toEqual({
    技术笔记: 37,
    踩坑记录: 1,
    生活动态: 0,
    好物推荐: 2,
    随笔杂谈: 0
  });
});
```

同时给该测试文件增加：

```ts
import { POST_TYPES } from '../../src/config/navigation';
```

- [x] **Step 2: 运行测试并确认失败原因**

Run: `corepack pnpm test:run tests/unit/navigation-config.test.ts tests/unit/content-schema.test.ts`

Expected: FAIL，原因分别是 `src/config/navigation.ts` 不存在、文章没有 `type`。

- [x] **Step 3: 写最小配置与 schema**

`src/config/navigation.ts`：

```ts
export const POST_TYPES = [
  '技术笔记',
  '踩坑记录',
  '生活动态',
  '好物推荐',
  '随笔杂谈'
] as const;

export type PostType = (typeof POST_TYPES)[number];

export const POST_TYPE_LINKS = [
  { label: '技术笔记', slug: 'tech-notes', href: '/blog/tech-notes/' },
  { label: '踩坑记录', slug: 'troubleshooting', href: '/blog/troubleshooting/' },
  { label: '生活动态', slug: 'life', href: '/blog/life/' },
  { label: '好物推荐', slug: 'recommendations', href: '/blog/recommendations/' },
  { label: '随笔杂谈', slug: 'essays', href: '/blog/essays/' }
] as const satisfies ReadonlyArray<{ label: PostType; slug: string; href: string }>;

export const ABOUT_SECTION_LINKS = [
  { label: '我的爱好', slug: 'hobbies', href: '/about/hobbies/' },
  { label: '我的研究', slug: 'research', href: '/about/research/' },
  { label: '我爱看的', slug: 'reading', href: '/about/reading/' },
  { label: '我爱玩的', slug: 'games', href: '/about/games/' },
  { label: '我的相簿', slug: 'albums', href: '/about/albums/' },
  { label: '我的装备', slug: 'gear', href: '/about/gear/' },
  { label: '我的工具', slug: 'tools', href: '/about/tools/' },
  { label: '我的书签', slug: 'bookmarks', href: '/about/bookmarks/' },
  { label: '我的友链', slug: 'friends', href: '/about/friends/' }
] as const;

export const PRIMARY_NAV_ITEMS = [
  { label: '首页', href: '/' },
  { label: '博客文章', href: '/blog/', children: POST_TYPE_LINKS },
  { label: '作品橱窗', href: '/projects/' },
  { label: '关于我', href: '/about/', children: ABOUT_SECTION_LINKS },
  { label: '留言板', href: '/guestbook/' }
] as const;
```

`src/content.config.ts` 导入 `POST_TYPES`，并在 `cover` 后增加：

```ts
import { POST_TYPES } from './config/navigation';

type: z.enum(POST_TYPES),
```

`tests/unit/content-utils.test.ts` 的 `post()` 测试夹具在 `cover` 后增加：

```ts
type: '技术笔记',
```

- [x] **Step 4: 给 40 篇文章增加显式类型**

每篇文章在 `cover` 后加入 `type`。分配如下：

```text
踩坑记录：2025-02-17-博客搭建.md
好物推荐：2025-07-04-工具箱.md、2025-07-04-杂货铺.md
技术笔记：src/content/posts 中其余 37 个 Markdown 文件
生活动态：0
随笔杂谈：0
```

示例 frontmatter：

```yaml
cover: /images/default-cover.svg
type: 技术笔记
```

- [x] **Step 5: 运行单元测试并提交**

Run: `corepack pnpm test:run tests/unit/navigation-config.test.ts tests/unit/content-schema.test.ts`

Expected: PASS。

```powershell
git add -- src/config/navigation.ts src/content.config.ts src/content/posts tests/unit/content-schema.test.ts tests/unit/content-utils.test.ts tests/unit/navigation-config.test.ts
git commit -m "feat: define navigation and post types"
```

---

### Task 2: 博客总览和类型页

**Files:**
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[type].astro`
- Create: `tests/e2e/blog-index.spec.ts`

**Interfaces:**
- Consumes: `POST_TYPE_LINKS` 和必填 `PostEntry['data']['type']`。
- Produces: `/blog/` 和五个 `/blog/<type>/` 静态页面。

- [x] **Step 1: 写博客路由失败测试**

`tests/e2e/blog-index.spec.ts`：

```ts
import { expect, test } from '@playwright/test';

test('blog index lists all published posts newest first', async ({ page }) => {
  const response = await page.goto('/blog/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-blog-total]')).toHaveText('40');
  await expect(page.locator('article[data-post-card]')).toHaveCount(40);
});

for (const [path, title, count] of [
  ['/blog/tech-notes/', '技术笔记', 37],
  ['/blog/troubleshooting/', '踩坑记录', 1],
  ['/blog/life/', '生活动态', 0],
  ['/blog/recommendations/', '好物推荐', 2],
  ['/blog/essays/', '随笔杂谈', 0]
] as const) {
  test(`${path} shows only its article type`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText(title);
    await expect(page.locator('article[data-post-card]')).toHaveCount(count);
    if (count === 0) await expect(page.getByText('这个类型还没有文章')).toBeVisible();
  });
}
```

- [x] **Step 2: 运行测试并确认 404**

Run: `corepack pnpm test:e2e tests/e2e/blog-index.spec.ts --project=desktop-1440`

Expected: FAIL，`/blog/` 和类型页返回 404。

- [x] **Step 3: 实现 `/blog/`**

`src/pages/blog/index.astro` 使用 `sortPosts(await getCollection(...))` 获取 40 篇文章，Hero 标题为“博客文章”，正文包含：

```astro
<main class="blog-main container">
  <p class="blog-total">共 <strong data-blog-total>{posts.length}</strong> 篇文章</p>
  <PostList posts={posts} />
</main>
```

页面样式：

```astro
<style>
  .blog-main { padding-block: clamp(2.5rem, 6vw, 5rem); }
  .blog-total { margin: 0 0 1.5rem; color: var(--color-muted); }
  .blog-total strong { color: var(--color-accent); font-size: 1.25em; }
</style>
```

- [x] **Step 4: 实现五个类型页**

`src/pages/blog/[type].astro` 的静态路径核心：

```astro
---
import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import EmptyState from '@/components/EmptyState.astro';
import HeroBanner from '@/components/HeroBanner.astro';
import PostList from '@/components/PostList.astro';
import WaveDivider from '@/components/WaveDivider.astro';
import { POST_TYPE_LINKS } from '@/config/navigation';
import BaseLayout from '@/layouts/BaseLayout.astro';
import { sortPosts, type PostEntry } from '@/lib/content';

export const getStaticPaths = (async () => {
  const allPosts = sortPosts(await getCollection('posts', ({ data }: PostEntry) => !data.draft));
  return POST_TYPE_LINKS.map((type) => ({
    params: { type: type.slug },
    props: { type, posts: allPosts.filter((post) => post.data.type === type.label) }
  }));
}) satisfies GetStaticPaths;

const { type, posts } = Astro.props;
---
```

正文在 `posts.length > 0` 时渲染 `PostList`，否则渲染：

```astro
<EmptyState title="这个类型还没有文章" description="以后写到这类内容时，会放在这里。" />
```

- [x] **Step 5: 运行 E2E 并提交**

Run: `corepack pnpm test:e2e tests/e2e/blog-index.spec.ts --project=desktop-1440`

Expected: 6 tests PASS。

```powershell
git add -- src/pages/blog tests/e2e/blog-index.spec.ts
git commit -m "feat: add blog type pages"
```

---

### Task 3: 关于子页和留言板

**Files:**
- Create: `src/pages/about/[section].astro`
- Create: `src/pages/guestbook.astro`
- Modify: `src/components/GiscusComments.astro:1-26`
- Create: `tests/e2e/about-guestbook.spec.ts`

**Interfaces:**
- Consumes: `ABOUT_SECTION_LINKS` 和 `SITE.giscus`。
- Produces: 九个 `/about/<section>/` 页面和 `/guestbook/`。
- Changes: `GiscusComments` 接收可选 `title?: string`，默认值为“评论”。

- [x] **Step 1: 写路由和组件失败测试**

`tests/e2e/about-guestbook.spec.ts`：

```ts
import { expect, test } from '@playwright/test';
import { ABOUT_SECTION_LINKS } from '../../src/config/navigation';

for (const section of ABOUT_SECTION_LINKS) {
  test(`${section.href} is an independent placeholder page`, async ({ page }) => {
    const response = await page.goto(section.href);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText(section.label);
    await expect(page.getByText('内容还在整理')).toBeVisible();
  });
}

test('guestbook mounts a pathname-mapped Giscus discussion', async ({ page }) => {
  await page.route('https://giscus.app/**', (route) => route.abort());
  const response = await page.goto('/guestbook/');
  expect(response?.status()).toBe(200);
  const comments = page.locator('[data-giscus-comments]');
  await expect(comments.getByRole('heading', { name: '留言' })).toBeVisible();
  await expect(comments).toHaveAttribute('data-giscus-mapping', 'pathname');
});
```

- [x] **Step 2: 运行测试并确认 404**

Run: `corepack pnpm test:e2e tests/e2e/about-guestbook.spec.ts --project=desktop-1440`

Expected: FAIL，关于子页和留言板不存在。

- [x] **Step 3: 实现关于子页**

`src/pages/about/[section].astro` 使用：

```astro
export const getStaticPaths = (() => ABOUT_SECTION_LINKS.map((section) => ({
  params: { section: section.slug },
  props: { section }
}))) satisfies GetStaticPaths;
```

页面正文：

```astro
<BaseLayout title={section.label}>
  <HeroBanner title={section.label} subtitle="关于我的一些记录" image="/images/default-cover.svg" compact />
  <WaveDivider />
  <main class="about-section container">
    <EmptyState title="内容还在整理" description="整理好后会更新到这个页面。" />
  </main>
</BaseLayout>

<style>
  .about-section { padding-block: clamp(2.5rem, 6vw, 5rem); }
</style>
```

- [x] **Step 4: 让 Giscus 标题可配置并创建留言板**

`GiscusComments.astro` frontmatter 增加：

```astro
interface Props { title?: string; }
const { title = '评论' } = Astro.props;
```

把 `aria-label="评论"` 和 `<h2>评论</h2>` 改为 `aria-label={title}` 与 `<h2>{title}</h2>`。

`src/pages/guestbook.astro`：

```astro
---
import GiscusComments from '@/components/GiscusComments.astro';
import HeroBanner from '@/components/HeroBanner.astro';
import WaveDivider from '@/components/WaveDivider.astro';
import BaseLayout from '@/layouts/BaseLayout.astro';
---

<BaseLayout title="留言板">
  <HeroBanner title="留言板" subtitle="想说什么都可以写在这里" image="/images/default-cover.svg" compact />
  <WaveDivider />
  <main class="guestbook-main container">
    <p>留言由 GitHub Discussions 保存，需要登录 GitHub 后发布。</p>
    <GiscusComments title="留言" />
  </main>
</BaseLayout>

<style>
  .guestbook-main { max-width: 920px; padding-block: clamp(2.5rem, 6vw, 5rem); }
  p { color: var(--color-muted); }
</style>
```

- [x] **Step 5: 运行 E2E 并提交**

Run: `corepack pnpm test:e2e tests/e2e/about-guestbook.spec.ts --project=desktop-1440`

Expected: 10 tests PASS。

```powershell
git add -- src/pages/about src/pages/guestbook.astro src/components/GiscusComments.astro tests/e2e/about-guestbook.spec.ts
git commit -m "feat: add about sections and guestbook"
```

---

### Task 4: 桌面下拉导航和移动层级

**Files:**
- Modify: `src/components/SiteHeader.astro:1-257`
- Modify: `tests/e2e/accessibility.spec.ts:59-120`
- Modify: `tests/e2e/no-js.spec.ts:5-18`
- Create: `tests/e2e/navigation-dropdown.spec.ts`

**Interfaces:**
- Consumes: `PRIMARY_NAV_ITEMS`。
- Preserves: `[data-menu-toggle]`、`[data-mobile-menu]` 和 `src/scripts/navigation.ts` 的现有契约。

- [x] **Step 1: 写桌面互斥菜单和移动层级失败测试**

`tests/e2e/navigation-dropdown.spec.ts`：

```ts
import { expect, test } from '@playwright/test';

test('desktop exposes only the hovered or focused submenu', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('.desktop-nav');
  const blog = nav.locator('[data-nav-item="博客文章"]');
  const about = nav.locator('[data-nav-item="关于我"]');

  await expect(blog.locator('.submenu')).toBeHidden();
  await blog.hover();
  await expect(blog.locator('.submenu')).toBeVisible();
  await expect(about.locator('.submenu')).toBeHidden();

  await about.hover();
  await expect(about.locator('.submenu')).toBeVisible();
  await expect(blog.locator('.submenu')).toBeHidden();

  await about.getByRole('link', { name: '关于我', exact: true }).focus();
  await expect(about.locator('.submenu')).toBeVisible();
});

test('mobile menu preserves primary and nested links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '切换导航栏' }).click();
  const menu = page.locator('[data-mobile-menu]');
  await expect(menu.locator(':scope > ul > li > a')).toHaveCount(5);
  await expect(menu.getByRole('link', { name: '技术笔记', exact: true })).toBeVisible();
  await expect(menu.getByRole('link', { name: '我的友链', exact: true })).toBeVisible();
});
```

- [x] **Step 2: 运行测试并确认旧导航失败**

Run: `corepack pnpm test:e2e tests/e2e/navigation-dropdown.spec.ts --project=desktop-1440`

Expected: FAIL，找不到两个 `data-nav-item` 和 `.submenu`。

- [x] **Step 3: 替换 Header 导航结构**

`SiteHeader.astro` 导入 `PRIMARY_NAV_ITEMS`，删除本地 `links`。桌面与移动列表都使用一级 `li[data-nav-item]`、父链接和可选嵌套 `<ul class="submenu">`；父链接中的倒三角写成：

```astro
{'children' in item && <span class="nav-caret" aria-hidden="true"></span>}
```

当前页面精确匹配时加入：

```astro
aria-current={Astro.url.pathname === item.href ? 'page' : undefined}
```

子链接同样按 pathname 精确标记。不要给三角增加按钮或点击脚本。

- [x] **Step 4: 增加桌面和移动样式**

桌面样式必须包含：

```css
.nav-item { position: relative; }
.nav-caret {
  display: inline-block;
  margin-left: 0.35rem;
  border-top: 0.3rem solid currentColor;
  border-right: 0.25rem solid transparent;
  border-left: 0.25rem solid transparent;
  vertical-align: middle;
}
.desktop-nav .submenu {
  position: absolute;
  top: 100%;
  left: 50%;
  display: grid;
  visibility: hidden;
  min-width: 9rem;
  padding: 0.45rem;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: rgb(22 26 32 / 96%);
  box-shadow: var(--shadow-panel);
  opacity: 0;
  transform: translate(-50%, -0.35rem);
  transition: opacity 160ms ease, transform 160ms ease, visibility 160ms ease;
}
.desktop-nav .nav-item:hover > .submenu,
.desktop-nav .nav-item:focus-within > .submenu {
  visibility: visible;
  opacity: 1;
  transform: translate(-50%, 0);
}
.desktop-nav > ul:hover .nav-item:focus-within:not(:hover) > .submenu {
  visibility: hidden;
  opacity: 0;
}
```

移动端重置 `.submenu` 为普通文档流，并设置 `.mobile-nav { max-height: calc(100vh - var(--header-height)); overflow-y: auto; }`。一级和二级链接都保持 `min-height: 44px`，二级项使用缩进和较弱文字颜色。

- [x] **Step 5: 更新旧测试的选择器**

`no-js.spec.ts` 只统计一级项：

```ts
const headerLinks = page.locator('.desktop-nav > ul > li > a');
await expect(headerLinks).toHaveCount(5);
await page.getByRole('link', { name: '博客文章', exact: true }).click();
await expect(page.locator('[data-blog-total]')).toHaveText('40');
```

`accessibility.spec.ts` 的触控目标选择器扩展到移动嵌套链接，不改变 44 px 断言。

- [x] **Step 6: 运行相关 E2E 并提交**

Run: `corepack pnpm test:e2e tests/e2e/navigation-dropdown.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/no-js.spec.ts tests/e2e/interactions.spec.ts`

Expected: 全部 PASS。

```powershell
git add -- src/components/SiteHeader.astro tests/e2e/navigation-dropdown.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/no-js.spec.ts
git commit -m "feat: add responsive navigation dropdowns"
```

---

### Task 5: 构建契约、视觉基线和完整验证

**Files:**
- Modify: `tests/e2e/index-pages.spec.ts`
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/*.png`
- Modify: `scripts/check-built-site.ts:8`
- Modify: `AGENTS.md`（只在固定计数或现行目录说明需要同步时）

**Interfaces:**
- Verifies: 所有新增静态地址、公共 Header、链接总数和视觉结果。

- [x] **Step 1: 扩展静态路由检查**

在 `tests/e2e/index-pages.spec.ts` 增加：

```ts
for (const route of [
  '/blog/',
  '/blog/tech-notes/',
  '/blog/troubleshooting/',
  '/blog/life/',
  '/blog/recommendations/',
  '/blog/essays/',
  '/about/hobbies/',
  '/about/research/',
  '/about/reading/',
  '/about/games/',
  '/about/albums/',
  '/about/gear/',
  '/about/tools/',
  '/about/bookmarks/',
  '/about/friends/',
  '/guestbook/'
]) {
  test(`${route} is generated`, async ({ request }) => {
    expect((await request.get(route)).status()).toBe(200);
  });
}
```

- [x] **Step 2: 运行非视觉验证**

Run:

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
```

Expected: 全部退出码为 0；构建生成 40 个旧文章页和 16 个新增内容页。

- [x] **Step 3: 校准站内链接固定值**

Run: `corepack pnpm check:site`

Expected first run: 只允许固定链接总数不匹配；不得有 broken local link。把输出中的 `found N` 原样写入 `scripts/check-built-site.ts` 的 `EXPECTED_LOCAL_LINKS`，再运行同一命令。

Expected second run: 退出码 0，输出 `Checked N local links`。

- [x] **Step 4: 更新并检查视觉基线**

把 `/blog/` 加入 `tests/e2e/visual.spec.ts` 的 `routes`。运行：

```powershell
corepack pnpm test:e2e tests/e2e/visual.spec.ts --update-snapshots
corepack pnpm test:e2e tests/e2e/visual.spec.ts
```

Expected: 18 个视觉测试 PASS。人工查看桌面 Header 无换行，两个菜单默认不出现在截图；390/768 菜单关闭时页面无横向溢出；`/blog/` 的 40 张卡片没有重复链接。

- [x] **Step 5: 运行完整站点验证**

Run:

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e
git diff --check
```

Expected: 所有命令退出码为 0；Playwright 包含原 59 项和新增检查，最终数量以测试收集输出为准；无 TypeScript、Astro、断链、视觉或空白页面错误。

- [x] **Step 6: 清理文档并提交**

按 `neat-freak` 核对 `README.md`、`AGENTS.md` 和 `docs/` 是否与当前代码冲突；只修改已经失效的现行说明，不改历史 spec/plan。

```powershell
git add -- scripts/check-built-site.ts tests/e2e/index-pages.spec.ts tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots AGENTS.md README.md docs
git commit -m "test: verify navigation content hubs"
```

- [x] **Step 7: 启动本地预览**

Run: `corepack pnpm dev --host 127.0.0.1`

Expected: 开发服务器保持运行，`http://127.0.0.1:4321/` 返回 200。
