# 工具箱箱体素材

## 统一视角重制（2026-10-16）

箱壳生图提示词记录的相机为垂直视角 `35°`、俯角 `62°`、零水平偏航；这些是提示参数，生成图片并不保证严格遵循数值。对最终 PNG 的左右内壁斜率做反投影校准后，运行时横版使用垂直视角 `35°`、俯角 `77.115°`，竖版使用 `35°`、`74.46°`，均为零水平偏航；槽阵列左右外边与对应箱壳内壁的斜率误差小于 `0.005`。提示角与运行时角度分别存于 `src/config/toolbox-perspective.json` 的 `promptElevation` 和各布局的 `elevation`。模型是一块水平的矩形板，本身不做八角切割或梯形变形。桌面内衬为 `10 × 4`，窄屏为 `4 × 10`，均为 40 槽。两张选用母图的透明开口各以八个顶点记录在同一配置；`scripts/build-toolbox-foam.mjs` 用这些顶点精确抠图，并按校准后的相机反投影取得可覆盖开口的矩形范围，箱壳前景遮住矩形板边缘。槽位沿矩形的两个轴等间距排列，四边各留 `0.42` 个槽宽。只改内衬时运行 `node scripts/build-toolbox-foam.mjs --models-only`，不会重写选定的箱壳图片。

### 深色工业复合泡棉纹理 v2（试作，未采用）

```text
Use case: stylized-concept
Asset type: seamless square albedo and bump texture for the realtime 3D damping insert on the Hatrix toolbox page
Input image: the supplied Hatrix thin-wall toolbox shell is a palette, material-language and worldbuilding reference only; do not reproduce its frame geometry
Primary request: create an original edge-to-edge material swatch for dense dark sci-fi industrial shock-absorbing composite foam used in the H-3 co-construction workshop
Scene/backdrop: flat orthographic top-down material scan filling the entire square canvas; no background and no object silhouette
Style/medium: high-fidelity physically plausible hard-surface material texture, suitable for a WebGL PBR material
Lighting/mood: even neutral grazing studio light that reveals micro relief without a directional cast shadow, vignette or hotspot
Color palette: predominantly charcoal #17151d and smoky violet-black #211e29, muted blue-gray fibers, extremely restrained warm copper #d88c3c and amber #ffd200 mineral flecks occupying less than two percent of the surface
Materials/textures: tightly compressed microcellular foam, subtle graphite fabric lamination, fine pores, faint irregular pressed fibers, minute abrasion and embedded conductive specks; rich at close range but visually quiet at page scale
Composition/framing: square, uniformly detailed, designed to repeat seamlessly in both axes with matching opposite edges
Constraints: no slots, holes, bevels, panels, frame, screws, seams, labels, text, logos, symbols, tools, cubes, perspective, large scratches, bright patches, recognizable repeating motif or watermark
```

该试作过于接近传统泡棉，未用于最终页面；保留母图 `foam-industrial-v2-source.png` 作为过程记录。

### 银灰贵金属内衬顶面纹理 v3

```text
Use case: stylized-concept
Asset type: seamless square albedo and bump texture for the top surface of the realtime 3D Hatrix toolbox insert
Input image: the supplied Hatrix thin-wall toolbox shell is the authoritative reference for palette, precious-metal material language, lighting restraint and H-3 co-construction workshop worldbuilding; do not reproduce the shell geometry
Primary request: create an original edge-to-edge surface swatch for a premium silver-gray sci-fi industrial insert plate made from platinum-titanium alloy composite
Scene/backdrop: flat orthographic top-down material scan filling the square canvas, no background and no object silhouette
Style/medium: high-fidelity physically plausible PBR hard-surface material for WebGL
Lighting/mood: neutral even grazing light revealing micro relief without directional shadow, vignette or hotspot
Color palette: cool silver-gray and pale platinum, smoky violet-gray and muted blue-gray undertones, extremely restrained hairline copper #d88c3c and amber #ffd200 conductive flecks occupying less than one percent
Materials/textures: fine multi-directional brushed alloy, subtle forged grain, minute machining lines, shallow compression scuffs, restrained edge-like glints distributed as micro detail, premium dense and tactile rather than mirror-polished
Composition/framing: square, uniformly detailed, designed to repeat seamlessly in both axes with matching opposite edges
Constraints: no slots, holes, bevels, panels, frame, screws, seams, labels, text, logos, symbols, tools, cubes, perspective, large scratches, bright white patches, recognizable repeating motif or watermark
```

### 枪灰贵金属槽内纹理 v3

