# 内容合并后的站点集成报告

## 范围

本次只同步公开仓库中的内容数量、分页断言、构建清单和现行文档。未修改 `.private-content`，未增加重定向、排序或其他产品逻辑，也未修改历史 spec/plan。端口 4321 的现有预览未停止或重启；focused E2E 仅复用该服务。

## 实际清单

- 已发布文章：13 篇
- 去重后的 jsDelivr 图片 URL：152 个
- Astro 构建页面：34 个
- 站内链接：1392 条
- 旧分页：`/page/2/` 有 6 篇，`/page/3/` 有 1 篇，`/page/4/` 返回 404
- FPGA 合并后的公开路径：`/posts/FPGA开发(0)基本概念/`

以上数值来自同步最终私有内容后的实际测试、生产构建和 `dist` 检查，不沿用此前 39 篇副本的废弃观测。

## 修改

- 更新 `scripts/check-built-site.ts` 的文章数和站内链接清单。
- 更新内容 schema、图片清单、构建站点和项目配置单元测试。
- 更新博客、归档、RSS、搜索、无脚本访问、文章路由和旧分页 E2E 断言。
- 更新根目录 `README.md`、`AGENTS.md` 和 `docs/README.md` 中的现行数值。
- README 中的历史验证记录保持原样。

## TDD 记录

修改前的 RED 结果：

- `corepack pnpm test:run`：旧断言期待 43 篇和 280 个图片 URL，实际为 13 篇和 152 个 URL。
- `corepack pnpm check:site`：旧断言期待 43 个文章路由和 3273 条站内链接，实际为 13 个路由和 1392 条链接。
- 受影响 E2E 的旧文章数断言失败；广泛 E2E 随后出现超时，因此停止该次运行，改为最终的单条分页回归。

测试先更新后，受影响的 5 个单元测试文件先因公开脚本和文档仍为旧值而失败；同步最小实现后，104 项 focused 单元测试全部通过。

## 最终验证

| 命令 | 结果 |
| --- | --- |
| `corepack pnpm test:run` | 29 个测试文件、355 项测试通过 |
| `corepack pnpm check` | 0 errors、0 warnings、0 hints |
| `corepack pnpm check:images` | 152/152 个 URL 通过 |
| `corepack pnpm build` | 34 pages，图片预检和 protected output audit 通过 |
| `corepack pnpm check:site` | 1392 条站内链接通过 |
| `$env:PLAYWRIGHT_PORT='4321'; corepack pnpm exec playwright test tests/e2e/home.spec.ts --grep 'pagination and legacy post paths stay available' --project=desktop-1440` | 1/1 通过 |
| `git diff --check` | 通过 |

构建仍打印项目既有的 Astro deprecation、空 `projects` 集合、chunk size 和路由优先级提示；这些提示不属于本次内容计数同步。

## 提交

- 公开仓库集成提交：`2e19bd6325a16fa1ae0723b1603d6aaa61e6503a`
- 未推送。
