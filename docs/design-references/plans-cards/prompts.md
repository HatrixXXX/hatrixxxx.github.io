# 计划卡片新增素材

既有 `routine.webp`、`contacts.webp`、`knowledge.webp`、`shopping.webp`、`tasks.webp` 是风格参照：H-3 共构舱内的近未来工业工作台、蓝灰金属与铜色接缝、左上方暖光和少量青色状态灯。新图只用作卡片背景；边框、标题、彩虹强调色和图标由页面实时绘制。两图均按竖版 3:4 构图制作，运行时裁切为 `600×800` WebP，卡片下部保留较暗的标题区域。图中不放文字、品牌、徽标、人物或卡片边框。

## 公司信息：`company.webp`

Use case: stylized-concept. Asset type: portrait background artwork for the “公司信息” card in a personal website carousel. Create one 3:4 vertical cinematic near-future photorealistic scene inside the H-3 industrial workshop. The subject is an unbranded company information archive station on a heavy steel workbench: an open dark blue-gray metal dossier case with several neatly arranged blank data cartridges and slim document sleeves, a compact mechanical index reader beside it, precise copper fasteners and subtle cyan status lights. In the distance, show the same kind of layered machinery, gantry structure and hazy city daylight seen in a lived-in engineering workshop. Three-quarter camera angle at workbench height; a clearly readable physical object in the central and upper portion. Warm daylight enters from the upper left, with restrained gold reflection and deep blue-gray shadows. Rich realistic brushed metal, worn edges and believable depth, not a flat UI mockup. Let the lower quarter fall into a naturally dark tabletop area so live title text can sit over it. No readable writing, labels, logos, emblems, company names, people, paper documents with text, screens full of UI, rainbow wash, card border or watermark.

## 代办清单：`todo.webp`

Use case: stylized-concept. Asset type: portrait background artwork for the “代办清单” card in a personal website carousel. Create one 3:4 vertical cinematic near-future photorealistic scene inside the H-3 industrial workshop. The subject is a physical task-queue organizer on a blue-gray steel workbench: several staggered blank metal task tickets slotted into a compact rail, a few small movable check markers, and one detached blank ticket resting nearby. Make the silhouette and layered slots clear at card size, distinct from a clipboard or clock. Show copper hinges, screws, realistic wear, a few tiny cyan device indicators, background gantry machinery and soft hazy city daylight. Three-quarter close view at workbench height; central and upper portion carries the organizer. Warm light from upper left, subdued cool shadows, realistic materials and volumetric depth matching the existing plan-card scene series. Leave the lower quarter naturally dark and relatively quiet for live title text. No readable writing, labels, logos, emblems, people, clipboard, clock, giant screen, floating hologram, rainbow wash, card border or watermark.

## 输出记录

- 选用母图：`company-source.png`、`todo-source.png`，均由 Codex 内置 imagegen 按上方对应提示词生成并从默认目录移入本目录。
- 处理方式：使用项目已有 Sharp，以居中 `cover` 裁切缩放为 `600×800`，WebP 质量 84、压缩 effort 6；母图保留在本目录。
- 运行时路径：`public/assets/plans-cards/company.webp`、`public/assets/plans-cards/todo.webp`。
- 同系列图标使用仓库现有的 `64×64` 单色 SVG 轮廓风格，由代码绘制，不使用位图生成。