```text
Use case: stylized-concept
Asset type: seamless square albedo and bump texture for recessed socket walls and floors in the realtime 3D Hatrix toolbox insert
Input image: the supplied Hatrix thin-wall toolbox shell is the authoritative reference for palette, precious-metal material language and H-3 co-construction workshop worldbuilding; do not reproduce the shell geometry
Primary request: create an original darker companion material to the silver-gray insert top, used inside deep square equipment sockets
Scene/backdrop: flat orthographic top-down material scan filling the square canvas, no background and no object silhouette
Style/medium: high-fidelity physically plausible PBR hard-surface material for WebGL
Lighting/mood: low-key even grazing light, controlled recessed reflections, no cast shadow, vignette or hotspot
Color palette: deep gunmetal silver, charcoal blue-gray and smoky violet-black, restrained dull platinum abrasion, sparse warm copper and amber conductive dust below one percent
Materials/textures: finely brushed noble-metal composite darkened by contact and depth, subtle insertion wear, compressed machining grain, minute edge scuffs and soft industrial patina; visually related to the outer toolbox but clearly darker than the insert top
Composition/framing: square, uniformly detailed, designed to repeat seamlessly in both axes with matching opposite edges
Constraints: no actual cavity, slot, hole, bevel, panel, frame, screws, seams, labels, text, logos, symbols, tools, cubes, perspective, large scratches, bright patches, recognizable repeating motif or watermark
```

### 深银灰贵金属内衬顶面纹理 v4

```text
Use case: precise-object-edit
Asset type: corrected seamless square albedo and bump texture for the top surface of the realtime 3D Hatrix toolbox insert
Input images: Image 1 is the edit target, the existing pale silver insert texture; Image 2 is the authoritative Hatrix thin-wall toolbox shell material and palette reference
Primary request: darken and recolor the entire insert texture so it belongs inside the supplied toolbox: deep silver-gray platinum-titanium alloy with smoky violet and charcoal blue-gray undertones, approximately sixty percent darker than Image 1
Style/medium: high-fidelity physically plausible PBR hard-surface material for WebGL
Lighting/mood: low-key even grazing light; keep only narrow restrained platinum glints in the brushed grain, with no broad pale or white areas
Materials/textures: preserve the fine multi-directional brushing, forged grain, minute machining lines, shallow compression scuffs and extremely sparse copper/amber conductive flecks; increase material depth and premium dark-metal weight
Composition/framing: preserve the square edge-to-edge orthographic texture and seamless repeat intent
Constraints: change only color, luminance and material depth; no slots, holes, bevels, panels, frame, screws, seams, labels, text, logos, symbols, tools, cubes, perspective, bright patches, vignette or watermark
```

最终使用顶面母图 `insert-metal-top-v4-source.png` 与槽内母图 `insert-slot-metal-v3-source.png`，均由 Codex 内置 imagegen 生成。构建脚本分别取母图中央 `640 × 640` 区域，缩为 `512 × 512`，再强模糊、去色并压缩到高灰低对比范围，输出 `public/assets/toolbox/insert-top-detail-v5.webp` 和 `insert-slot-detail-v5.webp`。运行时内衬使用不参与环境照明的无光材质：顶面基色 `#24272e`，槽壁 `#161a20`，槽底 `#0c0f14`；细节图只带来很轻的低频明暗变化，不作为 bump，不产生镜面高光，也不保留原母图的明显拉丝或噪点。浅色顶面母图 `insert-metal-top-v3-source.png` 与深色泡棉试作仅保留为过程记录，不在运行时加载。

### 桌面箱体重制提示词

```text
Generate a NEW original landscape transparent PNG asset: one empty open industrial toolbox shell seen from a centered high-overhead perspective. The camera is fixed: vertical field of view 35 degrees, elevation 62 degrees above its horizontal inner floor, zero yaw and zero roll. Image aspect about 1488:876. Entire object in frame. The image must have genuine alpha transparency outside the shell AND through the complete center opening; no floor at all.

CRITICAL SHAPE CHANGE: this tray is NEARLY RECTANGULAR, with only TINY 45-degree chamfers at the four corners. Each corner chamfer occupies no more than 2-3% of the total width and 3-4% of total height. Absolutely no long diagonal sides, no octagon silhouette, no huge beveled corner panels. Long sides should remain straight almost their full length. The four walls and upper rim are THIN: side rail visible thickness only about 4% of canvas width each, rear wall about 5% of canvas height, low front fascia about 7% of canvas height. The large central aperture takes about 82% of width and 68% of height. Its boundary is also a nearly rectangular shallow perspective quadrilateral with only very short clipped corners; far edge subtly narrower than near edge. Leave broad continuous transparency in the middle, no black fill, no foam, no sockets. Show just enough inner sidewall shading to communicate real depth, never a heavy deep box.

Material design: tactile brushed slate blue-gray and muted violet-gray anodized armor, fine copper gasket seams, tiny restrained amber and cyan functional indicators, dark charcoal inner gasket, refined hard-surface 3D product rendering with upper-left light. Thin precise mechanical joints rather than bulky armor. All four side walls and near rim opaque, central cutout crystal-clear transparent. No lid, handle, carrying grip, text, logo, UI, cube, tool, floor, room, shadow across the opening, checkerboard or background.
```

