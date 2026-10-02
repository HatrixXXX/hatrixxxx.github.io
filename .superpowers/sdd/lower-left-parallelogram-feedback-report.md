# 左下卡片平行四边形调整报告

## 结果

金句、播放器、友链和留言板现在共用同一个仿射平面。参考平面为 `208×88`，四角是 `[(399,768),(606,756),(606,844),(399,856)]`。四张卡片的左右边竖直，上下边平行。

实现提交：`819a465618e296e01713204b1f9a1a0bdf29b6d8`。

局部布局没有改变：金句与下排、友链与留言板的间距均为 4px，两列间距为 12px；播放器和留言板底边仍在局部 `y=172`。

## 验证

- RED：修改前 focused E2E 测得播放器、友链和留言板左右边不竖直，金句旧投影四角也不符合统一平行四边形。
- GREEN：几何 focused E2E 通过。
- `tests/e2e/home.spec.ts`：20/20 通过。
- 首页视觉基线：桌面、平板、手机 3/3 通过并更新。
- `corepack pnpm test:run`：29 个文件、354 项测试通过。
- `corepack pnpm check`：0 errors、0 warnings、0 hints。
- `corepack pnpm build`：95/95 图片通过，生成 28 页，protected output audit 通过。
- `corepack pnpm check:site`：1100 条站内链接通过。
