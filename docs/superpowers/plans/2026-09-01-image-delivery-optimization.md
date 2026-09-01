# 博客图片交付优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可重复运行的图片优化管线，为首页生成缩略图、压缩正文与封面图片，并让加载页咖啡图在强制刷新时优先出现。

**Architecture:** Node 脚本从博客源码提取图床引用，以 manifest 连接源路径、完整 WebP、首页缩略图和引用位置；`audit` 只读，`apply` 生成文件并改链接，`prune` 只删除已经迁移且零引用的原图。博客和图床分别在独立 worktree 中提交，先发布新图片，再切换博客，线上验证后才删除原图。

**Tech Stack:** Node.js、原生 `node:test`、Sharp 0.34.3、Jekyll/Chirpy、Git、GitHub Pages、jsDelivr。

## Global Constraints

- 完整图片：PNG、JPEG、无扩展名 JPEG 和 BMP 转 WebP，质量 88；宽度只在超过 1920px 时缩小。
- 首页缩略图：640×336、40:21 居中裁剪、WebP 质量 82；所有已发布文章都生成。
- 动态 GIF 只有在帧数、循环次数、延迟一致且输出更小时才采用动态 WebP。
- SVG、已有 WebP 和 AVIF 默认不转完整图；SVG 和 GIF 封面仍可生成静态缩略图。
- 输出只有比源文件小时才采用；未采用时继续使用原 URL。
- 输出路径固定为 `img/optimized/<原文件名>.<原扩展名>.webp` 和 `img/thumbnails/<原文件名>.<原扩展名>.webp`。
- manifest schema v3 记录源格式、源宽高和页数；动画高度使用单帧高度。
- `audit` 和 `apply` 复用 manifest 中既有映射，只处理新增原图；相同输入的第二次 `apply` 不产生文件或 manifest 差异。
- 咖啡图保持 500×500，WebP 必须小于 70 KiB；PNG 保留作回退。
- 图床新增文件先于博客链接发布；原图删除晚于博客线上验证。
- 不清理 Git 历史，不更换 GitHub Pages 或 jsDelivr。
- 未经用户确认不得推送博客、部署 Pages 或执行图床 `prune`。

---

### Task 1: 创建两个隔离 worktree并记录基线

**Files:**
- Read: `docs/superpowers/specs/2026-09-01-image-delivery-optimization-design.md`
- Read: `package.json`
- Read: `_layouts/home.html`
- Read: `_includes/head.html`
- Read: `_layouts/default.html`
- Read: `assets/js/loading-animation.js`

**Interfaces:**
- Produces: `BLOG_ROOT` 和 `IMAGE_ROOT` 两个绝对路径；后续任务只在对应 worktree 修改文件。

- [ ] **Step 1: 调用 worktree skill**

Invoke `superpowers:using-git-worktrees`。博客分支使用 `feature/image-delivery-optimization`，目录使用 `E:\CollegeData\hatrixxxx.github.io-image-optimization`。

图床使用现有本地克隆 `E:\CollegeData\.codex-image-cleanup-staging` 作为 object store；从最新 `origin/master` 创建 `feature/image-optimization-assets` worktree，目录使用 `E:\CollegeData\Hatrix-s-Blog-Image-optimization`。如果现有克隆不可用，重新 clone 后再创建分支，不复用脏工作树。

- [ ] **Step 2: 验证分支起点和工作树**

Run:

```powershell
git -C E:\CollegeData\hatrixxxx.github.io-image-optimization status --short --branch
git -C E:\CollegeData\Hatrix-s-Blog-Image-optimization status --short --branch
git -C E:\CollegeData\Hatrix-s-Blog-Image-optimization fetch origin master
git -C E:\CollegeData\Hatrix-s-Blog-Image-optimization rev-parse HEAD
git -C E:\CollegeData\Hatrix-s-Blog-Image-optimization rev-parse origin/master
```

Expected: 两个工作树无未提交改动；图床 `HEAD` 与 `origin/master` 相同。若不同，停止并重新基于最新远端创建分支。

- [ ] **Step 3: 记录可复现基线**

Run:

```powershell
rg -n "cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image" _posts _draft _tabs
(Get-Item assets/img/coffee.png).Length
git -C E:\CollegeData\Hatrix-s-Blog-Image-optimization ls-files img | Measure-Object
```

Expected: 咖啡 PNG 为 217874 字节；图床文件数和引用数写入任务日志，但实现不得用常量断言这些数量。

---

### Task 2: 实现路径、URL 与引用扫描