### 窄屏箱体重制提示词

```text
Generate a NEW PORTRAIT companion transparent PNG for the supplied thin-wall landscape industrial toolbox shell. Use the supplied image ONLY as a style and mechanical detail reference: thin slate-blue/violet-gray anodized rails, delicate copper seam, tiny amber and cyan service lights, dark inner gasket. Do not crop, rotate or stretch it. Render a separate tall narrow open tray for 3 columns by 14 rows of 3D foam sockets, centered on a portrait 944:1408 canvas.

Same predetermined camera: perspective vertical field of view 35 degrees, elevation 62 degrees above a horizontal tray floor, zero yaw and roll, far/top end only subtly narrower than near/bottom. Keep all outer edges visible on genuinely transparent alpha, and make the WHOLE central aperture genuine transparent alpha, not black. NO floor, foam or sockets.

CRITICAL GEOMETRY: nearly rectangular outer silhouette with only tiny 45-degree chamfers at four corners; each chamfer is no more than 3% of shell width and 2% of shell height. Do not make long diagonal sides, octagonal corners, giant armor plates or thick case walls. Long side rails must be straight and slim, each about 5% of the canvas width; rear wall about 4% of canvas height and near/front fascia about 5% of canvas height. The opening is tall and wide for this shell, about 75% of shell width and 78% of canvas height, simple straight edges, almost square corners with tiny chamfers. Inner wall shading gives just enough physical depth; this is a shallow precise instrument tray, not a deep suitcase.

Original high-fidelity hard-surface 3D render, clean upper-left lighting, restrained brushed metal grain and fine joints. Single empty shell only, no lid, handle, tools, cubes, text, logo, UI, person, room, floor, backdrop, checkerboard, or shadow across the transparent opening.
```

选用母图：`case-shell-thin-landscape-source.png`（1635 × 962）与 `case-shell-thin-portrait-source.png`（1027 × 1532）；均由 Codex 内置 imagegen 输出。横版为独立生成，竖版仅参照横版的材质和机械语言。构建脚本将开口按八点多边形再次精确扣成透明，并分别缩为 `public/assets/toolbox/case-shell-thin-landscape.webp`（1488 × 876）和 `case-shell-thin-portrait.webp`（944 × 1408）。前景图覆盖 WebGL 矩形内衬；八点开口只用于蒙版和矩形覆盖范围的计算，不作为模型外轮廓。泡棉顶面采用单开口外圈和独立槽间桥接条，避免多孔三角剖分把首排槽位盖住。偶数列布局的样机方块落在靠左的中间槽，而非两槽之间。上版箱壳和素材保留为历史来源。


## GLB 缓冲内衬（上一版记录）

箱体前景是静止图片 `public/assets/toolbox/case-shell-landscape.webp` 和 `case-shell-portrait.webp`，中央泡棉床透明，原箱体素材 `case-landscape.webp` 和 `case-portrait.webp` 保留作制作来源。当前槽位不再来自下方图片试作，而是由 `scripts/build-toolbox-foam.mjs` 确定性生成的两个模型：`public/assets/toolbox/foam-slots-7x6.glb` 与 `foam-slots-3x14.glb`。每个模型由一整块减震泡棉、42 个真正贯通至凹底的方形槽和下层槽底构成；桌面为 7 × 6，窄屏为 3 × 14。模型生成命令：`node scripts/build-toolbox-foam.mjs`。

泡棉表面的细颗粒纹理 `public/assets/toolbox/foam-grain.webp` 由本项目原创母图 `case-source-45-thin-landscape.png` 的 `(640,330,256,256)` 区域裁切而来，也由同一脚本生成。它只补足材料表面，凹槽深度与遮挡由 GLB 几何和 WebGL 深度缓冲提供。透明 WebGL 场景位于箱体前景图之后；桌面与手机采用分别拟合开口透视的相机角度，前景的内壁和前沿自然遮住泡棉侧面。VS Code 方块与泡棉同处一个场景、半沉入最靠前的中间槽，点开方块时隐藏泡棉并沿用原有旋转操作。仅开发预览可以点击泡棉，单独放大、拖动旋转和滚轮缩放；正式构建不提供该测试入口。运行时不加载先前生成的带槽箱体 WebP。

