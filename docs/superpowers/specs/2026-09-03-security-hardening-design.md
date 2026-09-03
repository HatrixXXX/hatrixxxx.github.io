# GitHub Pages 仓库安全加固设计

## 目标

第一阶段保留 DNSPod、GitHub Pages、自定义域名和纯静态输出，只修改仓库。加固范围包括浏览器安全策略、内容输入边界、构建产物检查和发布供应链。页面布局、主题切换、客户端路由、搜索、Giscus、Mermaid、灯箱、Sakana、音乐播放器和旧文章 URL 必须保持现状。

第二阶段再接入 Cloudflare。两个阶段分开实施和验收，DNS 切换不会与代码变化同时发生。

## 当前边界

`hatrix.site` 目前直接解析到 GitHub Pages。HTTP 会跳转到 HTTPS，TLS 1.0 和 1.1 已禁用，线上没有发现公开的 `.env`、`.git/config` 或错误堆栈。站点没有服务端 API、数据库、登录 Cookie、上传和支付入口，因此不需要为 SQL 注入、CSRF 或服务端命令执行增加无效代码。

仓库已有以下基础：

- Astro 采用纯静态输出，模板变量默认转义。
- 搜索结果使用 DOM API 和 `textContent`，没有把查询内容写入 `innerHTML`。
- 图床 URL 固定到不可变 Git commit，构建会预检图片。
- 外链新窗口带 `noreferrer`。
- Actions 默认只有 `contents: read`，Pages 写权限只在部署 job 中出现。
- lockfile 固定依赖解析结果，Dependabot 每周检查 npm 和 Actions 更新。

GitHub Pages 不提供仓库级任意响应头配置。第一阶段可以用 HTML CSP 和 Referrer Policy 约束浏览器，但 HSTS、`X-Content-Type-Options`、CSP Report-Only、`frame-ancestors`、WAF、限流和可控 DDoS 防护留到 Cloudflare 阶段。

## 工作区隔离

安全加固从开始执行时的 `master` 创建 `feat/security-hardening` 分支，并放在独立 Git worktree。根工作树中其他会话的未跟踪文件和修改不进入该分支。

`feat/protected-content` 会修改 `package.json`、`pnpm-lock.yaml`、内容 schema，并可能在后续任务中修改布局和部署流程。安全分支完成后先同步最新 `master`，再处理交叉修改。每次提交只暂存本任务列出的文件，不使用覆盖工作树的 Git 操作。

## 浏览器策略

生产页面在第一个脚本之前输出 CSP：

```text
default-src 'self';
base-uri 'none';
object-src 'none';
script-src 'self' 'unsafe-inline' data: https://giscus.app;
script-src-attr 'none';
style-src 'self' 'unsafe-inline' https://giscus.app;
img-src 'self' data: blob: https://cdn.jsdelivr.net;
font-src 'self' data:;
connect-src 'self';
media-src 'self' data: blob:;
frame-src https://giscus.app;
worker-src 'self' blob:;
manifest-src 'self';
form-action 'self'
```

第一阶段保留 `script-src 'unsafe-inline'`，原因是当前构建包含主题初始化和 Giscus 内联模块，直接改成哈希策略会与 Astro ClientRouter、构建压缩和正在开发的加锁内容脚本相互影响。生产取证还确认 ClientRouter 在客户端导航时加载 `data:` 模块，Sakana 使用内嵌 `data:` 音频，Giscus 客户端会加载同源于 `giscus.app` 的样式；策略只为这三项现有行为增加对应来源。`script-src-attr 'none'` 单独禁止 HTML 事件属性。内容检查同时拒绝原始 `<script>`，缩小 `unsafe-inline` 留下的风险。

样式仍允许内联，并允许 Giscus 客户端加载 `https://giscus.app/default.css`。Astro 页面样式、Hero 背景、Mermaid 和现有交互会生成 `<style>` 或 `style` 属性；为了去掉 `unsafe-inline` 而重写这些功能不在本阶段范围内。

CSP 只在生产构建输出。开发服务器需要 Vite HMR 和 WebSocket，不加载生产策略。所有页面同时输出：

```html
<meta name="referrer" content="strict-origin-when-cross-origin">
```

不在 HTML CSP 中写入 `frame-ancestors`，浏览器会忽略通过 `<meta>` 传入的该指令。点击劫持防护由第二阶段的响应头提供。第一阶段也不添加 COOP、COEP 或 CORP，它们会改变跨源隔离行为，可能破坏 Giscus 和远程图片。

## 内容输入边界

构建使用 AST 检查已发布 Markdown，不扫描代码块里的示例文本，也不改写文章正文。

原始 HTML 统一交给 parse5 解析，并显式设置 `scriptingEnabled: false`。这样 `<noscript>` 内的标签仍会进入语法树，不会被当成普通文本绕过检查。站点 origin、基于页面地址的 URL 解析、浏览器会执行的 `javascript:`/`vbscript:`、危险 `data:` MIME 和固定图床规则集中在 `src/lib/safe-url.ts`，Markdown 检查器与构建产物检查器使用同一套判定。

原始 HTML 拒绝以下内容：