**Files:**
- Modify: `package.json`
- Create: `tools/image-pipeline/paths.mjs`
- Create: `tools/image-pipeline/scan.mjs`
- Create: `tools/image-pipeline/test/paths.test.mjs`
- Create: `tools/image-pipeline/test/scan.test.mjs`

**Interfaces:**
- Produces: `decodeRepoPath(url): string | null`、`fullOutputPath(path): string`、`thumbnailOutputPath(path): string`、`cdnUrl(path): string`、`scanReferences(root): Promise<Reference[]>`。
- `Reference` shape: `{ file: string; line: number; rawUrl: string; repoPath: string; scope: 'published'|'draft'|'site'; kind: 'cover'|'inline' }`。

- [ ] **Step 1: 添加失败的路径测试**

Create `tools/image-pipeline/test/paths.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cdnUrl,
  decodeRepoPath,
  fullOutputPath,
  thumbnailOutputPath
} from '../paths.mjs';

test('normalizes encoded jsDelivr paths and keeps the source suffix', () => {
  const url = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/servlet%20(1).png';
  assert.equal(decodeRepoPath(url), 'img/servlet (1).png');
  assert.equal(fullOutputPath('img/UAV.jpg'), 'img/optimized/UAV.jpg.webp');
  assert.equal(thumbnailOutputPath('img/UAV.jpg'), 'img/thumbnails/UAV.jpg.webp');
  assert.equal(
    cdnUrl('img/thumbnails/微信图片.jpg.webp'),
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/thumbnails/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87.jpg.webp'
  );
});
```

Run: `node --test tools/image-pipeline/test/paths.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `paths.mjs`。

- [ ] **Step 2: 实现路径接口**

Create `tools/image-pipeline/paths.mjs`:

```js
import { posix } from 'node:path';

const PREFIX = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/';

export function decodeRepoPath(rawUrl) {
  if (!rawUrl.startsWith(PREFIX)) return null;
  const rawPath = rawUrl.slice(PREFIX.length).split(/[?#]/u, 1)[0];
  try {
    return decodeURIComponent(rawPath).replaceAll('\\', '/').replace(/^\/+/, '');
  } catch {
    return rawPath.replaceAll('\\', '/').replace(/^\/+/, '');
  }
}

const suffix = (path) => `${posix.basename(path)}.webp`;
export const fullOutputPath = (path) => `img/optimized/${suffix(path)}`;
export const thumbnailOutputPath = (path) => `img/thumbnails/${suffix(path)}`;
export const cdnUrl = (path) => PREFIX + path.split('/').map(encodeURIComponent).join('/');
```

- [ ] **Step 3: 添加失败的扫描测试**

Create `tools/image-pipeline/test/scan.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanReferences } from '../scan.mjs';

test('finds frontmatter, HTML and angle-wrapped Markdown URLs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-scan-'));
  await mkdir(join(root, '_posts'));
  await writeFile(join(root, '_posts', 'x.md'), `---\nimage:\n  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/UAV.jpg\n---\n![](<https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/servlet%20(1).png>)\n<img src="https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/math.png">\n`);
  const refs = await scanReferences(root);
  assert.deepEqual(refs.map((item) => item.repoPath), [
    'img/UAV.jpg', 'img/servlet (1).png', 'img/math.png'
  ]);
  assert.deepEqual(refs.map((item) => item.line), [3, 5, 6]);
  assert.deepEqual(refs.map((item) => item.kind), ['cover', 'inline', 'inline']);
  assert.ok(refs.every((item) => item.scope === 'published'));
});
```

Run: `node --test tools/image-pipeline/test/scan.test.mjs`

Expected: FAIL because `scanReferences` does not exist。

- [ ] **Step 4: 实现扫描器并添加测试命令**

Create `tools/image-pipeline/scan.mjs`:

```js
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { decodeRepoPath } from './paths.mjs';

const SOURCE_DIRS = ['_posts', '_draft', '_tabs'];
const TEXT_EXTENSIONS = new Set(['.md', '.html', '.yml', '.yaml', '.scss', '.css', '.js']);
const URL_PATTERN = /https?:\/\/cdn\.jsdelivr\.net\/gh\/HatrixXXX\/Hatrix-s-Blog-Image\/[^\s"'<>]+/gu;

async function walk(dir) {
  const output = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return output;
    throw error;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) output.push(path);
  }
  return output;
}

function scopeFor(file) {
  if (file.startsWith('_posts/')) return 'published';
  if (file.startsWith('_draft/')) return 'draft';
  return 'site';
}

