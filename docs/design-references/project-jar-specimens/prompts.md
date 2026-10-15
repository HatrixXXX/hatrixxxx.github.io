# Project glass jar specimens: prompts and processing record

Each of the 15 assets was generated or edited separately with built-in imagegen. Selected PNG masters are in this directory; Sharp-derived transparent WebP files are in `public/assets/project-jar-specimens/`. Original photos in `public/assets/project-images/` remain in the detail carousel. Every runtime image is 1024 x 1536. The jar overlays the specimen, whose lower edge stays above the metal base.

## Images 01-05

All five assets use the built-in imagegen editing tool, with the named existing project image as the sole edit target. Each prompt stands alone. Selected transparent PNG masters live beside this file as `<name>-source.png`; runtime derivatives live in `public/assets/project-jar-specimens/<name>.webp`. The target is a roughly 2:3 portrait canvas with true alpha, for an individual item displayed inside the project's glass jar. Preserve each source subject's identifying details; leave enough transparent margin around its silhouette. No captions, stands, glass jar, added scenery, ground shadow, border, or watermark.

### 01 — fpga-3dgs

Input image: `public/assets/project-images/fpga-3dgs-01.webp`, edit target.
Initial master: `fpga-3dgs-source.png`; selected revision: `fpga-3dgs-source-v2.png`; runtime: `public/assets/project-jar-specimens/fpga-3dgs.webp`. The initial prompt below is superseded by the revision prompt at the end of this file.

```text
Use case: background-extraction.
Asset type: transparent portrait specimen for a website glass jar.
Primary request: Isolate the large left display showing the small yellow bulldozer and the FPGA circuit board beneath it. Arrange the existing display above the board as a coherent two-part exhibit so both fit a roughly 2:3 vertical canvas; keep their identity, viewpoint, proportions, visible electronic components, yellow bulldozer imagery and dark screen intact. The board may move closer to the display, without merging the objects.
Scene/backdrop: genuinely transparent alpha; the room, desk, other computer display, cables and monitor arm are removed where they do not belong to the two requested objects.
Composition/framing: whole display and whole board visible with a small even clear margin. Do not stretch the screen or board to fill the portrait shape.
Constraints: preserve fine screen and board details from the input image as faithfully as possible. No new parts, no reimagining the bulldozer, no captions, no platform, no background, no jar, no cast shadow, no halo.
```

### 02 — robomaster

Input image: `public/assets/project-images/robomaster-01.webp`, edit target.
Selected master: `robomaster-source.png`; runtime: `public/assets/project-jar-specimens/robomaster.webp`.

```text
Use case: background-extraction.
Asset type: transparent portrait specimen for a website glass jar.
Primary request: Extract only the central blue RoboMaster competition robot. Keep its exact pose, perspective, wheels, armor plates, number 3, shooter and visible mechanical details. Do not redesign it.
Scene/backdrop: genuinely transparent alpha; remove the court, blue barrier, loose yellow balls and partial robot at the left edge.
Composition/framing: center the full robot on a roughly 2:3 portrait canvas, with clear margins on all sides; keep natural proportions rather than stretching it.
Constraints: preserve source colors, lighting and fine edges. No extra props, labels, duplicated parts, ground plane, shadow, halo, border, watermark, or glass jar.
```

### 03 — quadrotor

Input image: `public/assets/project-images/quadrotor.webp`, edit target.
Selected master: `quadrotor-source.png`; runtime: `public/assets/project-jar-specimens/quadrotor.webp`.

```text
Use case: background-extraction.
Asset type: transparent portrait specimen for a website glass jar.
Primary request: Extract only the central four-rotor drone, including all four motors, propellers, guards, exposed electronics, camera, landing legs and wiring. Keep its original geometry and viewpoint exactly, without redesign or added components.
Scene/backdrop: genuinely transparent alpha; remove all paving and ground shadow.
Composition/framing: fit the complete drone into a roughly 2:3 portrait canvas with a small clear margin. Keep its wide natural silhouette within the portrait canvas; do not compress, bend, or cut off the outer guards and propellers.
Constraints: preserve real photographic texture, relative position of all parts and source colors. No stand, flight effects, captions, duplicate propellers, halo, border, watermark, or jar.
```