## 透明开口箱体前景（上一版记录）

使用 Codex 内置 imagegen 分别编辑当前桌面、手机静态箱体图片，仅把内腔底面变成透明开口，保留箱壁与前沿。完整输出母图是 `case-shell-cutout-landscape-generated.png`（1634 × 962）和 `case-shell-cutout-portrait-generated.png`（1027 × 1531），用 Sharp 按原箱体比例缩为 1488 × 876 与 944 × 1408，并以 WebP quality 88 输出到上述运行时路径。页面在开口后铺同一泡棉纹理，GLB 放在中层，箱体图始终为静止前景。桌面相机俯角约 37°，手机约 32°，分别匹配两张箱体图实际透视；这些角度取自开口边界的投影拟合。

桌面编辑完整提示词：

```text
Use case: precise-object-edit. Edit target: the supplied original Hatrix sci-fi industrial toolbox case raster. Create a compositing foreground shell version of the SAME case for a website 3D foam insert. Preserve the exact centered camera pose, perspective, silhouette, dimensions, armor geometry, side and rear inner walls, front fascia, copper seams, cyan/amber lights, lighting, surface detail and existing transparent exterior. Change only the flat charcoal foam FLOOR inside the four inner walls into a genuinely transparent opening, following its existing perspective trapezoid boundary precisely. All metal and inner walls, including the complete lower/front lip, must remain opaque and visually unchanged. No foam, slots, cubes, text, logo, extra frame, new elements, crop or camera movement. Transparent background and transparent interior opening.
```

手机编辑完整提示词：

```text
Use case: precise-object-edit. Edit target: the supplied original portrait Hatrix sci-fi industrial toolbox case raster. Create a compositing foreground shell version of the SAME narrow vertical case for a website 3D foam insert. Preserve the exact centered camera pose, tall portrait perspective, silhouette and aspect ratio, armor geometry, side and rear inner walls, front fascia, copper seams, cyan/amber lights, lighting, surface detail and existing transparent exterior. Change only the flat charcoal foam FLOOR inside the four inner walls into a genuinely transparent opening, following its existing perspective floor boundary precisely. All metal and inner walls, including the complete lower/front lip, must remain opaque and visually unchanged. No foam, slots, cubes, text, logo, extra frame, new elements, crop or camera movement. Transparent background and transparent interior opening.
```

## 42 槽图片试作（历史）

现有页面包含 42 个工具。桌面按 7 列 × 6 行，窄屏按用户选择的 3 列 × 14 行，槽位为泡棉本体的一部分，不把工具图标、文字或方块烘焙进素材。VS Code 方块仍由现有 WebGL 组件实时绘制。

### 桌面 7 × 6 槽位母图

```text
Use case: precise-object-edit. Edit ONLY the charcoal shock-absorbing foam floor inside the supplied Hatrix open equipment case. Keep the 45-degree camera, outer armored chassis, thinner side walls, lowered thick front fascia, copper seams, amber/cyan lights, shadows, transparent exterior, silhouette, proportions and lighting unchanged.

Carve EXACTLY FORTY-TWO empty square module sockets into the foam: exactly SEVEN columns in each of exactly SIX rows, orderly and evenly spaced. Every socket is a real snug recess, not a painted outline: a narrow raised foam compression lip closely surrounds the square opening, beveled high-density cushioning material rolls down into dark inner walls, and the bottom sits visibly below the foam surface with restrained ambient occlusion. The socket openings must be square in the case's own horizontal plane; from this existing 45-degree overhead camera they form coherent perspective quadrilaterals. The far row is smaller and closer together, the near row is slightly larger and farther apart, all columns converge naturally toward the far edge. Maintain consistent foam bridges between sockets and a protective margin against all four inner walls. Keep the recesses shallow enough that a cube could rest half-sunk in one while its upper half remains visible.

The 7-by-6 array is the ONLY addition. Count all 42 cavities exactly, no empty extra rows, no missing sockets, no circular holes, no tool bits, cubes, letters, labels, icons, logos, foam tears, or new decorative patterns. Preserve the case as a single genuinely transparent-background raster asset.
```

首次生成仅有 7 × 5 槽位。下面是保留既有五行、定向补第六行的编辑提示词：

```text
Use case: precise-object-edit. The supplied Hatrix case already contains exactly FIVE rows of SEVEN empty recessed square sockets. Keep those existing 35 cavities, all foam texture, every chassis panel, lighting, transparent background and perspective completely unchanged. Add exactly ONE NEW SIXTH ROW of SEVEN matching square recessed sockets into the currently blank foam band immediately in front of the fifth row and behind the thick near/front case wall. Space this sixth row evenly across the width, align each new cavity under the corresponding column above it, and preserve a narrow protective foam bridge before the front wall. The new row is slightly larger in natural perspective, with the same snug high-density foam lip, beveled inner walls and dark floor. The final foam must show exactly 6 rows × 7 columns = 42 empty sockets. Do not alter or add any other part of the image; no cubes, text, tools, extra row or missing cavity.
```

