# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

访问者来阅读技术笔记、查找问题记录、了解作品和作者，也可以在留言板留下评论。正常浏览不要求了解主题故事或扮演角色。

作者在本地维护文章与站点。文章正文保存在独立的私有内容仓库中，公开仓库维护页面、组件和构建代码。

## Product Purpose

Hatrix 是 `https://hatrix.site` 的个人站点，用来保存技术实践、踩坑过程和生活记录，并展示真实作品。阅读、查找和继续访问文章是内容页的主要任务。

## Operating Context

站点使用 Astro 生成静态页面，运行环境固定为 Node 24，包管理器为 Corepack 管理的 pnpm。源站为 GitHub Pages，域名由 Cloudflare 提供 DNS 和代理。

读者从首页入口进入博客中心，再按全部文章或文章类型浏览，也可使用搜索、目录、最近文章和归档。文章地址继续采用 `/posts/<legacySlug>/`，Giscus 评论以 pathname 对应文章。

## Capabilities and Constraints

- 保持纯静态输出，不增加服务器、数据库、上传或对象存储。
- 文章类型为技术笔记、踩坑记录、生活动态、好物推荐、随笔杂谈。类型入口不恢复旧分类或标签体系。
- 主导航配置由 `src/config/navigation.ts` 维护，站点与社交信息由 `src/config/site.ts` 维护。
- 加锁文章公开 metadata、Hero 和封面；正文与正文图片必须输出密文。密钥和私有正文不能进入公开源码、文档或构建日志。
- 作品、歌单、计划和实验场允许为空。空状态如实说明，没有演示项目、虚构歌曲或补出的统计。
- 音乐播放器全站只有一个实例，跨客户端导航保留 DOM 和 Audio。声音由读者主动开启。
- 主题选择沿用 `hatrix-theme`，并同步 Giscus。搜索、评论、主题切换和播放器保留各自已实现的行为。
- 部署、推送和远端设置变更需要用户明确要求。日常实现完成后保留本地预览。

## Brand Commitments

站点名称是 Hatrix。“留频街”是主题世界的名字，不替换作者身份。虚构人物阿岑与 AI 协作者“栈”不代表作者经历，也不表示网站已提供 AI 聊天功能。

现行 v5 立绘与工坊背景是已选定的身份素材。立绘右上方的颗粒侧脸表达 AI 与机器人；不得改写为人像扫描或删除该意象。素材记录和视觉规则见 `DESIGN.md`。

页面使用真实栏目名、状态和错误信息。文章正文不为了配合世界观改写成虚构档案。

## Evidence on Hand

- 项目边界、路由与协作规则：`AGENTS.md`。
- 已发布文章：`.private-content/posts/`，位于独立私有仓库。这里只记录位置，不摘录私有正文或图片。
- 作品与歌单数据：`src/content/projects/`、`src/data/playlist.ts`。
- 已选定素材：`src/assets/home/hatrix-character-v5.png`、`src/assets/home/liupin-workshop-v5.png`。
- 世界设定来源：`E:/WorkFlow/Project/blog_idea/留频街-世界观与主题设计指南.md`。这是本机参考文档，不是公开站点资源。
- 本轮实施依据：`docs/superpowers/specs/2026-09-25-liupin-visual-system-design.md` 与对应实现计划。

## Product Principles

- 保留真实内容和既有文章地址，让旧链接与评论继续可用。
- 世界设定服务于内容辨识；读者不需要先完成剧情或理解暗语。
- 空集合、失败和未完成状态直接说明，不制造可用功能或成果。
- 私有内容与密钥的保护边界优先于装饰、搜索便利和构建缓存。

## Accessibility & Inclusion

核心操作支持键盘与可见焦点。颜色之外保留文字、图标或状态语义。减少动态效果时直接呈现最终状态；首页金句默认暂停自动切换，主题切换不显示过渡层。

桌面与手机都需要实际检查。首页固定画布在竖屏保留上下空白，这项布局选择不等于窄屏文字和触控已经通过无障碍验证。
