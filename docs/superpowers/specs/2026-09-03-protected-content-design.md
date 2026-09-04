# 加锁内容与管理员解锁设计

状态：以当前实现为准

## 目标和边界

网站继续使用 Astro 静态输出和 GitHub Pages。访客首次打开网站时是游客；加锁内容只有输入正确的管理员 key 后，才能在浏览器中解密。博客文章通过 frontmatter 的 `locked` 字段控制，配置在 `LOCKED_PAGE_PATHS` 中的普通页面也使用同一套解锁组件。

系统只保护构建产物里的明文，不提供账号或服务端访问控制。GitHub Pages 会公开托管密文、KDF 参数、固定盐、路由和文章公开元数据。攻击者可以下载密文离线猜测 key，前端冷却也可以被绕过。至少 8 个字符只是构建下限，不代表足够强；无法接受离线穷举的内容不能放到本站。

## 仓库和本机目录

公开仓库保存 Astro 代码、测试、构建脚本、封面和其他公开资源。已发布文章只保存在目标私有仓库 `HatrixXXX/hatrix-content`，本地和 CI 都检出到公开仓库根目录的 `.private-content/`。`assets/` 是按需创建的正文图片目录：

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

`.private-content/` 是独立 Git 仓库，公开仓库整体忽略该目录。Astro 的 posts collection 从 `.private-content/posts/` 读取；作品仍来自 `src/content/projects/`。迁移阶段建立的本地仓库含 40 篇文章和通知 workflow，但没有代用户创建远端、remote 或 GitHub Secrets，这些项目需要在 GitHub 上另行配置。

公开 Git 历史仍能找到迁移前的旧文章，迁移只能避免新的加锁正文继续进入公开历史。不得把 `.private-content` 中的文章、正文图片或其他私密资源复制回公开仓库。

`LOCKED_PAGE_PATHS` 当前为空。以后把普通页面路径加入该数组时，`BaseLayout` 会加密页面 slot，但公开 `.astro` 源文件仍可从 Git 读取；需要保密的文字不能直接写在公开源码中。当前实现没有通用的 `.private-content/pages/` loader。

## 文章状态

`locked` 和 `draft` 都可以省略，省略时按 `false` 处理。两者组合如下：

| `draft` | `locked` | 构建结果 |
| --- | --- | --- |
| `false` | `false` | 发布公开页面，正文是普通静态 HTML |
| `false` | `true` | 发布公开 Hero 和解锁外壳，正文与正文图片只输出密文 |
| `true` | `false` | 不生成页面 |
| `true` | `true` | 不生成页面，也不生成密文资源 |

加锁文章仍公开标题、摘要、发布日期、类型、阅读时间、稳定 URL 和封面。文章卡片、归档、页脚、相邻文章和搜索结果显示锁标记。封面永远公开，可以继续使用符合图床固定提交规则的远程 URL。

加锁正文里的图片必须用 Markdown 相对路径，且解析后的真实文件必须留在 `.private-content/posts/` 内。例如 `![示意图](./assets/private-image.png)`。远程 URL、data URL、站点根绝对路径、越出 posts 目录的路径、原始 HTML `<img>`、不存在的文件和不支持的图片格式都会让构建失败。公开文章不受这条加锁图片规则影响，仍按现有 jsDelivr inventory 和不可变 commit 规则处理远程正文图片。

## 本机 key

管理员 key 写在公开站点工作区根目录的 `.env.local`：

```dotenv
HATRIX_ADMIN_KEY=<至少八字符的本机值>
```

`.env.local` 已被公开仓库忽略。该值不得提交、复制到文章或文档、发到聊天中，也不得与私有内容仓库一起分享。本地值应与公开仓库的同名 GitHub Actions Secret 一致，否则本机和线上构建出的密文需要不同 key。

## 实际加密流程

当前实现没有 post-build HTML 提取阶段，也没有随机 DEK 和 key envelope。加密发生在 Astro 服务端渲染期间：

