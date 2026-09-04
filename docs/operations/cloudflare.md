# Cloudflare 运维说明

`hatrix.site` 使用 Cloudflare 作为权威 DNS 和网站代理，源站仍是 GitHub Pages。仓库部署只更新 GitHub Pages 内容，不会自动修改 Cloudflare 或注册商设置。

## 当前拓扑

| 名称 | 类型 | 目标 | Cloudflare 代理 |
| --- | --- | --- | --- |
| `@` | A | `185.199.108.153` | 开启 |
| `@` | A | `185.199.109.153` | 开启 |
| `www` | CNAME | `hatrixxxx.github.io` | 开启 |

权威 NS：

- `eugene.ns.cloudflare.com`
- `millie.ns.cloudflare.com`

对外查询得到的 A 和 AAAA 是 Cloudflare Anycast 地址，不应写回源站记录。`public/CNAME` 仍是 GitHub Pages 自定义域名的唯一仓库来源。

## 边缘配置

- SSL/TLS 模式：Full (strict)
- Always Use HTTPS：开启
- Minimum TLS Version：TLS 1.2
- TLS 1.3：开启
- Automatic HTTPS Rewrites：开启
- HSTS：`max-age=15552000; includeSubDomains`
- HSTS preload：关闭
- Browser Integrity Check：开启
- Cloudflare 自动 DDoS 防护：开启
- Bot Fight Mode、全站验证码、全站限流和自定义缓存规则：关闭

全站响应头规则名为 `Security response headers`，包含：

```text
Content-Security-Policy: frame-ancestors 'none'
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Permitted-Cross-Domain-Policies: none
```

完整的资源加载 CSP 由 `src/config/security.ts` 生成并写入 HTML。Cloudflare 只补充 `<meta>` CSP 无法生效的 `frame-ancestors`，不要在边缘复制整份资源 CSP，否则两处策略容易漂移。

DNSSEC 同时在 Cloudflare 和腾讯云域名注册商中启用。算法、摘要类型、Key Tag 和摘要可能因密钥轮换而变化；需要维护时以 Cloudflare 控制台当前显示的 DS Record 为准，不要从文档复制旧值。

## 公网验证

在 PowerShell 中运行：

```powershell
Resolve-DnsName hatrix.site -Type NS -Server 1.1.1.1 -DnsOnly
Resolve-DnsName hatrix.site -Type DS -Server 1.1.1.1 -DnsOnly
Resolve-DnsName hatrix.site -Type DNSKEY -Server 1.1.1.1 -DnsOnly
Resolve-DnsName hatrix.site -Type DS -Server 8.8.8.8 -DnsOnly
curl.exe -sS -I http://hatrix.site/
curl.exe -sS -I https://hatrix.site/
```

验收结果应满足：

- NS 是上面两台 Cloudflare 服务器；
- DS 和 DNSKEY 都存在，算法一致；
- HTTP 返回到 `https://hatrix.site/` 的 301；
- HTTPS 返回 200，响应中有 `Server: cloudflare`、HSTS 和六项安全响应头；
- 主页、文章、Giscus、Mermaid、灯箱、主题切换和加锁页面仍可使用。

## 发布与缓存

当前没有自定义缓存规则，HTML 通常返回 `cf-cache-status: DYNAMIC`。正常 Pages 发布不需要全站清缓存。若单个静态资源在部署后仍旧，先核对 GitHub Pages 已完成部署，再只清理受影响 URL；不要默认执行全站 Purge Everything。

## 变更和回退

修改 DNS 记录时先在 Cloudflare 完成并用公共解析器验证。不要把代理地址当成源站地址，也不要删除 `public/CNAME`。

如需停用 DNSSEC，先在注册商删除 DS，等待公共解析器不再返回 DS，再关闭 Cloudflare DNSSEC。反过来操作会让支持 DNSSEC 的解析器返回 `SERVFAIL`。迁移 NS 时，新服务商若不能承接 DNSSEC，也要先完成这一停用顺序。

如需离开 Cloudflare 或关闭 HTTPS，先关闭 HSTS，让边缘发送 `max-age=0`，并继续提供 HTTPS。考虑到现有六个月 `max-age`，不能在客户端策略过期前直接撤掉 HTTPS。HSTS preload 当前关闭，不需要提交预加载列表移除申请。

出现 `SERVFAIL` 时先比较注册商 DS 与 Cloudflare 当前 DS；出现 TLS 525、重定向循环或源站错误时，依次核对 Full (strict)、代理状态、GitHub Pages 自定义域名和 Pages 部署状态。不要同时修改 NS、DNSSEC、TLS 和缓存设置，否则无法判断故障来源。