export async function scanReferences(root) {
  const refs = [];
  for (const sourceDir of SOURCE_DIRS) {
    for (const absolute of await walk(join(root, sourceDir))) {
      const text = await readFile(absolute, 'utf8');
      const file = relative(root, absolute).split(sep).join('/');
      const firstFence = text.startsWith('---') ? text.indexOf('\n---', 3) : -1;
      for (const match of text.matchAll(URL_PATTERN)) {
        const rawUrl = match[0].replace(/\)+$/u, '');
        const repoPath = decodeRepoPath(rawUrl);
        if (!repoPath) continue;
        const lineStart = text.lastIndexOf('\n', match.index) + 1;
        const lineEnd = text.indexOf('\n', match.index);
        const lineText = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
        refs.push({
          file,
          line: text.slice(0, match.index).split(/\r\n|\n|\r/u).length,
          rawUrl,
          repoPath,
          scope: scopeFor(file),
          kind: firstFence > match.index && /^\s+path\s*:/u.test(lineText) ? 'cover' : 'inline',
          offset: match.index
        });
      }
    }
  }
  return refs.sort((a, b) => a.file.localeCompare(b.file) || a.offset - b.offset)
    .map(({ offset, ...ref }) => ref);
}
```

Modify `package.json` scripts:

```json
"test:images": "node --test tools/image-pipeline/test/*.test.mjs",
"images": "node tools/image-pipeline/cli.mjs"
```

Run: `npm run test:images`

Expected: both path and scan tests PASS。

- [ ] **Step 5: Commit**

```bash
git add package.json tools/image-pipeline
git commit -m "test: define image pipeline paths and scanning"
```

---

### Task 3: 实现 Sharp 转换引擎

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Create: `tools/image-pipeline/convert.mjs`
- Create: `tools/image-pipeline/test/convert.test.mjs`

**Interfaces:**
- Produces: `optimizeFull(source, destination): Promise<Conversion>`、`createThumbnail(source, destination): Promise<Conversion>`、`acceptAnimatedGif(sourceMeta, outputMeta, sourceBytes, outputBytes): boolean`。
- `Conversion` shape: `{ adopted: boolean; sourceBytes: number; outputBytes: number; width: number; height: number; format: string; reason: string }`。

- [ ] **Step 1: 安装固定版本依赖**

Run: `npm install --save-dev sharp@0.34.3`

Expected: `package.json` contains `"sharp": "^0.34.3"` and `package-lock.json` is created or updated。

- [ ] **Step 2: 写失败的转换测试**

Create `tools/image-pipeline/test/convert.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { acceptAnimatedGif, createThumbnail, optimizeFull } from '../convert.mjs';

test('limits full width and creates an exact 40:21 thumbnail', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-convert-'));
  const source = join(root, 'source.png');
  const full = join(root, 'full.webp');
  const thumb = join(root, 'thumb.webp');
  const pixels = Buffer.alloc(2400 * 1200 * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 31) % 251;
  await sharp(pixels, { raw: { width: 2400, height: 1200, channels: 3 } }).png().toFile(source);
  const fullResult = await optimizeFull(source, full);
  const thumbResult = await createThumbnail(source, thumb);
  assert.equal((await sharp(full).metadata()).width, 1920);
  assert.deepEqual(
    [(await sharp(thumb).metadata()).width, (await sharp(thumb).metadata()).height],
    [640, 336]
  );
  assert.equal(fullResult.adopted, true);
  assert.equal(thumbResult.adopted, true);
});