### 手机 3 × 14 槽位母图

```text
Use case: precise-object-edit. Edit ONLY the charcoal damping-foam floor of the supplied tall Hatrix portrait equipment case. Preserve the centered 45-degree overhead camera, thin gray-violet/blue-gray chassis walls, lowered thick front fascia, copper seams, sparse amber and cyan lights, transparent exterior, shadows and all other existing materials unchanged.

Cut EXACTLY FORTY-TWO snug EMPTY square recessed sockets in an exact THREE-column by FOURTEEN-row array: each row has exactly three cavities, and there are exactly fourteen rows from the far end to the near end. Each square slot has a narrow compressed foam lip, beveled dense shock-absorbing inner walls and a darker lower floor, with credible depth and tight fit for a future cube. Follow the case's natural perspective: upper rows subtly smaller and closer together, lower rows larger, all aligned within the tapered foam opening. Use the full long foam bed with even small bridges and safe margins from the inner walls. The sockets must remain visually distinct and regular at phone display size.

Make no other change. No lid, contents, cubes, screwdriver bits, text, numbering, logos, UI, extra holes, omitted row, irregular arrangement, new color, camera shift, crop or flattened material. Output the entire original tall case on transparent alpha.
```

首次生成比要求多出靠前的一行，实际为 3 × 15。以下提示词只移除最后一行：

```text
Use case: precise-object-edit. The supplied tall Hatrix case currently has exactly THREE columns and FIFTEEN rows of square empty foam sockets. Preserve the first FOURTEEN rows (42 sockets total), the case armor, walls, metal, lights, 45-degree perspective, shadows, and transparency without alteration. Remove ONLY the fifteenth and nearest/bottom-most row of THREE cavities, which sits directly in front of the other fourteen rows closest to the near/front metal fascia. Replace that removed row with continuous matching charcoal high-density damping foam and a modest protective margin before the front wall. The final foam must contain exactly 3 columns by 14 rows = 42 distinct recessed square sockets, no more and no less. Do not remove or rearrange any of the 42 sockets above; no new objects, text, logos, crop or material changes.
```

## 薄壁与低前沿修订（槽位编辑的来源）

以下两张为现有约 45° 母图的定向编辑。保持相机、完整轮廓、泡棉材质、配色和光向；只收薄箱壁并降低近侧前沿，增加主体可见面积。

### 桌面母图编辑

```text
Use case: precise-object-edit. Edit the supplied original Hatrix open sci-fi equipment case image, preserving its 45-degree downward camera angle, centered perspective, full outline and footprint, transparent exterior, foam texture, smoky gray-violet and blue-gray brushed metal, copper seams, sparse amber/cyan lights, and upper-left lighting.

Change only the case wall geometry: make the left, right and far/back structural walls about 20 percent slimmer while keeping believable beveled metal thickness and a recessed protective foam cavity. Lower the near/front wall and fascia by roughly 15–20 percent, so more of the charcoal foam floor and any future live content near the front edge remains visible. Keep the lower front edge in the same overall position and retain a solid heavy base; reduce the wall's upward intrusion into the opening, rather than flattening the whole case. The foam bed becomes slightly larger and less occluded. Keep the perspective edges straight, the far end narrower than the near end, and all seams, fasteners and shadows physically coherent after the geometry change.

No lid, tools, cubes, sockets, text, logos, people, room, floor, new ornaments, camera change, color change, lighting change, crop, stretch, or flattened sticker appearance. Output a single clean case on genuinely transparent alpha.
```

### 窄屏母图编辑

```text
Use case: precise-object-edit. Edit the supplied original portrait Hatrix equipment case image. Preserve its 45-degree overhead camera, tall narrow centered silhouette, natural converging rails, genuine transparent background, charcoal microcellular foam, gray-violet/blue-gray armor, copper seams, minimal amber/cyan lights and realistic upper-left lighting.

Only revise the enclosure geometry: narrow the two long side walls and far/back wall by about 20 percent, and lower the near/bottom front wall by about 15–20 percent. The front fascia must stay visibly solid and three-dimensional but should not rise so far into the foam opening. Expand the clean visible foam bed correspondingly, leaving more room for a separate web cube and copy. Keep the entire case in frame and preserve its outer footprint, angle, materials, functional fasteners and coherent contact shadows. Do not add contents, sockets, lid, labels, logos, room, floor, props, new lights, dramatic angle changes, crop, or flat picture-frame styling.
```

