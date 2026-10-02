# 内容合并后的站点集成报告

## 范围

本次只同步公开仓库中的内容数量、分页断言、构建清单和现行文档。未修改 `.private-content`，未增加重定向、排序或其他产品逻辑，也未修改历史 spec/plan。端口 4321 的现有预览未访问、停止或重启；focused E2E 使用临时的 4323 静态服务，完成后已关闭。

## 实际清单

- 已发布文章：8 篇
- 去重后的 jsDelivr 图片 URL：95 个
- Astro 构建页面：28 个
- 站内链接：1100 条
- 旧分页：`/page/2/` 有 2 篇，`/page/3/` 返回 404
- FPGA 合并后的公开路径：`/posts/Xilinx FPGA开发/`
- 私有内容提交：`ac4d5baae5678d7de259a7b14894cf5c6547c22c`
- 冻结快照 digest：`6E116DA15A685DC8C3E691CD055364FE6D2903F3E97B558D577364B676DD510A`

以上数值来自同步最终私有内容后的实际测试、生产构建和 `dist` 检查。主私有目录连续 10 秒快照稳定，worktree clone 的 8 个文件已逐文件核对 SHA-256。

## 修改

- 更新 `scripts/check-built-site.ts` 的文章数和站内链接清单。
- 更新内容 schema、图片清单、构建站点和项目配置单元测试。
- 更新博客、归档、RSS、搜索、无脚本访问、文章路由和旧分页 E2E 断言。
- 更新根目录 `README.md`、`AGENTS.md` 和 `docs/README.md` 中的现行数值。
- README 中的历史验证记录保持原样。

## TDD 记录

修改前的 RED 结果：

- `corepack pnpm test:run`：中间态断言期待 13 篇和 152 个图片 URL，最终实际为 8 篇和 95 个 URL；已删除文章对应的真实图片 fixture 同时失效。
- `corepack pnpm check:site`：中间态断言期待 13 个文章路由和 1392 条站内链接，实际为 8 个路由和 1100 条链接。
- 受影响 E2E 的旧文章数断言失败；广泛 E2E 随后出现超时，因此停止该次运行，改为最终的单条分页回归。

测试先更新后，受影响的单元测试因公开脚本和文档仍为旧值而按预期失败；同步最小实现后，全量单元测试通过。

## 最终验证

| 命令 | 结果 |
| --- | --- |
| `corepack pnpm test:run` | 29 个测试文件、354 项测试通过 |
| `corepack pnpm check` | 0 errors、0 warnings、0 hints |
| `corepack pnpm check:images` | 95/95 个 URL 通过 |
| `corepack pnpm build` | 28 pages，图片预检和 protected output audit 通过 |
| `corepack pnpm check:site` | 1100 条站内链接通过 |
| 临时运行 `python -m http.server 4323 --bind 127.0.0.1 --directory dist`，再以 `PLAYWRIGHT_PORT=4323` 运行分页 focused E2E | desktop-1440，1/1 通过 |
| `git diff --check` | 通过 |

构建仍打印项目既有的 Astro deprecation、空 `projects` 集合、chunk size 和路由优先级提示；这些提示不属于本次内容计数同步。

## 提交

- 中间态公开提交：`2e19bd6325a16fa1ae0723b1603d6aaa61e6503a`，最终纠偏已覆盖其中的 13 篇口径。
- 最终公开纠偏提交：`819a465618e296e01713204b1f9a1a0bdf29b6d8`。
- 未推送。