test('accepts animated output only when timing is preserved and bytes shrink', () => {
  const source = { pages: 3, loop: 0, delay: [80, 90, 100] };
  assert.equal(acceptAnimatedGif(source, source, 1000, 700), true);
  assert.equal(acceptAnimatedGif(source, { ...source, delay: [80, 80, 100] }, 1000, 700), false);
  assert.equal(acceptAnimatedGif(source, source, 1000, 1100), false);
});
```

Run: `npm run test:images`

Expected: FAIL because `convert.mjs` does not exist。

- [ ] **Step 3: 实现静态图片转换**

Create `tools/image-pipeline/convert.mjs` with these exact Sharp options:

```js
import { mkdir, rename, rm, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

async function size(path) { return (await stat(path)).size; }
async function prepare(path) { await mkdir(dirname(path), { recursive: true }); }

export function acceptAnimatedGif(source, output, sourceBytes, outputBytes) {
  return source.pages === output.pages &&
    source.loop === output.loop &&
    JSON.stringify(source.delay ?? []) === JSON.stringify(output.delay ?? []) &&
    outputBytes < sourceBytes;
}

export async function optimizeFull(source, destination) {
  await prepare(destination);
  const temp = `${destination}.tmp`;
  const sourceMeta = await sharp(source, { animated: true }).metadata();
  const sourceBytes = await size(source);
  const animated = (sourceMeta.pages ?? 1) > 1;
  let pipeline = sharp(source, { animated }).rotate();
  if ((sourceMeta.width ?? 0) > 1920) pipeline = pipeline.resize({ width: 1920, withoutEnlargement: true });
  await pipeline.webp({ quality: 88, alphaQuality: 100, effort: 5, loop: sourceMeta.loop }).toFile(temp);
  const outputMeta = await sharp(temp, { animated: true }).metadata();
  const outputBytes = await size(temp);
  const adopted = animated
    ? acceptAnimatedGif(sourceMeta, outputMeta, sourceBytes, outputBytes)
    : outputBytes < sourceBytes;
  if (!adopted) await unlink(temp);
  else {
    await rm(destination, { force: true });
    await rename(temp, destination);
  }
  return {
    adopted, sourceBytes, outputBytes,
    width: outputMeta.width ?? 0, height: outputMeta.height ?? 0,
    format: outputMeta.format ?? 'webp', reason: adopted ? 'smaller' : 'not-smaller-or-animation-changed'
  };
}

export async function createThumbnail(source, destination) {
  await prepare(destination);
  await sharp(source, { animated: false, pages: 1 }).rotate()
    .resize(640, 336, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, alphaQuality: 100, effort: 5 })
    .toFile(destination);
  const meta = await sharp(destination).metadata();
  return {
    adopted: true, sourceBytes: await size(source), outputBytes: await size(destination),
    width: meta.width ?? 0, height: meta.height ?? 0,
    format: meta.format ?? 'webp', reason: 'homepage-thumbnail'
  };
}
```

If Sharp reports GIF delays as a scalar instead of an array on this platform, normalize both values to arrays before comparison and add that case to the test; do not remove timing validation。

- [ ] **Step 4: Run tests**

Run: `npm run test:images`

Expected: all tests PASS; generated full width is 1920 and thumbnail is 640×336。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tools/image-pipeline
git commit -m "feat: add deterministic WebP conversion"
```

---

### Task 4: 实现 manifest、引用更新和删除保护

**Files:**
- Create: `tools/image-pipeline/manifest.mjs`
- Create: `tools/image-pipeline/update.mjs`
- Create: `tools/image-pipeline/cli.mjs`
- Create: `tools/image-pipeline/test/update.test.mjs`
- Create: `tools/image-pipeline/test/prune.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `buildManifest(blogRoot, imageRoot)`、`applyReferenceMap(text, map)`、`upsertThumbnail(text, fullUrl, thumbnailUrl)`、`pruneCandidates(manifest, currentRefs): string[]`。
- CLI: `npm run images -- audit|apply|prune --blog-root <abs> --image-root <abs> --report <path>`。

- [ ] **Step 1: 写失败的更新和 prune 测试**

Create `tools/image-pipeline/test/update.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReferenceMap, upsertThumbnail } from '../update.mjs';

test('rewrites exact URLs and adds thumbnail without reformatting frontmatter', () => {
  const oldUrl = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/UAV.jpg';
  const full = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/optimized/UAV.jpg.webp';
  const thumb = 'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/thumbnails/UAV.jpg.webp';
  const source = `---\ntitle: UAV\nimage:\n  path: ${oldUrl}\n---\n![](${oldUrl})\n`;
  const rewritten = applyReferenceMap(source, new Map([[oldUrl, full]]));
  assert.equal(upsertThumbnail(rewritten, full, thumb), `---\ntitle: UAV\nimage:\n  path: ${full}\n  thumbnail: ${thumb}\n---\n![](${full})\n`);
});
```

Create `tools/image-pipeline/test/prune.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneCandidates } from '../manifest.mjs';

test('prunes only adopted sources with zero current references', () => {
  const manifest = { entries: [
    { sourcePath: 'img/a.png', full: { adopted: true } },
    { sourcePath: 'img/b.png', full: { adopted: false } },
    { sourcePath: 'img/c.png', full: { adopted: true } }
  ] };
  const refs = new Set(['img/c.png']);
  assert.deepEqual(pruneCandidates(manifest, refs), ['img/a.png']);
});
```

Run: `npm run test:images`

Expected: FAIL because update and manifest modules do not exist。

- [ ] **Step 2: 实现无格式漂移的文本更新**

Create `tools/image-pipeline/update.mjs`:

```js
export function applyReferenceMap(text, replacements) {
  return [...replacements.entries()]
    .sort(([a], [b]) => b.length - a.length)
    .reduce((current, [from, to]) => current.split(from).join(to), text);
}