## 约 45° 俯视修订（历史）

以现有原创箱体作为配色与材料参考，重新建模相机与箱体厚度。下方 18–22° 和完全正视的方案均为历史版本。

### 桌面 45° 母图

```text
Use case: stylized-concept. Asset type: a single isolated static toolbox case image for the Hatrix website. Use the supplied original Hatrix case only as a STYLE reference for smoky violet-gray and blue-gray armor, brushed metal, thin copper joins, sparse amber/cyan status lights and dense charcoal impact-absorbing foam. Rebuild its geometry and camera completely.

An open LIDLESS industrial sci-fi equipment case lying on a workbench, camera centered above its front, looking DOWN at the foam bed at approximately 45 degrees. The case is a deep, heavy physical object, not a vertical front panel. Show a broad visible interior floor, tall inner sidewalls, a far/back rim, and especially a thick near/front wall and lower outer fascia with 8–12 cm of believable depth. Natural moderate lens perspective: the far/top rim and far edge of the foam are clearly narrower than the near/bottom rim; both side edges converge toward the far end. Keep left/right symmetry almost exact, with at most 2 degrees of yaw. There is a strong contact shadow beneath the thick body on transparent alpha.

The open foam floor is a single clean dark microcellular damping material plane, empty of sockets or objects, occupying most of the box, large enough to receive a separate live 9-by-5 grid of square modules. Its visible shape is a precise symmetric perspective trapezoid: straight far and near horizontal edges, straight converging left and right edges, and no warps or waves. Leave clear margin around the foam for HTML overlays. The deep cavity walls cast consistent inward shadows. Detailed construction only where functional: beveled armor segments, gaskets, a few fastener wells, copper mechanical seams, restrained amber/cyan edge indicators. Soft upper-left workshop light. Hatrix palette #17151d, #211e29, blue-gray, gray-violet, copper #d88c3c, small accents #ffd200 and #00ddeb.

Wide 3:2 landscape product render with the entire case and all four outer sides fully visible, transparent outside. No lid, no cover, no screwdriver-bit case silhouette, no tools, bits, cubes, sockets, holes, text, labels, logo, UI, people, room, floor, fisheye, diagonal theatrical rotation, or flat sticker/picture-frame appearance. The camera angle must visibly read as approximately 45 degrees downward, with genuine thick 3D construction.
```

### 桌面角度定向重试

初稿仍偏正面，以下提示词不附正视图参考，以便明确重建透视。

```text
Use case: stylized-concept. Produce an original high-fidelity 3D product render of one open, lidless sci-fi industrial tool storage case, isolated on genuinely transparent alpha. Camera elevation is 45 degrees above the horizontal foam floor and located in front of the case, looking diagonally DOWN into it. This is a horizontal tray on a table, not an upright case or vertical picture frame. The viewpoint is centered with almost no left/right yaw.

Make the perspective unmistakable but natural: a large trapezoid for the interior foam floor, with the FAR / TOP edge about 25 percent shorter than the NEAR / BOTTOM edge. The left and right inner rails visibly angle inward as they recede toward the top of the picture. Show broad top-facing surfaces on the side rails, a deep far inner wall, both inner sidewalls, and a very thick front wall and lower fascia closest to the camera. The front fascia is a solid 8–12 cm deep mechanical mass, its top surface and vertical outer face both visible. Cast real cavity shadows into a charcoal microcellular shock-absorbing foam liner and a grounded contact shadow below the case. Nothing is placed in the foam; leave a large clean planar area for separate HTML tool modules.

Use Hatrix H-3 workshop materials and palette: smoky dark gray-violet and blue-gray segmented armor, brushed anodized metal, narrow copper structural seams, only a few functional amber and cyan edge lights, softly textured high-end foam. Soft directional light from upper left. Wide landscape 3:2 frame, full case visible with breathing room, no clipping. No lid, handle crossing the interior, bits, tools, cubes, socket holes, text, numbers, logos, people, room, opaque backdrop, fisheye lens, diagonal rotation, or flat front-elevation view. Prioritize clear 45-degree camera elevation and true physical volume over decorative detail.
```

### 窄屏 45° 母图

