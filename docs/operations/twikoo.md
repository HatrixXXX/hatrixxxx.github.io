# Twikoo 后端部署与回退

本站仍由 GitHub Pages 提供静态文件。Twikoo 评论单独运行在 Cloudflare Worker，数据保存在 D1，前端的 `envId` 为 `https://comments.hatrix.site`。博客文章继续用原有 `/posts/<legacySlug>/` 路径，留言板用 `/guestbook/`；旧 GitHub Discussions 留言不迁移，也不删除。

本页依据 [Twikoo 2.0 Cloudflare 部署说明](https://twikoo.js.org/backend.html#cloudflare-workers-部署)、[2.0.13 适配器 README](https://github.com/twikoojs/twikoo/blob/2.0.13/packages/server-cloudflare/README.md) 和 [Cloudflare Workers 自定义域名文档](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) 编写。执行前核对这些页面及 `docs/operations/cloudflare.md` 的当前配置。网站本身继续使用 Node 24；下面的 Node 26 只用于独立的 Twikoo 源码构建。

## 当前状态

- 2026-10-13 已创建 D1 `hatrix-twikoo`、部署同名 Worker，并绑定 `comments.hatrix.site`。根路径返回 Twikoo 2.0.13 正常运行提示，`GET_FUNC_VERSION` 返回 `code: 0`。CORS 只允许生产站点和 Twikoo 内置的本地预览来源；无关来源不返回允许跨域的响应头。
- D1 配置中的 `DISPLAYED_FIELDS` 和 `REQUIRED_FIELDS` 均为 `nick`；`SHOW_EMOTION`、`SHOW_ORDER`、`SHOW_UA`、`SHOW_REGION` 均为 `false`；`BLOGGER_NICK` 为 `Hatrix`，`BLOGGER_EMAIL` 为站点公开的作者邮箱。更改配置时保留同一 JSON 中的管理员密码与 CORS 设置，不要整行覆盖。Twikoo 在浏览器本地保存上次填写的昵称。邮箱隐藏后，普通访客不提供邮件通知或邮箱头像；只有登录管理员并使用作者邮箱发表的留言会被标记为站长，本站才显示站长头像。
- 已在网站未使用的临时路径完成真实留言发表和读取，再按留言 ID 与路径删除；当时 D1 清零。此后 `/guestbook/` 已有真实留言，不要按初始空库状态清理。站长已在评论区管理入口私下设置管理员密码；复查时管理入口只显示密码登录，不再允许首次注册。
- 网站前端改动仍在本地工作区，线上 `hatrix.site` 暂时显示 Giscus。按站长选择，等其他会话的未提交改动完成后再发布 Twikoo 前端；不要把当前共享工作区的全部改动直接推送。
- Twikoo 版本固定为 `2.0.13`，对应官方 Git 标签的 commit `96303abd929348959fa4941dae7f6b3f4a77dca9`。升级时前后端一起检查和更新。

## 构建与部署

在网站仓库之外建立私有工作目录。以下命令面向 PowerShell；不要把 `wrangler.toml`、D1 标识、管理员密码或数据库导出文件放进网站仓库。`npx` 调用的 Wrangler 版本在部署时记录下来，以便后续复现。

```powershell
git clone --depth 1 --branch 2.0.13 https://github.com/twikoojs/twikoo.git twikoo-2.0.13
cd twikoo-2.0.13
git rev-parse HEAD
npx --yes --package=node@26 --package=pnpm@12.5.1 -c "node -v & pnpm -v"
npx --yes --package=node@26 --package=pnpm@12.5.1 -c "pnpm install --frozen-lockfile --ignore-scripts"
npx --yes node@26 scripts/release-set-version.mjs 2.0.13
npx --yes --package=node@26 --package=pnpm@12.5.1 -c "pnpm install --frozen-lockfile --ignore-scripts"
npx --yes --package=node@26 --package=pnpm@12.5.1 -c "pnpm -r --filter @twikoojs/cloudflare... build"
cd packages/server-cloudflare
npx wrangler --version
npx wrangler whoami
```

`git rev-parse HEAD` 应输出上面的 commit，版本命令应输出 Node 26 和 pnpm 12.5.1。Git 标签里的包版本仍是 `0.0.0`；`release-set-version.mjs` 是 Twikoo 发布流水线使用的脚本，必须先把版本注入为 `2.0.13`。第二次安装只同步变更后的 workspace 依赖。`--ignore-scripts` 避免仓库中的 `mongodb-memory-server` 测试依赖下载约 780 MB 的 MongoDB；2026-10-13 已在独立临时目录用此方式完成适配器及其 workspace 依赖的构建，确认 `packages/shared/dist/index.mjs` 含版本 `2.0.13`，`packages/server-cloudflare/dist/index.js` 存在。若 `whoami` 尚未登录，由账号持有人运行 `npx wrangler login`。登录后，先检查有无同名数据库，再创建：

```powershell
npx wrangler d1 list
npx wrangler d1 create hatrix-twikoo
```

在当前 `packages/server-cloudflare` 目录创建未纳入网站仓库的 `wrangler.toml`，把命令返回的真实 `database_id` 填入占位处：

```toml
name = "hatrix-twikoo"
main = "dist/index.js"
compatibility_date = "2026-09-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "hatrix-twikoo"
database_id = "<刚创建的 D1 ID>"
```

适配器要求 `main = "dist/index.js"` 和 `nodejs_compat`。不要部署未构建的 `src/`。D1 可以在首次请求时自动建表；这里显式执行官方 schema，便于检查数据库初始化是否成功：

```powershell
npx wrangler d1 execute hatrix-twikoo --remote --file=./schema.sql
npx wrangler deploy --dry-run
npx wrangler deploy
```

`--dry-run` 应显示 `env.DB` 绑定，且以 `--dry-run: exiting now` 结束；2026-10-13 用 Wrangler 4.149.0 检查，压缩体积约 1.4 MiB。首次部署的 `*.workers.dev` 地址在本机网络中 TLS 握手失败，绑定自定义域名后改用 `https://comments.hatrix.site/` 验证。根路径返回“Twikoo 云函数运行正常”只证明 Worker 已启动，还要检查下方的业务事件与跨域响应。

## 绑定 `comments.hatrix.site`

先在 Cloudflare DNS 中核对 `comments` 没有冲突的记录。Cloudflare 的 Worker Custom Domain 会自动创建该主机名所需 DNS 记录与证书，不要手工把 `comments` 指向 GitHub Pages，也不要修改现有 `@`、`www`、NS、DNSSEC 或 `public/CNAME`。

在同一 `wrangler.toml` 末尾加入：

```toml
[[routes]]
pattern = "comments.hatrix.site"
custom_domain = true
```

运行 `npx wrangler deploy`，等 Cloudflare 显示自定义域名已激活、证书可用，再检查 `https://comments.hatrix.site/`。本站有覆盖子域名的 HSTS 规则；该地址必须始终能通过 HTTPS 访问。还要检查 Cloudflare 的安全响应头规则是否作用在新子域名上，不要为评论服务放宽全站的 DNSSEC、TLS 或资源 CSP。

## 验收与管理员初始化

以下命令都只读取后端状态，不会发表留言：

```powershell
curl.exe -sS -i https://comments.hatrix.site/
curl.exe -sS -i -X OPTIONS https://comments.hatrix.site/ -H "Origin: https://hatrix.site" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
$body = @{ event = 'GET_FUNC_VERSION' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'https://comments.hatrix.site/' -Method Post -ContentType 'application/json' -Headers @{ Origin = 'https://hatrix.site' } -Body $body
```

预期：根路径返回正常运行提示；预检为 HTTP 204，`Access-Control-Allow-Origin` 等于 `https://hatrix.site`，允许 `POST`；`GET_FUNC_VERSION` 返回 `code: 0` 和 `version: 2.0.13`。后两项也能发现 D1 绑定或 schema 故障。注意跨域响应只有请求带 `Origin` 时才出现。

然后打开网站的 `/guestbook/`：

1. 在评论窗口的小齿轮入口首次设置强管理员密码。密码只在私有密码管理器保存，不写入仓库、命令行记录或截图。Twikoo 的 [非腾讯云管理面板说明](https://twikoo.js.org/frontend.html#开启管理面板-非腾讯云环境) 以此入口初始化密码。
2. 在管理面板的“配置管理 → 通用”核对 `CORS_ALLOW_ORIGIN` 为 `https://hatrix.site`。本次已在空 D1 的配置行写入该值，并通过预检验证；`localhost` 和 `127.0.0.1` 仍按 Twikoo 内置规则允许本地预览。日后修改时，再用生产 Origin 和无关 Origin 各做一次预检。
3. 发表一条可辨认的测试留言，刷新后确认它仍在 `/guestbook/`；再检查一篇文章有独立的评论路径。用普通访客会话检验发表、管理面板检验删除测试留言。不要在未确认前清理 D1。

Cloudflare 适配器目前不能直连 SMTP；需要通知时在 Twikoo 管理面板使用 SendGrid、MailChannels 或 Resend 的 HTTP 通道。图片上传需要另配 S3 兼容图床，初次上线不依赖它们。详见 [适配器能力说明](https://github.com/twikoojs/twikoo/blob/2.0.13/packages/server-cloudflare/README.md)。

本机经代理访问 `*.workers.dev` 时 TLS 握手失败；`curl.exe` 经代理访问自定义域名也报告 Windows Schannel 错误。实际用浏览器核对健康接口，并在 Node 24 下启用 `NODE_USE_ENV_PROXY=1` 完成版本、CORS 和业务请求验证。不要把本机代理错误当成 Worker 故障。

## 备份与回退

上线后定期将 D1 导出到私有位置，尤其在升级 Worker 前：

```powershell
npx wrangler d1 export hatrix-twikoo --remote --output=./twikoo-backup.sql
```

导出文件含留言内容和访客信息，不要提交或分享。Worker 代码升级出错时，从同一部署目录运行 `npx wrangler rollback`，再核对自定义域名健康检查、业务事件和评论读写。Cloudflare 的回退只切换 Worker 版本，**不会回滚 D1 数据**；若数据库结构已变化，先检查旧代码与现有 D1 的兼容性。不要直接删除 Worker、D1 或自定义域名。若需暂时停用评论，先回退网站前端发布，再处理 Worker；GitHub Discussions 中的旧留言仍保留。

参考：[Cloudflare Worker 回退](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)、[D1 导出命令](https://developers.cloudflare.com/d1/wrangler-commands/#d1-export)。