const unquote = (value) => value.replace(/^(['"])(.*)\1$/u, '$2');

export function upsertThumbnail(text, fullUrl, thumbnailUrl) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r\n|\n/u);
  if (lines[0] !== '---') throw new Error('frontmatter start not found');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error('frontmatter end not found');
  const image = lines.slice(1, end).findIndex((line) => /^image:\s*$/u.test(line));
  if (image < 0) throw new Error('image mapping not found');
  const imageLine = image + 1;
  let blockEnd = imageLine + 1;
  while (blockEnd < end && (/^\s+/u.test(lines[blockEnd]) || lines[blockEnd] === '')) blockEnd += 1;
  const pathIndices = [];
  for (let index = imageLine + 1; index < blockEnd; index += 1) {
    if (/^\s{2}path:\s*/u.test(lines[index])) pathIndices.push(index);
  }
  if (pathIndices.length !== 1) throw new Error('image.path is ambiguous');
  const pathIndex = pathIndices[0];
  const value = unquote(lines[pathIndex].replace(/^\s{2}path:\s*/u, '').trim());
  if (value !== fullUrl) throw new Error(`image.path mismatch: ${value}`);
  const thumbnailIndex = lines.findIndex((line, index) =>
    index > imageLine && index < blockEnd && /^\s{2}thumbnail:\s*/u.test(line));
  if (thumbnailIndex >= 0) lines[thumbnailIndex] = `  thumbnail: ${thumbnailUrl}`;
  else lines.splice(pathIndex + 1, 0, `  thumbnail: ${thumbnailUrl}`);
  return lines.join(newline);
}
```

- [ ] **Step 3: 实现 manifest 和删除集合**

Create the manifest entry in `buildManifest` by grouping `scanReferences` by `repoPath`, resolving each source with `resolve(imageRoot, sourcePath)`, and rejecting it unless the result starts with `resolve(imageRoot, 'img') + sep`。Read Sharp metadata to mark full-image eligibility as `png|jpeg|gif|bmp`; mark thumbnail eligibility when a reference has `scope === 'published' && kind === 'cover'`。Generate paths with `fullOutputPath` and `thumbnailOutputPath`。The JSON top level is:

```js
{
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  blogCommit,
  sourceImageCommit,
  publishedImageCommit: null,
  entries: [{
    sourcePath, sourceBytes,
    source: { format, width, height, pages },
    references,
    full: { path, url, adopted, outputBytes, reason, width, height, pages, format },
    thumbnail: { path, url, adopted, outputBytes, reason, width, height, pages, format }
  }]
}
```

动画的 `source.height` 和输出 `height` 都是单帧高度。`audit` 与 `apply` 读取已有 manifest，识别 `sourcePath`、已采用的 `full.path` 和 `thumbnail.path`；这些路径不再作为新源处理。只有首次出现的原图生成新 entry。

Add this exact deletion selector to `tools/image-pipeline/manifest.mjs`:

```js
export function pruneCandidates(manifest, currentRefs) {
  return manifest.entries
    .filter(({ sourcePath, full }) => {
      if (!sourcePath.startsWith('img/') || sourcePath.startsWith('img/optimized/') ||
          sourcePath.startsWith('img/thumbnails/')) {
        throw new Error(`unsafe prune path: ${sourcePath}`);
      }
      return full.adopted && !currentRefs.has(sourcePath);
    })
    .map(({ sourcePath }) => sourcePath)
    .sort();
}
```

- [ ] **Step 4: 实现安全 CLI**

Implement `cli.mjs` with `parseArgs({ options: { 'blog-root': { type: 'string' }, 'image-root': { type: 'string' }, report: { type: 'string' }, 'confirm-prune': { type: 'boolean' } }, allowPositionals: true })`。The first positional must be `audit`, `apply` or `prune`; both roots must be absolute and exist。

Use `execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })` to require clean roots before `apply` or `prune`。`audit` calls `buildManifest` and writes only `report`。`apply` calls `buildManifest`, reuses current manifest mappings, converts only eligible new entries, updates references, and writes `tools/image-pipeline/manifest.json` only when its bytes change。`prune` requires `--report`。It validates schema v3, a full `publishedImageCommit`, and every adopted output against that commit; then it resolves and stats every candidate before any unlink。Without `--confirm-prune` it writes a dry-run report and deletes nothing。With confirmation it writes the final deletion result to the same report。The CLI never invokes `git push`。

Append to `.gitignore`:

```gitignore
reports/
```

- [ ] **Step 5: Run tests and CLI help**

Run:

```powershell
npm run test:images
npm run images -- --help
```

Expected: all tests PASS; help lists `audit`, `apply`, `prune`, required roots, report path and `--confirm-prune`。

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/image-pipeline
git commit -m "feat: add safe image migration commands"
```