### 04 — car-series

Input image: `public/assets/project-images/car-series-02.webp`, edit target.
Selected master: `car-series-source.png`; runtime: `public/assets/project-jar-specimens/car-series.webp`.

```text
Use case: background-extraction.
Asset type: transparent portrait specimen for a website glass jar.
Primary request: Extract only the small wheeled robot car in the center. Preserve the stacked circuit boards, yellow support structure, hanging multi-colored wires, four small wheels and their exact spatial relationship. Do not redesign the vehicle.
Scene/backdrop: genuinely transparent alpha; remove desk, computer, mat, containers and cables that are not part of the car.
Composition/framing: center the complete car on a roughly 2:3 portrait canvas with a small clear margin, natural proportions and original camera viewpoint.
Constraints: preserve individual wires and mechanical edges. No new parts, pedestal, captions, ground plane, cast shadow, halo, border, watermark, or jar.
```

### 05 — lab-wall

Input image: `public/assets/project-images/lab-wall.webp`, edit target.
Selected master: `lab-wall-source.png`; runtime: `public/assets/project-jar-specimens/lab-wall.webp`.

```text
Use case: background-extraction.
Asset type: transparent portrait specimen for a website glass jar.
Primary request: Isolate the central rectangular laboratory culture display board as one intact object. Retain its pinned photos, posters, colorful decorations and collage layout in their original relative positions. Crop away side wall areas and peripheral objects. Make a compact, portrait-oriented presentation only by trimming the margins and placing the intact board on a roughly 2:3 transparent canvas; do not distort the board or reflow its individual contents.
Scene/backdrop: genuinely transparent alpha outside the board. Remove surrounding wall, outlets, shelf objects and any other exterior scene.
Composition/framing: board centered and fully visible with narrow transparent margins. Keep the board's own shape and edges accurate rather than stretching it to the canvas ratio.
Constraints: preserve source content and its relative positions as faithfully as possible. No invented photos, text, decorations, side panels, frame, shadow, halo, watermark, or jar.
```

## Images 06-10

These five assets were made with the built-in `imagegen` editor/generator. Each prompt below is complete and produces one independent image. The selected 1024 × 1536 PNG master is in this directory; Sharp converted it losslessly to the corresponding transparent WebP in `public/assets/project-jar-specimens/`. All surrounding canvas pixels remain transparent. The PNG masters are retained for possible revisions.

### 06 · Armor keychains

- Input edit target: `public/assets/project-images/armor-keychain.webp`
- Master: `armor-keychain-source.png`
- Runtime: `public/assets/project-jar-specimens/armor-keychain.webp`

> Use case: background-extraction. Asset: transparent specimen for a website glass jar, approximately 2:3 portrait canvas. Image 1 is the edit target. Extract exactly ONE red-lit square armor keychain and exactly ONE blue-lit square armor keychain from the source, with their existing dark plaques, central white outline motifs, side LED bars, rings and short chains. Arrange the two separate keychains in a compact, balanced vertical composition so both are fully visible with a little transparent padding. Preserve their real photographic materials, original motifs, LED colors and individual construction details; no redesign, no extra copies, no background surface, no cast shadow, no labels, no glass jar. Genuine transparent alpha background, clean edges.

### 07 · Wheel-leg keychain

- Input edit target: `public/assets/project-images/wheel-leg-keychain.webp`
- Master: `wheel-leg-keychain-source.png`
- Runtime: `public/assets/project-jar-specimens/wheel-leg-keychain.webp`

