# 设计与实施记录

`specs/` 和 `plans/` 保存按日期编写的设计及实施记录。这些文件解释当时的决策，不自动代表当前实现。发生冲突时，按以下顺序判断：

1. 用户当前要求与根目录 `AGENTS.md`
2. 当前代码、测试和 `DESIGN.md`
3. 对应主题的最新设计记录
4. 旧计划与历史记录

只读取当前任务涉及的主题，不为小改动遍历全部历史文件，也不要直接重跑旧计划中的迁移步骤。

## 常用主题入口

| 主题 | 设计记录 | 实施记录 |
| --- | --- | --- |
| 首页透视画布与播放器 | [home-dashboard](specs/2026-09-25-home-dashboard-design.md) | [liupin visual system](plans/2026-09-25-liupin-visual-system.md) |
| 首页首次加载原子性 | [home-first-load-atomic](specs/2026-10-02-home-first-load-atomic-design.md) | [plan](plans/2026-10-02-home-first-load-atomic.md) |
| 加锁内容与私有仓库 | [protected-content](specs/2026-09-03-protected-content-design.md) | [plan](plans/2026-09-03-protected-content.md) |
| 安全加固 | [security-hardening](specs/2026-09-03-security-hardening-design.md) | [plan](plans/2026-09-03-security-hardening.md) |
| 文章阅读布局 | [post-reading-layout](specs/2026-09-06-post-reading-layout-design.md) | [plan](plans/2026-09-06-post-reading-layout.md) |
| 搜索高亮 | [search-content-highlight](specs/2026-09-06-search-content-highlight-design.md) | [plan](plans/2026-09-06-search-content-highlight.md) |
| 评论系统 | [twikoo-comments](specs/2026-10-13-twikoo-comments-design.md) | [plan](plans/2026-10-13-twikoo-comments.md) |
| 工具箱 | [software-cabinet](specs/2026-10-04-software-cabinet-design.md) | [plan](plans/2026-10-04-software-cabinet.md) |

删除分类、旧首页封面、旧 Banner、横向文章栏、旧页脚和旧光标轨迹等记录只用于追溯。文件名已经提供主题索引，需要历史背景时再按关键词搜索 `specs/` 和 `plans/`。
