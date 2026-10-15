# 作品橱窗内容填写

五个作品各有一份文件，位于 `src/content/projects/`。橱窗按 `order` 排序，桌面左侧每组最多显示六枚作品徽章，右侧显示所选作品详情；手机在展位和详情之间切换。

在对应文件的 YAML 区域填写：

- `description`：项目介绍，显示在右侧详情区。
- `category`：已确认的作品类别，作为第一枚标签。
- `tags`：可选的其他公开标签，只填写作品的真实信息。
- `cover`：可选的概念封面或项目封面，使用 `/assets/project-images/` 下的站内图片。
- `coverAlt`：封面的文字说明；填写 `cover` 时一并填写。
- `experience`：制作经历，可以写多行。
- `moment`：制作过程里值得记录的事，可以写多行。
- `tech`：确实使用过的技术，例如 `[FPGA, Verilog]`。
- `links`：可选链接，格式为 `[{ label: 项目仓库, url: https://... }]`。
- `gallery`：其他照片列表，按展示顺序填写，每张含 `src`、`alt`，可选 `caption`。右侧轮播先显示封面，再显示这些照片。

照片放在 `public/assets/project-images/`，路径写成 `/assets/project-images/文件名.webp`。例如：

```yaml
gallery:
  - src: /assets/project-images/example-01.webp
    alt: 照片里可见的具体内容
    caption: 这张照片对应的阶段或场景
```

目前五个作品只确定了名称、类别和主题，没有填入项目事实或照片。页面暂用现有主题线稿作概念封面，并注明实际照片待补充。图片文件准备好后再填 `cover`、`coverAlt` 和 `gallery`；多张图片可在右侧局部横向循环切换。
