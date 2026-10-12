# 项目级前端设计工具

本目录安装三个独立 skill，均从各自 GitHub 仓库的指定目录获取，未安装仓库中的其他 skill 或其他平台副本。Codex 从本项目及其子目录启动时发现 `.agents/skills/`，其他项目不加载这里的工具。没有修改用户级 Codex 配置、全局 AGENTS.md 或全局 skill 目录，也没有新增 MCP 服务或自动 hook。

## 已安装工具

| 工具 | 来源 | 用途 |
| --- | --- | --- |
| Impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 视觉审查、排版调整、动效与界面打磨；附带本地命令行引擎。 |
| UI UX Pro Max | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 查询本地设计数据和 Astro 实现指南；需要 Python 3。 |
| Anthropic frontend-design | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | 确定视觉方向并实现页面与组件。 |

固定的上游 commit、安装路径和 Impeccable 引擎校验值记录在 `skills-sources.json`。各目录保留上游许可证；Impeccable 还保留 `NOTICE.md`。上游 skill 文件保持原样，项目分工和路径适配写在根目录 `AGENTS.md`。

## 使用

下一轮对话可以显式使用 `$impeccable`、`$ui-ux-pro-max` 或 `$frontend-design`，也可以直接提出页面设计需求，由项目规则选择工具。如果列表没有刷新，在本项目新建会话或重启 Codex。

UI UX Pro Max 的上游文件包含 Claude 插件路径示例，本项目改用以下命令。命令从项目根目录执行；只查询，不写入设计方案：

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "personal blog typography" --domain typography -n 2
python .agents/skills/ui-ux-pro-max/scripts/search.py "responsive images islands" --stack astro -n 2
```

Impeccable 使用项目内 Windows 启动器。先设置当前命令环境的缓存目录，再运行需要的命令；不要把这个变量写入系统环境：

```powershell
$env:IMPECCABLE_HOME = Join-Path (Get-Location) '.impeccable'
& ./.agents/skills/impeccable/scripts/impeccable.cmd engine-probe
```

Windows x64 引擎位于 `skills/impeccable/scripts/bin/windows-x64/impeccable.exe`，安装时按 GitHub Release 提供的 SHA-256 校验。引擎和 `.impeccable/` 不进入 Git。首次在其他机器运行时，启动器可按 `scripts/VERSION` 下载对应引擎；仍应先把 `IMPECCABLE_HOME` 设为该项目下的 `.impeccable`。

项目未安装 Impeccable 的浏览器扩展或自动 hook。常规设计、审查和命令行功能可直接使用；需要浏览器时按已有浏览器 skill 操作，专用 live 模式的扩展接入另行配置。

## 更新与检查

更新时先检查本地改动，只替换 `skills-sources.json` 中列出的三个上游目录，并同步许可证、commit 和引擎校验值。不要运行全局安装命令或顺带安装完整 skills 集合。

安装或更新后检查：三个入口均能被 Codex 以 `REPO` scope 发现；UI UX Pro Max 能返回 Astro 查询结果；Impeccable 的 `engine-probe` 能返回版本；其他仓库的 skill 列表不包含这三个项目路径。

项目级发现机制参见 [Codex Skills 文档](https://learn.chatgpt.com/docs/build-skills#where-to-save-skills)。