1. `src/pages/posts/[slug].astro` 对加锁文章调用 `renderProtectedMarkdown()`。Markdown 图片先换成透明占位和不含原文件名的加密资源地址。
2. `PostLayout` 保留公开 Hero，把正文网格交给 `ProtectedContent.astro`。
3. `ProtectedContent.astro` 通过 `Astro.slots.render('default')` 得到完整 HTML，读取 `HATRIX_ADMIN_KEY`，用固定盐的 Argon2id 派生 256 位 key，再以 AES-256-GCM 加密该 HTML。
4. 页面只输出解锁表单、内联 JSON 密文信封和空挂载点。页面信封的 AAD 是规范化后的 `page:<route>`。
5. `src/pages/protected-content/assets/[id].bin.ts` 为已发布的加锁文章生成静态资源端点。资源 ID 是派生 key 对私有仓库相对路径和文件内容摘要的 HMAC-SHA-256；同一路径下的图片发生变化时，URL 和 `asset:<id>` AAD 都会随之变化，旧缓存不会冒充新资源。
6. `/protected-content/manifest.json` 公开格式版本、固定 128 位盐、Argon2id 参数、七天时长、加锁路由和认证密文。认证密文使用 `verifier:1` AAD。

Argon2id 当前参数为 19 MiB 内存、2 次迭代、单路并行，输出 32 字节。每份 AES-GCM 信封使用独立的 96 位随机 IV，信封只包含格式版本、IV 和密文。相同 key、盐和参数会派生相同的 AES key，但每次构建的页面和资源密文仍会因随机 IV 改变。

`pnpm build` 依次运行远程图片预检、`astro build` 和 `check:protected`。保护审计会扫描 `dist/`，查找加锁 Markdown 的明文片段、原始正文图片字节、原文件名、缺失的 `noindex, nofollow` 和 sitemap 泄漏。审计报错只打印文件和规则，不回显正文。

## 浏览器解锁和凭据

访客直达加锁 URL、点击普通链接进入或进行 Astro 客户端换页，最终都会加载同一个目标页面外壳。无 JavaScript 时只能看到解锁表单和密文。

提交 key 后，浏览器先加载 manifest，按 manifest 参数运行 Argon2id，并用认证密文验证派生 key。验证成功后，它解密当前页面 HTML，再请求和解密正文图片。所有图片完成后才一次性挂载正文，并发送 `hatrix:protected-content-ready`；目录、Mermaid、灯箱和 Giscus 据此初始化。图片只以 Blob URL 存在，换页和退出时会撤销。

浏览器不保存输入的原始 key。它把不可导出的、只有 `decrypt` 用途的 AES `CryptoKey` 存在 IndexedDB 的 `hatrix-protected-content/credentials` 中：

- 未勾选“7 天免解锁”时，`sessionStorage` 保存一个不含 key 的引用。关闭该浏览器会话后失效。
- 勾选后，`localStorage` 保存带到期时间的引用。同一浏览器资料最多复用七天。

凭据不会跨浏览器资料、设备或无痕窗口同步。清除站点数据会删除它。浏览器扩展、设备恶意软件、已解锁页面中的脚本或能操作当前浏览器资料的人，仍可能读取已经挂载的正文；`CryptoKey` 的不可导出属性不能解决这些威胁。

页头的“退出管理员身份”会清除 session 和七天引用、IndexedDB 中的凭据、当前 Blob URL，并把当前加锁页恢复为解锁外壳。退出作用于这个站点的管理员状态，不只作用于当前文章。

## 错误和冷却

解锁表单通过 `aria-live` 显示以下状态：

- 空输入：`请输入管理员 key`
- 计算或加载中：`正在验证…`
- key 验证失败：`Key 不正确，请重试`
- manifest、页面或资源结构无效，或正文/资源认证失败：`加密内容无法读取，请稍后再试`
- manifest 或资源请求失败：`加密内容加载失败，请检查网络后重试`

格式正确但无法通过认证的 verifier 与错误 key 在客户端无法可靠区分，当前实现把它按错误 key 处理并计入冷却。已保存的 CryptoKey 如果无法通过新 manifest 的 verifier，会被删除并恢复游客状态。

错误 key 的失败状态保存在 `localStorage`，刷新和跨加锁页面不会清除。第 1、2 次没有额外等待；第 3 次等待 5 秒，第 4 次 15 秒，第 5 次 60 秒，此后每次 5 分钟。倒计时期间输入框、显示 key、七天选项和提交按钮全部禁用。成功解锁会清除失败计数。这只是正常 UI 的节流，不妨碍修改脚本或离线尝试。