---

### Task 5: 优化加载页咖啡图

**Files:**
- Create: `tools/image-pipeline/test/loading-image.test.mjs`
- Create: `assets/img/coffee.webp`
- Modify: `_includes/head.html`
- Modify: `_layouts/default.html`

**Interfaces:**
- Produces: preloaded `/assets/img/coffee.webp` and PNG fallback。

- [ ] **Step 1: 写并运行失败测试**

Create `tools/image-pipeline/test/loading-image.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('coffee loader is small, preloaded and high priority', async () => {
  const head = await readFile('_includes/head.html', 'utf8');
  const layout = await readFile('_layouts/default.html', 'utf8');
  const image = await stat('assets/img/coffee.webp');
  assert.ok(image.size < 70 * 1024, `coffee.webp is ${image.size} bytes`);
  assert.match(head, /rel="preload"[^>]+href="\/assets\/img\/coffee\.webp"[^>]+type="image\/webp"/u);
  assert.match(layout, /<source srcset="\/assets\/img\/coffee\.webp" type="image\/webp">/u);
  assert.match(layout, /fetchpriority="high"/u);
  assert.match(layout, /width="500" height="500"/u);
  assert.match(layout, /cake\.png[^>]+loading="lazy"[^>]+fetchpriority="low"/u);
});
```

Run: `node --test tools/image-pipeline/test/loading-image.test.mjs`

Expected: FAIL because `coffee.webp` and preload markup do not exist。

- [ ] **Step 2: 生成咖啡 WebP**

Run:

```powershell
node -e "import('sharp').then(async({default:s})=>{await s('assets/img/coffee.png').webp({quality:82,alphaQuality:100,effort:6}).toFile('assets/img/coffee.webp')})"
(Get-Item assets/img/coffee.webp).Length
```

Expected: output is below 71680 bytes。If it is larger, reduce quality in steps of 2 down to 76; do not resize below 500×500。

- [ ] **Step 3: 修改 preload 和 picture**

Add near the start of `_includes/head.html`:

```html
<link rel="preload" href="/assets/img/coffee.webp" as="image" type="image/webp" fetchpriority="high">
```

Replace the dark animation image with:

```html
<picture>
  <source srcset="/assets/img/coffee.webp" type="image/webp">
  <img src="/assets/img/coffee.png" alt="咖啡图片" class="coffee-img floating-img"
       width="500" height="500" loading="eager" decoding="sync" fetchpriority="high">
</picture>
```

Add `width="500" height="500" loading="lazy" decoding="async" fetchpriority="low"` to the hidden cake image without changing its fallback behavior。

- [ ] **Step 4: Verify and commit**

Run: `npm run test:images`

Expected: all tests PASS and coffee WebP remains below 70 KiB。

```bash
git add assets/img/coffee.webp _includes/head.html _layouts/default.html tools/image-pipeline/test/loading-image.test.mjs
git commit -m "perf: preload compact coffee loader image"
```

---

### Task 6: 让首页使用独立缩略图

**Files:**
- Create: `tools/image-pipeline/test/home-thumbnail.test.mjs`
- Modify: `_layouts/home.html`
- Generated modify: `_posts/*.md`
- Generated modify: `_draft/*.md`

**Interfaces:**
- Home template consumes `post.image.thumbnail | default: post.image.path | default: post.image`。

- [ ] **Step 1: 写并运行失败测试**

Create `tools/image-pipeline/test/home-thumbnail.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('home prefers a thumbnail while retaining the full cover', async () => {
  const home = await readFile('_layouts/home.html', 'utf8');
  assert.match(home, /post\.image\.thumbnail\s*\|\s*default:\s*post\.image\.path/u);
});
```

Run: `node --test tools/image-pipeline/test/home-thumbnail.test.mjs`

Expected: FAIL because the template reads only `post.image.path`。

- [ ] **Step 2: 修改模板**

Replace the source assignment inside `_layouts/home.html` with:

```liquid
{% assign src = post.image.thumbnail | default: post.image.path | default: post.image %}
```

Keep the existing LQIP, alt, wrapper and lazy-loading behavior unchanged。

- [ ] **Step 3: Run tests and commit template support**

Run: `npm run test:images`

Expected: all tests PASS。

```bash
git add _layouts/home.html tools/image-pipeline/test/home-thumbnail.test.mjs
git commit -m "feat: support dedicated home thumbnails"
```

