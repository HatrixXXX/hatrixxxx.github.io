# 工具方块面材

## 银灰贵金属面材 v2

用途：`public/assets/toolbox/rounded-metal-cube.glb` 六个面的基础色贴图。它只负责材质底色、拉丝和轻微使用痕迹；立体外框、铜缝、图标内板、固定件、短灯、金属度和粗糙度仍由 GLB 几何与 PBR 材质实时呈现。

输入图角色：

- `public/assets/toolbox/metal-face-v1.webp`：编辑目标，必须保留正方形正投影、外框分段、八角铜缝、中央深色面板、四角灯位和全部边界比例。
- `docs/design-references/toolbox-case/case-shell-thin-landscape-source.png`：仅作材质、配色和世界观参考；不得复制箱体轮廓或透视。

完整提示词：

```text
Use case: precise-object-edit
Asset type: square albedo source for all six faces of a realtime WebGL sci-fi industrial tool cube on the Hatrix website
Primary request: recolor and rematerialize only the supplied square tool-cube face so its currently pale outer metal becomes a restrained silver-gray precious alloy matching the supplied Hatrix toolbox shell; keep it recognizably metallic, dense and premium rather than white, chalky or chrome-bright
Input images: Image 1 is the edit target and exact layout reference; Image 2 is a style, material-language and palette reference only
Scene/backdrop: no scene and no background; the entire square canvas is the orthographic face texture
Subject: one centered square mechanical face plate with segmented rounded outer armor, a narrow octagonal copper joint, a recessed charcoal icon well, four small corner service-light recesses and precise industrial seams
Style/medium: physically plausible hard-surface science-fiction industrial machinery for the H-3 co-construction workshop world; premium silver-gray platinum/titanium alloy, understated blue-violet gunmetal undertone, machined edges, fine directional brushing and sparse believable micro-scratches
Composition/framing: preserve Image 1 exactly—front orthographic view, square 1:1 canvas, identical part positions, widths, bevel boundaries, symmetry, central empty region and safe margins; no camera perspective and no crop
Lighting/mood: neutral soft material-reference lighting with restrained edge response; retain midtone detail for realtime PBR lighting; no blown highlights, no dramatic spotlight and no baked directional cast shadow
Color palette: medium silver-gray and smoky blue-gray outer alloy sampled conceptually from Image 2, graphite-black center, muted aged copper joint, very small cyan and warm amber service-light accents; outer metal must remain clearly darker than off-white
Materials/textures: anisotropic fine-brushed precious alloy, subtle machining marks, controlled roughness variation, dark recessed gasket, aged copper with restrained oxidation; clean enough for a maintained workshop tool, not pristine and not heavily damaged
Constraints: change only color, material response and surface finish; preserve every geometric boundary and the exact face layout from Image 1; keep the center free of logos, labels and icons because software icons are composited live; preserve all four corner light locations; output one square raster image
Avoid: white or pale aluminum, mirror chrome, plastic, stone, painted concrete, excessive grunge, rust, dirt, deep dents, ornamental fantasy motifs, extra screws, extra panels, typography, symbols, logos, watermark, perspective distortion, depth-of-field, environment background
```

选用母图：`metal-face-source-v2.png`，由 Codex 内置 imagegen 以旧面材为编辑目标、选定箱壳为材质参考生成。处理方式：选定母图缩放为 `1024 × 1024`，适度降低明度和饱和度后转为高质量 WebP；构建脚本同时把外层银灰合金的 PBR 粗糙度提高、金属度和底色乘数压低，以抵消现场环境反射与曝光，再嵌入 GLB。运行时路径：`public/assets/toolbox/metal-face-v2.webp` 与 `public/assets/toolbox/rounded-metal-cube.glb`。
