# 作品橱窗内容填写

15 个作品各有一份文件，位于 `src/content/projects/`。橱窗按 `order` 排序，分布在三层平台（每层 5 件）。页面可纵向滚动，窄屏还可横向浏览单层平台。点击作品罐子会将其放大，并打开图片与简短介绍。

在对应文件的 YAML 区域填写：

- `description`：项目介绍，放大卡片最多显示 100 字；建议直接写成 100 字以内。
- `cover`：可选的项目主图，使用 `/assets/project-images/` 下的站内图片；有主图时，它是卡片轮播的第一张。
- `coverAlt`：封面的文字说明；填写 `cover` 时一并填写。
- `gallery`：同一作品的其他图片，按数组顺序进入卡片内的横向循环轮播；每张填写 `src`、`alt`，可选 `caption`。没有 `cover` 时，轮播从第一张 `gallery` 图片开始。
- `category`、`tags`、`experience`、`moment`、`tech` 和 `links`：仍可保存在条目中，当前橱窗不显示这些字段。

照片放在 `public/assets/project-images/`，路径写成 `/assets/project-images/文件名.webp`。例如：

```yaml
gallery:
  - src: /assets/project-images/example-01.webp
    alt: 照片里可见的具体内容
    caption: 这张照片对应的阶段或场景
```

卡片图片内窗按 16:9 排版，并与机械外框留出净空，不加独立图片背板；不同宽高比的图片使用 `contain` 完整呈现。多图时采用横向 coverflow，中间图片突出、前后图片缩小并降低透明度，不显示按钮或可见序号；鼠标滚轮按滚动量连续移动，停滚后缓动吸附到最近一张，横向拖动、键盘左右键和触控横滑仍可循环切换，不自动播放。下方介绍使用铜青细线和统一的强调字重。15 个作品均已接入用户提供的图片，其中 RoboMaster 的两张动图保留动画。没有图片的新作品暂用现有主题线稿并注明实际照片待补充。