> Use case: background-extraction. Asset: transparent specimen for a website glass jar, approximately 2:3 portrait canvas. Image 1 is the edit target. Extract the SINGLE antique gold-and-black mechanical wheel-leg robot keychain in the middle, including the gold chain and ring at its top. Preserve the actual intricate die-cast machinery, wheel positions, color, proportions, metallic wear and original viewpoint. Show the whole keychain centered and fully visible, with small transparent padding. Remove the wooden tabletop and all background. Genuine transparent alpha, clean edges, no invented duplicate, no restyling, no text, no glass jar.

### 08 · PCB ruler

- Initial edit target: `public/assets/project-images/rm-ruler-01.webp` (superseded)
- Initial master: `rm-ruler-source.png`; selected revision: `rm-ruler-source-v2.png` from `public/assets/project-images/rm-ruler-02.webp`
- Runtime: `public/assets/project-jar-specimens/rm-ruler.webp`

> Use case: background-extraction. Asset: transparent specimen for a website glass jar, approximately 2:3 portrait canvas. Image 1 is the edit target. Extract exactly ONE of the long, slim black PCB rulers with gold circuit illustrations and printed measurement scale from the source photo. Rotate that single rigid ruler to a near-vertical orientation, slightly diagonal if needed to fit the portrait frame. Preserve its straight shape, dark PCB surface, original gold traces, graduations and white marks as closely as possible. Show full length and both ends with narrow clear padding; no other rulers, keyboard, table or props. Do not bend, shorten or redesign the ruler. Genuine transparent alpha background, clean edges, no text added, no glass jar.

### 09 · Three-year summary

- Source screenshot for context only: `public/assets/project-images/three-year-summary.webp`
- Master: `three-year-summary-source.png`
- Runtime: `public/assets/project-jar-specimens/three-year-summary.webp`

> Use case: stylized-concept. Asset: a single transparent specimen representing a personal article summarizing three undergraduate years, displayed inside a website glass jar. Create a compact, tangible editorial object: three slightly staggered bound notebook folios joined into one upright keepsake, with a restrained mechanical/circuit sketch and a small pen tucked against the pages. Subtle visual progression across the three folios suggests three years of robotics learning and reflection. Photorealistic paper, dark graphite cover, warm brass hardware, tiny cyan circuit accents; calm reflective mood. Approximately 2:3 portrait composition, whole object visible, centered, narrow transparent padding. No readable text, numbers, logos, people, background, platform, cast shadow or glass jar. Genuine transparent alpha and clean cutout edges.

### 10 · COCONET

- Input edit target: `public/assets/project-images/conet.webp`
- Master: `conet-source.png`
- Initial version, retained for comparison: `conet-v1-source.png`
- Runtime: `public/assets/project-jar-specimens/conet.webp`

> Use case: precise-object-edit / ui-mockup. Asset: isolated portrait website interface specimen for display inside a glass jar. Image 1 is the edit target: the COCONET desktop app screenshot. Recompose its EXISTING interface into a coherent approximately 2:3 upright application panel while preserving the exact pale cream background, sunny yellow/orange palette, warm sidebar, top COCONET brand area, folder and document icons, calendar widget, and yellow TODO cards. Adapt layout like a responsive portrait app: compact top brand bar, narrow left navigation rail, a central folder/document grid with fewer columns, and calendar plus TODO cards stacked lower in the panel. Keep its utilitarian flat UI appearance and fine icon details; do not introduce new features, brands, decorative objects, perspective tilt, glass jar or scene. Panel straight-on, all four edges visible, transparent alpha outside the panel. Treat existing visible words as reference, avoid replacing them with new nonsensical text.

The selected master was refined with this independent follow-up prompt, using `conet-v1-source.png` as Image 1 and the original `public/assets/project-images/conet.webp` as Image 2:

> Use case: precise-object-edit. Image 1 is the portrait COCONET interface edit target; Image 2 is the original screenshot used ONLY to verify existing text and UI details. Keep Image 1's exact upright panel geometry, responsive layout, yellow/cream palette, icons, folder grid, calendar and TODO placement, transparency outside the panel. Correct ONLY inaccurate or invented small labels and calendar information by closely transcribing Image 2. Sidebar labels must be 我的笔记, 新建笔记, 新建文件夹, 搜索, 回收站, 开发文档, 使用帮助. Folder labels must read 程序设计, 读书笔记, 好吃的, 活动记录, 流体传动, 往年试题, 我爱园艺, 追梦战队. Retain the original document labels when legible, and preserve the November 2024 calendar and three yellow TODO rows. Keep brand title exactly COCONET. Change no other colors, proportions, or features. No new wording, no decorative objects, no background, no glass jar. Genuine transparent alpha outside the panel.

Small UI labels, calendar dates, and some ruler markings are approximate generation rather than a faithful transcription of the source. These assets are intended as small visual specimens, not as readable documents or measurement tools.

## Images 11-15

模式：Codex 内置 `imagegen`，每件单独调用，`transparent_background: true`；以对应项目原图作为编辑目标，唯电控手册为新图。母图保存在本目录，运行时用 Sharp 转为 `public/assets/project-jar-specimens/` 下同名 WebP。画布均为 1024 × 1536。以下为各件可独立使用的完整提示词。

### 11. 电控入门手册

- 输入：无；原项目图 `public/assets/project-images/infantry-handbook.webp` 仅用于确定“电控入门手册”主题，未作为生图输入。
- 母图：`infantry-handbook-source.png`
- 运行时：`public/assets/project-jar-specimens/infantry-handbook.webp`

```text
Use case: product-mockup. Asset type: isolated specimen inside a website glass jar, portrait 2:3 canvas. Create a new image representing an introductory electrical-control handbook for a robotics team: one physical, slightly open technical handbook, viewed three-quarter front, with a dark navy cover, restrained cyan and warm amber circuit traces, and an inside page showing a clear block diagram of a controller, power board, motor driver, sensors and connection lines. It should read visually as a practical beginner's engineering manual, not a random sci-fi book. No lettering or numerals; diagrams may use shapes and connection lines. Preserve realistic book thickness, page edges, believable printed-paper texture, and coherent perspective. Center the single book with generous transparent margin all around; no table, background, pedestal, shadow plane, secondary objects, watermark, or border. Actual transparent alpha background, crisp cutout. Full book visible and occupying most of the portrait frame.
```

### 12. 涂装小老鼠

- 编辑目标：`public/assets/project-images/painted-mouse.webp`
- 母图：`painted-mouse-source.png`
- 运行时：`public/assets/project-jar-specimens/painted-mouse.webp`

```text
Use case: background-extraction. Asset type: isolated project specimen inside a website glass jar. Input image is the edit target. Extract only the small painted mouse figurine in the center of the reference photo, including its round display base. Retain the original sculpt, gray ears, helmet, blue scarf, brown armor, the pose with a thin sword in each paw, paint wear, proportions, expression, and all visible details as faithfully as possible. Remove the keyboard, paint bottle, brush, desk and entire background. Do not add or redesign any part of the mouse. Place the single complete figurine centered on a 2:3 portrait canvas with small transparent breathing room, no cut-off ears, swords or base. Genuinely transparent alpha outside its silhouette; no dark halo, floor, pedestal, cast shadow, text, watermark or extra objects. Preserve photographic realism.
```

### 13. 纸模心形与盒子

- 编辑目标：`public/assets/project-images/paper-models-01.webp`
- 母图：`paper-models-source.png`
- 运行时：`public/assets/project-jar-specimens/paper-models.webp`

```text
Use case: background-extraction. Asset type: isolated project specimen inside a website glass jar. Input image is the edit target. Extract the single connected handmade paper sculpture in the center: its white faceted heart-shaped upper structure, the slender pink rod supporting it, and the white cube box underneath with its protruding folded-paper tab. This is ONE inseparable object. Preserve the heart directly above the box, the exact relative position, rod alignment, physical proportions, angular folds, cut-paper details, and original viewpoint. Do not split, reposition, rotate or redesign the two parts. Remove the wall, wooden tabletop, side object and entire background only. Center the full sculpture on a 2:3 portrait canvas with transparent breathing room. Genuinely transparent alpha outside the complete sculpture, clean edges, no floor, cast shadow, halo, text, watermark, border or new objects. Maintain a natural photo look and near-white paper without erasing edge detail.
```