## key 变更和重新构建

普通内容更新只要保留管理员 key、固定盐、Argon2id 参数和格式版本，已有浏览器 CryptoKey 就能验证新 manifest；重新构建产生的新随机 IV 不会让凭据失效。

更换管理员 key 时，要同时更新本机 `.env.local` 和公开仓库的 `HATRIX_ADMIN_KEY` Secret，然后手动运行公开仓库 Pages workflow 或推送公开代码，生成一套新的页面、verifier 和资源密文。旧浏览器 CryptoKey 在下一次加载 manifest 时验证失败并被清除，旧 key 无法解密新产物。

静态发布无法撤回别人已经下载或缓存的旧密文。知道旧 key 的人仍可能解密旧副本，因此换 key 只保护换 key 后重新构建的产物，不能追溯性吊销历史内容。

## 自动部署和权限

目标私有远端是 `HatrixXXX/hatrix-content`，默认分支为 `master`。三个 Secret 分开放置：

| Secret | 存放位置 | 最小用途和权限 |
| --- | --- | --- |
| `HATRIX_ADMIN_KEY` | 公开站点仓库 Actions Secrets | 构建时派生加密 key；不是 GitHub token，至少 8 个字符 |
| `HATRIX_CONTENT_TOKEN` | 公开站点仓库 Actions Secrets | 只读取 `HatrixXXX/hatrix-content`；fine-grained token 仅授权该仓库的 Contents read |
| `HATRIX_SITE_DISPATCH_TOKEN` | 私有内容仓库 Actions Secrets | 只向 `HatrixXXX/hatrixxxx.github.io` 创建 `repository_dispatch`；fine-grained token 仅授权该仓库的 Contents read/write |

私有仓库 `master` push 后，`notify-site.yml` 发送 `content-updated`，payload 是触发该 workflow 的完整 `github.sha`。公开 workflow 先校验它是 40 位十六进制 SHA，再把私有仓库的这个精确提交检出到 `.private-content/`，并比较实际 `git rev-parse HEAD` 与 payload。两者不一致就停止。构建和检查通过后才部署；失败不会替换现有 Pages 版本。

公开仓库 `master` push 或手动运行 workflow 时，私有 checkout 不指定 ref，因此读取私有仓库默认分支当时的 HEAD，并记录实际检出的完整 SHA。生产 workflow 不缓存 `.astro/`，构建结束后也会在上传 `dist/` 前删除它，因为其中可能含有私有正文、渲染 HTML 和源路径。公开仓库 pull request 不读取三个正式 Secret，也不访问私有仓库；它使用 `tests/fixtures/private-content` 和固定测试 key 运行单元测试、Astro check 与 build，且不部署。

## 索引和公开面

加锁页面保留 canonical URL，并输出 `noindex, nofollow`；sitemap 排除这些 URL。搜索索引只保留标题和摘要等公开 metadata，不读取加锁正文。RSS 也只发布公开摘要。锁图标只用于提示状态；保护审计以构建产物中没有正文明文和原资源为准。

## 排障

远程图片预检与保护审计是两条不同的检查链：

- `pnpm check:images` 处理 jsDelivr inventory 和网络可用性，报告在忽略提交的 `reports/image-check.json`。如果只是远程图片偶发失败，先看报告并重跑；恢复后删除忽略目录 `.astro/`，执行 `pnpm exec astro sync`，再运行构建或视觉测试。不要更新 inventory 或视觉基线掩盖网络故障。
- `pnpm check:protected` 检查已经存在的 `dist/`。加锁正文远程图片通常会更早在 Astro 渲染时失败；保护审计还会报告明文、原始图片字节或文件名、索引和 sitemap 泄漏。应修正文引用或加密边界，不得放宽检查、替换期望密文或把泄漏结果写成新基线。

正式构建还会因缺少私有内容目录、`HATRIX_ADMIN_KEY` 未配置或少于 8 个字符、内容 schema 错误和私有 token 无权读取目标仓库而失败。排障时只确认 Secret 是否存在以及权限范围，不打印 Secret 值。