---

### Task 7: 审计真实图片并生成图床新增文件

**Files:**
- Generated: `reports/image-pipeline-audit.json` (ignored)
- Generated in image worktree: `img/optimized/*.webp`
- Generated in image worktree: `img/thumbnails/*.webp`
- Generated: `tools/image-pipeline/manifest.json`

**Interfaces:**
- Consumes: clean blog and image worktrees plus pipeline CLI。
- Produces: a reviewed manifest and an image-repo commit containing additions only。

- [ ] **Step 1: Run audit**

```powershell
npm run images -- audit `
  --blog-root E:\CollegeData\hatrixxxx.github.io-image-optimization `
  --image-root E:\CollegeData\Hatrix-s-Blog-Image-optimization `
  --report reports/image-pipeline-audit.json
```

Expected: every reference resolves to an image-repo file; no output files or source files change。The report lists source bytes and eligibility, but does not claim projected compression bytes because audit does not encode images。

- [ ] **Step 2: Review audit before writes**

Check that all output paths start with `img/optimized/` or `img/thumbnails/`。Summarize source MiB, eligible full images, retained originals, eligible thumbnails and GIF decisions。Do not report projected output MiB from audit。Open at least ten samples: largest PNG, largest JPEG, transparent image, text screenshot, SVG thumbnail and each used GIF。

Expected: no ambiguous path, output collision or missing source。

- [ ] **Step 3: Apply generation without pruning**

Run the same command with `apply`。Expected: optimized files and thumbnails appear in the image worktree; blog references and `image.thumbnail` fields update in the blog worktree; no source image is deleted。

Commit the generated outputs and blog migration in their respective worktrees, then run the same `apply` command again。Expected: manifest bytes do not change and both worktrees remain clean。

- [ ] **Step 4: Verify generated assets**

Run:

```powershell
npm run test:images
bundle exec jekyll build
git -C E:\CollegeData\Hatrix-s-Blog-Image-optimization diff --diff-filter=D --name-only
```

Expected: tests and Jekyll build PASS; deletion diff is empty; every adopted output is smaller than its source; every thumbnail is 640×336。

- [ ] **Step 5: Create recovery branch and commit additions**

Create local branch `backup/pre-image-optimization-20260901` at the image worktree parent commit。Commit only `img/optimized/` and `img/thumbnails/`:

```bash
git add img/optimized img/thumbnails
git commit -m "feat: add optimized blog image variants"
```

Run `git diff-tree --name-status HEAD^ HEAD` and confirm every status is `A`。

- [ ] **Step 6: User checkpoint before image push**

Report generated counts, before/after MiB and sample inspection. After user confirmation, push the backup branch, then push the additions commit to image-repo `master`。Do not push the blog branch。

---

### Task 8: 完成博客引用迁移和本地验证

**Files:**
- Generated modify: `_posts/*.md`
- Generated modify: `_draft/*.md`
- Generated modify: `_tabs/about.md` if its source adopted a full WebP
- Modify: `tools/image-pipeline/manifest.json`
- Create: `docs/image-pipeline.md`

**Interfaces:**
- Produces: blog commit that references only verified remote outputs or deliberately retained originals。

- [ ] **Step 1: Verify all new remote URLs**

For every manifest output used by the blog, request the unversioned jsDelivr URL and a fixed image-repo commit URL。Use GET with a byte range when HEAD is rejected。Expected: HTTP 200, `Content-Type: image/webp`, and content length equals the committed file。

- [ ] **Step 2: Rescan migrated sources**

Run `audit` again against the modified blog。It reuses the committed manifest mappings and does not add entries whose `sourcePath` is under `img/optimized/` or `img/thumbnails/`。Expected:

- every published cover has `image.thumbnail`;
- adopted sources have zero references;
- retained SVG/WebP/AVIF/GIF or non-smaller sources still resolve;
- no optimized path is missing from the image repo commit。

- [ ] **Step 3: Write the maintenance runbook**

Create `docs/image-pipeline.md` with exact Windows commands for `audit`, `apply`, `prune`, required clean-worktree conditions, output naming, backup branches, jsDelivr cache behavior and rollback。Before saving, invoke `humanizer-zh`。

- [ ] **Step 4: Build and inspect generated HTML**

Run:

```powershell
npm run test:images
bundle exec jekyll build
rg -n "img/thumbnails/.+\.webp" _site/index.html
rg -n "coffee\.webp|fetchpriority=high|rel=preload" _site/index.html
```

Expected: all tests and build PASS; homepage uses thumbnails; preload and high priority markup exist; article pages use full optimized URLs。

- [ ] **Step 5: Browser performance check**

Serve `_site` locally and use a clean Chromium profile。Record requests after hard reload at 1920×1080 and 390×844。Expected:

- coffee WebP is requested from the document preload before body parsing finishes;
- coffee image is visible without an empty image box;
- hidden cake does not make an eager high-priority request;
- homepage card image transfer is materially below the 11.6 MiB baseline;
- no broken images, layout overflow or lost GIF animation。

- [ ] **Step 6: Commit blog migration**

```bash
git add _posts _draft _tabs _layouts _includes assets/img/coffee.webp tools/image-pipeline docs/image-pipeline.md package.json package-lock.json .gitignore
git commit -m "perf: migrate blog images to optimized variants"
```

Review `git diff HEAD~1 -- _posts _draft _tabs` and confirm changes are limited to image URLs and `image.thumbnail` fields。

---

### Task 9: 审查、部署检查点和线上验证

**Files:**
- No new source files unless verified review findings require a scoped fix。

**Interfaces:**
- Produces: reviewed blog branch ready for an explicit merge/push decision。

- [ ] **Step 1: Request code review**

Invoke `superpowers:requesting-code-review`。Reviewer checks URL rewriting, path traversal protection, prune guard, GIF timing validation, image clarity, preload markup and two-repo ordering。Address only verified findings and rerun affected tests。

- [ ] **Step 2: Final local verification**

Invoke `superpowers:verification-before-completion` and run:

```powershell
npm run test:images
npm test
bundle exec jekyll build
bundle exec htmlproofer _site --disable-external
git status --short
```

Expected: all commands PASS; only intentional branch commits remain。

- [ ] **Step 3: Sync docs before GitHub operations**

Invoke `neat-freak`。Reconcile the design, this plan, `docs/image-pipeline.md`, existing Astro image plan and actual manifest。Do not add history narration to root instructions。

- [ ] **Step 4: User checkpoint before blog push**

Present local before/after metrics, visual samples, commits and rollback commands。Do not merge, push or deploy until the user explicitly confirms。

- [ ] **Step 5: After confirmation, finish the branch**

Invoke `superpowers:finishing-a-development-branch`。Use the user-selected merge/push path。Watch the Pages workflow, then test `https://hatrix.site/` with a clean browser and hard refresh。

Expected: deployed HTML references existing optimized files; coffee preload works; homepage transfer reduction matches local measurement。

---

### Task 10: 线上稳定后删除已迁移原图

**Files:**
- Delete in image worktree: manifest-approved source images only
- Modify in blog worktree after remote verification: `tools/image-pipeline/manifest.json`
- Modify in blog worktree: `docs/image-pipeline.md` only if observed behavior differs from the runbook

**Interfaces:**
- Produces: image-repo prune commit and final audit with no broken blog references。

- [ ] **Step 1: Obtain explicit prune confirmation**

Show the exact delete count and MiB, the deployed blog commit, image additions commit, and backup branch SHA。Do not infer confirmation from the earlier design approval。

- [ ] **Step 2: 生成 dry-run 报告**

```powershell
npm run images -- prune `
  --blog-root E:\CollegeData\hatrixxxx.github.io-image-optimization `
  --image-root E:\CollegeData\Hatrix-s-Blog-Image-optimization `
  --report reports/image-pipeline-final.json
```

Expected: report contains the exact sorted paths, per-file bytes, total bytes, `mode: dry-run` and `status: planned`; no file is deleted。

- [ ] **Step 3: 确认报告后执行 prune**

After explicit confirmation, rerun the same command with `--confirm-prune`。Before the first unlink, the command validates schema v3, the full `publishedImageCommit`, every adopted output in that commit, and every candidate path/size。Expected: only adopted, zero-reference source files are deleted; the report ends with `status: completed` and the exact deleted paths。

- [ ] **Step 4: Verify before commit**

Run the audit against deployed-source content and the pruned image tree。Request every referenced image through GitHub raw and jsDelivr。Expected: zero missing references; delete set exactly matches manifest approval。

- [ ] **Step 5: Commit and push prune**

```bash
git add -A img
git commit -m "perf: remove superseded source images"
```

Verify the backup branch still points to the pre-optimization commit。After the user-authorized push, verify remote `master`, total image MiB and all live URLs。Then update the manifest prune status in the blog worktree as a separate documentation change; do not stage a blog path from the image worktree。

- [ ] **Step 6: Final report**

Report coffee bytes, homepage cold-load image bytes, full-image source/output MiB, deleted MiB, retained formats, image-repo commits, blog commit, backup branch and rollback instructions。