### 14. 个人网站

- 编辑目标：`public/assets/project-images/personal-website.webp`
- 母图：`personal-website-source.png`
- 运行时：`public/assets/project-jar-specimens/personal-website.webp`

```text
Use case: precise-object-edit. Asset type: vertical website specimen displayed inside a glass jar. Input image is the edit target and sole visual source. Reformat this existing dark personal-blog website screenshot into ONE portrait 2:3 website interface, shown straight-on as a thin clean browser/app panel with a genuinely transparent exterior. Preserve the screenshot's near-black left navigation, chocolate-brown content surface, deep red header strip, warm amber/orange text and accents, small circular cake-like profile picture, search capsule, two article cards, small cup image in the upper article, footer line and small icons. Recompose the wide desktop content into a narrower portrait view: top header across the panel, left menu still visible as a narrow column, article cards stacked vertically with ample original dark-brown space underneath, footer at the bottom. Keep page details and palette from the source; do not invent a different site, unrelated content, additional images, or a modern white mobile UI. Do not need newly legible tiny copy; preserve existing visual text density without new slogans. Square, crisp UI edges, entire panel visible, centered on 2:3 canvas with small transparent margins. Actual transparent alpha outside the panel; no floor, surrounding room, cast shadow, glow halo, text outside the screen, watermark or border.
```

### 15. 竖立的 USB 设备

- 编辑目标：`public/assets/project-images/usb3-hub.webp`
- 初版母图：`usb3-hub-source.png`；选用修订版：`usb3-hub-source-v2.png`
- 运行时：`public/assets/project-jar-specimens/usb3-hub.webp`

```text
Use case: background-extraction. Asset type: isolated project specimen inside a website glass jar. Input image is the edit target. Extract ONLY the upright narrow USB 3 hub/device on the RIGHT side of the original image, with its black enclosure, four vertically stacked blue USB ports on the left-facing side, transparent screwed-on front plate and the small blue-haired character graphic visible behind that plate. Preserve its original three-quarter viewing angle, shape, dimensions, position of every port, screws and front graphic as closely as possible. Do not include the larger low horizontal hub on the left, its cable, the black backdrop, support surface or any extra object. Center the entire right-hand device on a portrait 2:3 canvas with small transparent margins. Genuinely transparent alpha outside its silhouette; no dark halo, studio background, floor, cast shadow, glow, text, watermark or border. Realistic photographic object texture and clean transparent edges.
```

### 检查与已知偏差

五张 WebP 均由对应母图直接经 Sharp 转码，保留 alpha；白底与深底合成预览用于检查边缘。第 12 张是模型重绘的近似小老鼠，而非原照片像素级抠图；盔甲、脸部及比例有轻微变化。第 14 张保留原网页的配色、导航、卡片结构，但较小文字及页脚内容被模型重绘，不能当作原网页的精确截图。第 15 张正面角色图像也发生一定重绘。需要逐像素保真时，应另行制作精确蒙版并从原图提取。

## Selected revisions: 01, 08, and 15 (2026-10-15)

The three selected revisions use built-in `imagegen` with genuine transparent output. Each 1024 x 1536 PNG master was moved from the default generation directory to this directory immediately, then encoded with Sharp as a WebP at quality 90 and alpha quality 100. The original project photos and initial generated masters remain unchanged. Each following prompt was executed separately.

### 01 — FPGA screen and board, selected revision

Inputs: `fpga-3dgs-source.png` (the previous cutout edit target; its runtime WebP was supplied during generation) and `public/assets/project-images/fpga-3dgs-01.webp` (original photo reference). Selected master: `fpga-3dgs-source-v2.png`; runtime: `public/assets/project-jar-specimens/fpga-3dgs.webp`.

