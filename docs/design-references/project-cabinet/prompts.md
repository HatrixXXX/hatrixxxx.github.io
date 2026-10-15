# 作品橱窗平台与玻璃罐

页面沿用早期作品陈列架的“机械平台承托玻璃罐”关系。网站世界观为“共构城测试舱”：暗紫黑设备空间、蓝灰装甲、铜色结构线、青色信号光与少量金黄提示。素材只提供物理材质和体积，项目线稿、名称、内容与交互由页面实时绘制。

## 平台架子

用途：桌面与手机复用的横向陈列架母图，作为展品后方和下方的静态结构。参考角色：依据 `DESIGN.md` 的配色和共构城测试舱描述，不复制其他站点造型。

完整提示词：

> Use case: stylized-concept. Asset type: transparent-background website display shelf. Generate exactly one straight, front-facing modular mechanical display platform, very wide and shallow, with a perfectly level uninterrupted upper support surface for five separate specimen jars. Industrial science-fiction equipment inside the Hatrix co-construction city test chamber. Brushed blue-grey gunmetal panels, dark aubergine-black recesses (#17151d / #211e29), restrained warm copper (#d88c3c) rails and joinery, very small cyan (#00ddeb) signal lenses, minute yellow (#ffd200) locator accents. Physically coherent seams, chamfered steel, inset bolts and a low pair of sturdy feet. Three-quarter lighting from upper left, subtle cool rim from upper right, controlled reflections, premium tactile 3D illustration. Orthographic frontal perspective, strict horizontal symmetry, no camera tilt; shelf spans at least 90% of canvas width, occupies a compact band in lower half, transparent space above for jars. Image composition roughly 3:1 after trimming transparency. All edges clean and structurally straight. No jars, no objects on shelf, no scenery, no floor, no typography, no logos, no interface, no ornate fantasy motifs.

## 玻璃罐子

用途：每个作品共用的透明罐壳；项目主题线稿和灯光在前后层之间实时呈现。参考角色：沿用早期圆肩玻璃罐的外轮廓与底座比例，以 `DESIGN.md` 当前色彩和材质升级。

完整提示词：

> Use case: stylized-concept. Asset type: isolated transparent specimen jar shell for a website. Generate exactly one empty, upright laboratory display jar viewed square-on from the front, with a cylindrical clear glass body, softly rounded shoulders, compact blue-grey gunmetal cap, and a small copper-clad mounting foot. Hatrix co-construction city test chamber equipment: dark blue-grey metal (#2c2735 / #211e29), copper (#d88c3c) hardware, restrained cyan (#00ddeb) optical reflections, tiny warm yellow (#ffd200) status point. The central glass chamber must remain genuinely transparent enough to overlay a separate project illustration, with readable curved highlights concentrated at the sides and glass rim, natural thickness and subtle refraction. Isolated object, vertical 2:3 silhouette, level horizontal cap and base, clean consistent bilateral symmetry, soft upper-left key light and cool right rim. Preserve transparent margins all around. No specimen inside, no artwork, no letters, no logos, no labels, no shelf, no background, no floor, no fantasy ornament.

## 处理与运行时

- 平台母图：`shelf-source.png`，2172 × 724，保留完整横向台面。Sharp 从 `(16, 322)` 裁切 `2140 × 330`，缩至宽 1600，输出 `public/assets/projects/project-cabinet-shelf.webp`。
- 罐壳母图：`jar-source.png`，1024 × 1536，中央玻璃像素保留透明通道。Sharp 从 `(100, 24)` 裁切 `825 × 1475`，缩至宽 320，输出 `public/assets/projects/project-cabinet-jar.webp`。
- 两张图均用 WebP quality 88、effort 6；运行时将平台置于展品后层，罐壳置于现有主题线稿前层，项目名称与状态由 Astro/CSS 绘制。

## 放大展示卡片外壳

用途：罐子放大后，介绍小卡片的静态机械背壳。项目图片和不超过 100 字的介绍覆盖在壳体内窗中，由 Astro 实时渲染。参考角色：与本目录的平台、罐壳和 `DESIGN.md` 的共构城测试舱设定保持材质、受光和配色一致；不复制参考站的具体造型。

完整提示词：

> Use case: stylized-concept. Asset type: transparent-background website detail card shell. Generate exactly one compact landscape 4:3 mechanical specimen readout housing, viewed perfectly straight-on, with a broad uninterrupted dark recessed content window occupying roughly the central 85% width and 73% height. The frame is a coherent physical part from the Hatrix co-construction city test chamber: brushed blue-grey gunmetal armor, charcoal and aubergine-black inset, restrained warm copper (#d88c3c) chamfered corner retainers and seams, very small cyan (#00ddeb) status lens and tiny yellow (#ffd200) locator. Premium tactile 3D material, fine machining marks, crisp symmetrical geometry, shallow real depth and controlled highlights from upper left with a cool right rim. Keep the central window plain, very dark and visually quiet so a live image can occupy its upper portion and live Chinese text its lower portion. The outside of the physical frame must be genuinely transparent with clean edges and generous crop safety. No text, no symbols, no icons, no photos, no glass jar, no shelf, no scenery, no gradients outside the object, no watermark, no ornate fantasy styling. Do not put a dividing line or a fixed image/text layout inside the content window.

选用母图为 `info-card-shell-source.png`（1448 × 1086）。Sharp 从 `(35, 95)` 裁切 `1378 × 870`，缩至宽 1000，以 WebP quality 88、effort 6 输出到 `public/assets/projects/project-info-card-shell.webp`。运行时使用 80px 九宫格切线与 38px 边框宽度，保持角部螺钉、斜角和接缝比例；图片、提示和介绍仍由 Astro/CSS 放在中央内窗。
