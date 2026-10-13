# 作品橱窗内容填写

五个作品各有一份文件，位于 `src/content/projects/`。图鉴每张正页读取一份数据，按 `order` 排序。

在对应文件的 YAML 区域填写：

- `description`：项目介绍，显示在对应书页。
- `experience`：制作经历，可以写多行。
- `moment`：制作过程里值得记录的事，可以写多行。
- `tech`：确实使用过的技术，例如 `[FPGA, Verilog]`。
- `links`：可选链接，格式为 `[{ label: 项目仓库, url: https://... }]`。
- `gallery`：照片列表，按展示顺序填写，每张含 `src`、`alt`，可选 `caption`。

照片放在 `public/assets/project-images/`，路径写成 `/assets/project-images/文件名.webp`。例如：

```yaml
gallery:
  - src: /assets/project-images/example-01.webp
    alt: 照片里可见的具体内容
    caption: 这张照片对应的阶段或场景
```

目前五页只确定了名称和主题，没有填入项目事实或照片。图片文件准备好后再填 `gallery`；多张照片可在当前书页横向滑动，也能用上一张、下一张按钮切换。
