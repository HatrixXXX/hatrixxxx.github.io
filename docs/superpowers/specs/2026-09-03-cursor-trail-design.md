# 实验场全视口鼠标曲线设计

## 目标

`/lab/` 使用与 `https://kuroha.vip/` 首页观感相近的鼠标尾迹。尾迹在实验场整个浏览器视口内持续响应，指针经过导航、正文或页面留白时都不重置；只有真正离开页面、窗口失焦或指针被取消时才结束当前输入会话。其他路由不挂载该效果。

## 绘制模型

效果使用全视口 Canvas 2D。每次输入会话包含 20 条阻尼弹簧链，每条链有 50 个节点；相邻节点通过分段二次贝塞尔曲线连接。参数保持如下：

- `friction = 0.5`
- `dampening = 0.25`
- 节点链逐级执行 `spring *= 0.98`
- 线条透明度为 `0.25`
- 色相中心为 `285°`，振幅为 `85°`
- 色相频率为 `0.0015 rad/frame`

Canvas 使用加法混合绘制新线条，再用 `destination-out` 让旧像素逐帧衰减。页面背景不会因此叠加黑色蒙层。

## 页面范围

Canvas 只在 `/lab/` 渲染，固定覆盖视口，层级为 `10`，并设置 `pointer-events: none`。它不会挡住导航、返回按钮、播放器或页面内容。

区域分类只有 `page | null`：

- 指针坐标位于视口矩形内时返回 `page`。
- 指针离开视口后返回 `null`，当前会话进入收敛和淡出阶段。
- 页面内部的元素切换不会结束会话。导航区、正文中间和两侧留白使用同一个连续目标。
- PhotoSwipe 打开时暂停接收新目标，避免在全屏灯箱背后继续绘制。

`pointerout` 和 `pointerleave` 只有在 `relatedTarget === null` 时才视为真正离开页面。普通 DOM 元素之间的移动不会触发重置。窗口 `blur` 与 `pointercancel` 也会结束当前会话。

## 动画与生命周期

第一次有效移动会在当前坐标初始化所有节点，避免从页面原点拉出长线。首节点追逐指针，后续节点追逐前一节点并继承部分速度。

会话停止接收输入后继续更新，直到节点收敛。所有物理会话结束后，Canvas 再执行 24 帧尾部衰减，然后清屏并停止动画。reduced motion、非精细指针、Canvas 替换或位图尺寸变化会立即清屏。

Canvas 位图按设备像素比缩放，CSS 尺寸始终等于视口。Astro 客户端导航后重新同步 Canvas，事件监听只注册一次。

效果只在以下条件同时满足时运行：

- 当前路径是 `/lab/`；
- `(hover: hover) and (pointer: fine)` 匹配；
- `prefers-reduced-motion: reduce` 不匹配。

## 文件边界

- `src/components/CursorTrail.astro`：Canvas 标记与固定层样式。
- `src/lib/cursor-trail.ts`：视口区域分类、物理参数、色相时钟和节点更新。
- `src/scripts/cursor-trail.ts`：指针事件、绘制循环、媒体查询和 Astro 生命周期。
- `src/layouts/BaseLayout.astro`：只在实验场挂载 Canvas，并加载运行时。

## 验收

- 实验场顶部导航区、正文和页面留白都能生成尾迹。
- 指针在页面内部移动时，Canvas 会话保持连续。
- 指针离开页面后，会话进入淡出状态。
- 非实验场路由没有 Canvas。
- reduced motion 和非精细指针不绘制。
- 高 DPR 下 Canvas 位图尺寸正确。
- 客户端离开再返回实验场后，仍只有一个 Canvas，效果可以再次使用。

完整验证运行 `test:run`、`check`、`build`、`check:site` 和 CursorTrail 的 Playwright 测试。

## 数学名称

单条线是分段二次贝塞尔样条。完整效果可以称为“阻尼弹簧—质点链驱动的二次贝塞尔样条鼠标尾迹”。曲线形状由指针路径和节点状态共同决定，只有色相按正弦规律随时间变化。