```text
Use case: precise-object-edit / background-extraction. Asset: transparent 2:3 portrait specimen for a small website glass jar. Image 1 is the edit target, the existing cutout; image 2 is the original photo solely to preserve the real monitor, yellow bulldozer on screen, and FPGA board details. Keep exactly two separate subjects: the curved dark monitor above and the FPGA circuit board below. Reduce the monitor's overall visual width and height compared with Image 1, crop the display framing closer around its yellow bulldozer, and make the bulldozer visibly larger within the screen; keep a believable monitor bezel and the source bulldozer's form. Place the monitor slightly left of center and the board slightly right of center, a subtle horizontal stagger, while retaining a balanced vertical composition and a clear gap between them. Both objects fully visible, natural proportions, no stretching or added parts. Keep the board's visible components and green color faithful to the original. Canvas 1024x1536 or approximately 2:3 portrait with generous but not excessive clear margin. True transparent alpha everywhere outside the two objects; no black backdrop, glow, cast shadow, floor, jar, text, watermark, or third object.
```

### 08 — PCB ruler from the corrected source, selected revision

Input: `public/assets/project-images/rm-ruler-02.webp` (sole edit target). Selected master: `rm-ruler-source-v2.png`; runtime: `public/assets/project-jar-specimens/rm-ruler.webp`.

```text
Use case: background-extraction / precise-object-edit. Asset: one transparent 2:3 portrait specimen for a website glass jar. The input photo is the sole edit target. Isolate exactly ONE long black PCB-style RoboMaster ruler shown against the blue background. Remove every bit of the blue background and the small top caption. Rotate the ruler as one rigid physical object from its original near-horizontal diagonal orientation to a mostly upright vertical orientation, with a subtle 5–8 degree natural lean for depth. Keep the same face of the ruler visible, its long straight rectangular outline, end holes, black solder-mask surface, gold printed circuit artwork and original printed marks, logos and tiny lettering as faithfully as the source resolution permits. Do not replace the source ruler with a different measuring ruler or invent a new scale, numbers, icons, parts, patterns, or circuitry. Do not bend, taper, crop, duplicate, or distort it. Center the full ruler on a 1024x1536 (approximately 2:3) transparent canvas with modest clear margin at top and bottom. True transparent alpha outside the ruler silhouette; no gray or brown backdrop, shadow, glow, floor, jar, frame, or watermark.
```

### 15 — USB hub angle, selected revision

Inputs: `usb3-hub-source.png` (the previous cutout edit target; its runtime WebP was supplied during generation) and `public/assets/project-images/usb3-hub.webp` (original photo reference). Selected master: `usb3-hub-source-v2.png`; runtime: `public/assets/project-jar-specimens/usb3-hub.webp`.

```text
Use case: precise-object-edit / background-extraction. Asset: isolated USB hub for a website glass jar, 2:3 portrait transparent canvas. Image 1 is the current cutout edit target; Image 2 is the original photo used to preserve the real device's construction and character graphic. Keep only the upright narrow USB hub from the right side of the original, with four vertically stacked blue USB 3 ports, black enclosure, clear screwed-on front plate, and blue-haired character visible beneath it. Adjust the camera viewpoint to be closer to a frontal three-quarter view: the clear character front panel should face the viewer much more directly and dominate the visible width, while a slimmer strip of the left side remains visible so all four USB ports can still be seen. About a subtle 15–20 degree turn, not a perfectly flat front view. Keep the device vertical, straight, physically plausible, centered, and fully visible. Preserve the original port count, screw positions, materials, lighting, and graphic as faithfully as possible. True transparent alpha outside the exact device silhouette; no dark background, floor, cast shadow, glow, extra cables or hubs, text, jar, or watermark.
```

Imagegen can redraw tiny print and character details; these selected files are visual specimens rather than pixel-exact extractions.