```text
Use case: stylized-concept. Make a portrait companion to the supplied original Hatrix toolbox image. The supplied image is the project's own 45-degree desktop case; match its believable physical materials and camera geometry, while designing a TALL NARROW open case for a responsive web grid. One lidless heavy industrial tray, centered with almost no yaw, camera 45 degrees above its horizontal foam floor looking down from the near/front side. The far/top edge of the open foam is visibly narrower than its near/bottom edge; the left and right rails converge as they recede. Thick front/lower fascia and its top surface are clearly visible, with deep sidewalls and back wall surrounding the recessed charcoal microcellular damping foam. Keep the foam empty, clean and broad, a simple straight-edged trapezoid for separate web modules, with no sockets or objects.

Maintain the Hatrix H-3 workshop palette: dark smoky gray-violet, blue-gray brushed armor, narrow copper structural joins, just a few useful amber and cyan lights. Functional bevels and fasteners, light from upper left, dark contact shadow, genuine transparent background. Portrait 2:3 image with entire case visible and breathing room. The main vertical side-rail sections should have continuous material so a very tall page can extend them without stretching a large isolated screw or mark. No lid, no contents, screwdriver bits, cube, text, logo, numbers, UI, floor, room, people, fisheye lens, front elevation or flat picture-frame silhouette. Preserve a clear 45-degree overhead perspective and heavy 8–12 cm body depth.
```

## 透视箱体修订（2026-10-16）

用户希望看到略微俯视的真实厚度与自然透视。下面两段提示词替代原先的完全正视画面；原提示词保留为历史记录。现有原创箱体仅作为材料、配色与工艺参考，不锁定相机角度或轮廓。

### 桌面透视母图

```text
Use case: stylized-concept. Asset type: isolated transparent foreground equipment case for the Hatrix toolbox page. Use the supplied Hatrix case image ONLY as a reference for its smoky violet-gray and blue-gray armor material, fine copper joints, sparse amber and cyan edge lights, and dense charcoal shock-absorbing foam. Rebuild the case in genuine 3D with a new camera and much more physical depth.

One open, lidless sci-fi industrial equipment tray, viewed from a camera slightly ABOVE and in front of it, looking down about 18–22 degrees, with a very slight 4–6 degree side yaw. Natural coherent perspective: the far edge is a little smaller than the near edge, parallel lines converge subtly, and the visible sidewalls and bottom/front fascia have convincing 8–12 cm physical thickness. Show a broad upper rim and inner wall surfaces, a deep recessed foam bed, bevels, gasket, fastener wells and contact shadows. The NEAR / BOTTOM edge is visibly thick and catches light; the far edge sits behind the deep interior. It should read as a heavy service case on the H-3 co-construction workshop bench, not a flat front panel or picture frame.

Wide landscape composition around 3:2, entire case in view with generous transparent margin, dark neutral contact shadow preserved in alpha. Central foam bed must remain broad, clean, empty, and visually quiet, around 78% of case width and 65% of case height, suitable for a separate 9-column by 5-row grid of live square tool modules. Keep the foam face a simple shallow perspective quadrilateral with near edge only modestly wider than far edge, so the modules can be aligned precisely. Tactile microcellular damping foam, brushed anodized armor, structural copper seams, functional narrow indicator lights, soft upper-left workshop light. Match site colors #17151d, #211e29, blue-gray, gray-violet, copper #d88c3c, sparse #ffd200 and #00ddeb.

No lid, no cover, no screwdriver bits, no tools, no cubes or recess holes, no labels, letters, numbers, logos, UI, person, room, floor, decorative rays, exaggerated fisheye distortion or dramatic diagonal rotation. This is a single physically substantial case with a clean interior prepared for separate web content.
```

### 窄屏透视母图

```text
Use case: stylized-concept. Asset type: transparent portrait equipment case for the narrow-screen Hatrix toolbox. Use the supplied newly rendered Hatrix perspective case ONLY as a reference for materials, palette, lighting and substantial physical depth. Create its tall, narrow companion case, as one open lidless industrial storage tray.

Camera slightly above and in front, looking down about 15–18 degrees, with gentle coherent perspective. Show visible inner walls, a deep charcoal microcellular shock-absorbing foam bed, a thick bottom/front fascia and a modest top rim; the near bottom edge is slightly larger than the far top edge. The central foam face remains a large, clean, empty shallow-perspective quadrilateral taking about 78% of the width and 80% of the height for a separate live grid of square web-tool modules. Vertical side rails should be mostly straight and quiet so that a long responsive case can be built from the image without distorting decorative details. The case has real 8–12 cm physical depth, tactile beveled gray-violet and blue-gray armor, restrained copper seams, minimal functional amber and cyan indicators, soft upper-left light and contact shadows.

Portrait 2:3 composition with all four outer sides visible and genuinely transparent outside. No lid, no cover, no contents, no slots, no blocks, no icons, no letters, no logos, no UI, no person, no room, no floor, no flat picture-frame appearance, no exaggerated fisheye or dramatic camera tilt. Preserve the same H-3 co-construction workshop design language as the supplied case.
```

## 旧版正视箱体母图（已停用）

