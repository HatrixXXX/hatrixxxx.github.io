# 文档入口

[项目 README](../README.md) 说明当前内容格式、开发命令、验证和部署方式；[AGENTS.md](../AGENTS.md) 记录协作规则与实现约束。[Cloudflare 运维说明](operations/cloudflare.md) 单独维护 DNS、TLS、响应头及回退步骤。

`superpowers/specs/` 和 `superpowers/plans/` 保存按日期编写的设计与实施记录。阅读旧文档时，以根目录 README 和 AGENTS.md 的现行规则为准；历史代码片段、迁移数量和当次测试结果不代表当前实现，也不应直接重跑。

## 内容发布规则变更

2026-09-25 已移除草稿目录、`draft` 字段及其发布过滤逻辑。`.private-content/posts/` 中所有通过校验的文章都生成页面，公开 URL 继续由 `legacySlug` 决定。加锁功能保留：`locked` 默认为 `false`，设置为 `true` 时只公开元数据、封面和解锁外壳，正文及正文图片输出密文；加锁文章不进入公开搜索索引。

本次内容更新后共有 41 篇文章、277 个去重后的远程图片 URL，完整构建生成 69 个 HTML 页面，站内链接检查数量为 4468。后续基线以 README、inventory 测试和构建检查器为准。

旧文档中的 `src/drafts/`、`draft`、40 篇文章和 254 个图片 URL 均为历史状态。实施计划保留这些记录，避免把后续结果写成当时的验收证据。加锁与搜索的现行行为可参见已同步的[加锁内容设计](superpowers/specs/2026-09-03-protected-content-design.md)和[搜索设计](superpowers/specs/2026-09-06-search-content-highlight-design.md)。