- `script`、`iframe`、`object`、`embed`、`base`、`meta`、`link`、`style` 和表单控件；
- 名称以 `on` 开头的事件属性；
- `srcdoc`、`formaction`、危险 `data:` 文档以及 `javascript:`、`vbscript:` URL；
- 可执行 SVG/MathML 原始片段。

现有文章需要的普通排版标签和 `<img>` 可以继续使用。远程图片必须符合站点现有的 HTTPS、jsDelivr、仓库和完整 commit 前缀规则；草稿仍不参与发布 inventory。

作品链接只允许 HTTPS。若以后需要站内作品链接，单独允许以 `/` 开头的相对路径，不把任意 URL schema 当作合法链接。

Mermaid 初始化显式设置 `securityLevel: 'strict'`，不依赖上游默认值。搜索继续使用当前 DOM 构造方式。Giscus 的 `client.js` 是已接受的第三方运行时代码边界：保留匿名 CORS 和加载失败降级，不给会随上游更新失效的可变 URL 硬塞 SRI。

## 构建产物门禁

`check:site` 扩展以下检查：

- 每个 HTML 文件恰好有一份生产 CSP 和 Referrer Policy；
- CSP 位于所有脚本之前；
- 页面没有事件属性、`javascript:`、`vbscript:`、危险 `data:` 文档或未知外部可执行资源；
- `target="_blank"` 链接具备阻断 opener 的 `rel`；
- 外部脚本只允许 Giscus，远程图片只允许已批准的 jsDelivr 前缀；
- 现有 40 条旧文章路由、CNAME、第三方声明、站内链接总量和发布体积检查继续执行。

产物检查同样以 `scriptingEnabled: false` 和源码位置信息解析 HTML。遍历时记录 `<noscript>` 祖先，拒绝其中的脚本、样式、元数据、外部资源标签、表单控件和 SVG/MathML；纯文本降级提示可以保留。`srcset` 与 `imagesrcset` 使用严格解析，每个候选地址再交给共享 URL 判定，无法解析时按失败处理。

检查器报告文件、路由和违规值，不输出文章私密正文、管理员 key 或加密材料。加锁内容功能合入后，同一门禁必须覆盖公开外壳和解锁脚本。

## GitHub Actions 与工具链

所有 `uses:` 引用改为完整 40 位 commit SHA，并在同行注释保留对应版本，便于 Dependabot 更新和人工核对。Checkout 关闭凭据持久化，build 与 deploy job 设置超时。

手动部署只能从 `refs/heads/master` 运行。普通 push 仍只部署 `master`，pull request 只构建、不上传 Pages artifact。加锁内容功能若增加 `repository_dispatch`，整合时为该事件保留明确条件，不把手动任意 ref 发布重新放开。

`package.json` 添加精确 `packageManager`，Corepack 和 CI 使用同一 pnpm 版本。安装继续使用 `--frozen-lockfile`。生产依赖审计在 CI 中以 high 级别作为门禁；审计不进入浏览器包，不影响页面运行性能。

## 测试与验收

实现遵循测试先行：先写会因缺少策略或允许危险输入而失败的单元测试，确认失败原因，再增加最小实现。

自动验证包括：

- 内容检查器的安全与恶意样例；
- CSP、Referrer Policy、外部资源和新窗口链接的构建产物测试；
- Actions SHA、权限、部署 ref、checkout 凭据和 packageManager 测试；
- Mermaid 显式严格模式测试；
- 项目现有单元测试、Astro 类型检查、图片检查、生产构建和站点检查；
- 完整 Playwright 套件和 18 张 Windows 视觉基线。

生产预览另做浏览器验证，记录 `securitypolicyviolation`，并覆盖主题切换、搜索、客户端跳转、Giscus、Mermaid、灯箱和无 JavaScript 页面。视觉、交互或控制台出现回退时不更新基线掩盖问题，先修正策略或实现。

完成项目改动后启动普通本地预览并保持运行。

## 第二阶段入口

第一阶段通过全部门禁后再设计 Cloudflare 配置。第二阶段包括：

- 迁移权威 NS 前复制并核对全部 DNS 记录；
- 橙云代理网站记录，使用 Full (strict) TLS；
- 启用自动 DDoS 和低误伤 WAF，不默认启用全站验证码或全站限流；
- 通过响应头补齐 HSTS、`nosniff`、`frame-ancestors`、Permissions Policy 和强制 CSP；
- 保守配置缓存，发布后主动清理必要资源；
- 对比切换前后的中国大陆和海外访问结果，准备 NS 回退步骤。

Cloudflare 账户登录、注册商 NS 修改和 GitHub 域名验证不能由本仓库代替。涉及这些外部权限时再提供逐项操作值，不把 API token、账户 ID 或验证秘密提交进 Git。

## 不做的内容

- 不承诺仓库代码可以防御 DDoS 或替代 WAF。
- 不增加服务器、数据库、登录后端、上传或监控 SDK。
- 不重写文章正文，不用 sanitizer 静默删除内容。
- 不自托管 Giscus，不移除主题动效、ClientRouter、Sakana 或远程图片。
- 不为提高安全扫描评分盲目添加 COEP、COOP、CORP、HSTS preload 或激进限流。
- 不推送、部署或修改远端 Pages 设置，除非用户在对应阶段明确提供所需外部访问条件。