用途：`/toolbox/` 前景的静态无上盖箱体。箱体和减震内衬由图片提供材料、厚度和光照；排列槽位、工具名称、图标、链接和交互反馈由页面实时绘制，以保证槽位与 39 个工具精确对齐。参考图仅说明工具被内衬紧密包住的关系，不提供箱型、轮廓、槽形、物件、品牌或配色参考。

完整提示词（单独生成一张图）：

```text
Use case: stylized-concept
Asset type: transparent foreground case shell for the toolbox page of the Hatrix Astro website, H-3 co-construction workshop setting
Primary request: an original futuristic industrial mechanical storage case with its entire front face open and no lid or cover, viewed perfectly straight on, orthographic front elevation, symmetrical and rectangular, all four outer sides visible. It is a stationary physical chassis prepared to hold many square software-tool modules later.
Scene/backdrop: isolated product render on a genuinely transparent background; no floor, room, person or other props.
Subject: a rugged but refined shallow compartmented equipment tray. The central 82% of the width and 72% of the height is one continuous, almost flat, uninterrupted high-end shock-absorbing charcoal microcellular foam insert, slightly recessed within the case. Keep this entire central rectangle clean and uniform for precisely aligned HTML/CSS square sockets and modules that will be placed over it. Do not draw any sockets or objects in the foam. The frame has believable depth: pale blue-gray and smoky violet-gray segmented armor panels, dark inset rails, thin copper joins, a few functional fasteners and small release catches. Very limited amber and cyan signal details only at useful edges.
Style/medium: high fidelity original hard-surface 3D product rendering with tactile brushed anodized metal, softly grained dense technical foam, restrained mechanical craftsmanship. Match the Hatrix site palette: dark #17151d and #211e29, blue gray and gray violet chassis, copper #d88c3c, sparse action amber #ffd200 and signal cyan #00ddeb.
Composition/framing: wide landscape, approximately 3:2, the entire case fills most of the image with even transparent breathing room on all sides. True head-on camera, parallel straight horizontal and vertical edges, no vanishing point, no perspective tilt, no rotation, no foreshortening. The inner foam panel must be a simple axis-aligned rectangle with straight uninterrupted edges and ample area for a dense module grid. Lighting from upper left, subtle physical rim shadows, readable dark interior.
Constraints: single static box only; no lid, no handles crossing the interior, no items, cubes, bits, tools, slots, labels, numbers, logos, lettering, UI, people, background, or watermark. Do not resemble the supplied screwdriver-bit case beyond the abstract idea of a snug protective insert.
```

## 旧版手机竖版母图（已停用）

用途：小于等于 560px 时给三列工具网格提供竖向箱体。以桌面母图为本项目内部风格参考，保留相同材料和光照，不沿用第三方参考图的具体形态。

完整提示词（单独生成一张图）：

```text
Create a MOBILE PORTRAIT variant of the supplied original Hatrix case artwork, matching its exact color family, hard-surface material, copper joints, sparse amber and cyan edge lights and straight-on camera. A single lidless futuristic industrial equipment tray standing upright, narrow and tall with all four sides visible, approximately 2:3 portrait overall proportions, genuine transparent background. Its center is one very large clean uninterrupted charcoal shock-absorbing microcellular foam panel; no holes or objects, because a precise grid of square software-tool modules will be rendered over it separately. Keep the inner panel axis-aligned and its width around 78% of the case, height around 83%. Make the vertical rails mostly straight and uniform, with functional corner fasteners and a few thin seams, so this artwork can be used as a responsive frame for a tall column of modules. True orthographic FRONT view, no 3D tilt, no visible top or lid, no branding, text, cubes, bits, tools, logos, people, room or floor. Preserve tactile believable depth and restrained Hatrix co-construction workshop palette.
```

## 图片试作选图与处理（历史）

- 当前桌面母图：`case-source-slots-7x6.png`（1536 × 1024），内含 7 列 × 6 行；窄屏母图：`case-source-slots-3x14.png`（1024 × 1536），内含 3 列 × 14 行。均用 Codex 内置 imagegen 编辑薄壁箱体母图；首次生成数量不符时仅针对多出或缺少的整行定向重试。更早的空内衬母图保留作制作记录。用户提供的批头盒照片仅说明包裹关系，未用作箱体造型或运行时素材。
- 图片方案曾用 Sharp 按 `(left:24, top:62, width:1488, height:876)` 和 `(left:40, top:32, width:944, height:1408)` 裁切为 WebP；运行时已撤下，母图留在本目录用于追溯。
- 先前试作曾通过重复箱体图片的前景裁切遮住方块下半部，视觉上像水平截断，因此改为上文的 GLB 同场景深度遮挡。
