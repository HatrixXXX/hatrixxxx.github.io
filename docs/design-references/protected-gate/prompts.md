# Protected gate visual asset

## Asset: lock core crown

**Purpose and layers:** A single transparent, decorative metal lock core sits above the real unlock form. It supplies material and depth; Astro and CSS render every heading, field, choice, button, focus ring, and status message. The image has no content window and is never stretched out of proportion. At runtime it displays around 260 × 110 px on desktop and scales down proportionally on mobile.

**Prompt (one image):**

> Use case: stylized-concept. Asset type: transparent foreground ornament for a personal site's encrypted-content form. Create one wide, symmetrical, front-facing 3D render of a compact mechanical lock-core crown from a mecha test chamber. It is a tangible metal object, not a complete UI panel: a central sealed polygonal core with a narrow amber light slit, restrained concentric hardware, two short side wings with clean chamfered joints, dark charcoal-violet and blue-gray brushed titanium, thin warm copper seams, and only tiny cyan signal pinpoints. Light from upper left, subtle warm reflected light from the core, realistic milled edges and shallow recesses. Keep the silhouette clean and horizontally balanced, about 3:1, with generous transparent margin around every edge and a straight lower docking edge. Genuine transparent background and crisp alpha, no cast shadow outside the object. No text, letters, numbers, logo, padlock icon, key, person, hand, interface control, form field, button, excessive glow, or surrounding scene. The center must remain legible at roughly 260 px displayed width. Match the site's `DESIGN.md` mecha test-chamber materials and tokens `#17151d`, `#211e29`, `#d88c3c`, `#ffd200`, and sparing `#00ddeb`; do not copy any existing site artwork.

**Selected source:** `lock-core-crown-source-v1.png`, generated with Codex built-in imagegen. The source is a 2172 × 724 transparent PNG; its alpha was inspected before processing.

**Processing and runtime:** Sharp trims transparent margins, resizes to 960 px width without stretching, then exports transparent WebP at quality 86 and alpha quality 90. Runtime asset: `public/assets/protected-gate/lock-core-crown.webp` (960 × 237, about 52 KB).

## Asset: panel alloy surface

**Purpose and layers:** Opaque low-contrast material beneath the live form. CSS draws the precise outer border, inner seam, depth shadow, and all states. The texture must tolerate cropping from a desktop panel around 496 × 393 px to a mobile panel around 358 × 355 px; no meaningful feature may depend on an edge.

**Prompt (one image):**

> Use case: stylized-concept. Asset type: crop-safe raster material for the backing plate of an encrypted-content control panel. Create a close-up, straight-on orthographic material study of dark charcoal-violet and blue-gray anodized titanium, with extremely fine directional brushing, subdued milled variation, faint wear only inside the material, and a restrained upper-left cool reflection. The field is continuous and low contrast across the entire image, with no built-in border, frame, screws, corner accents, center emblem, panel geometry, text, logo, symbols, form controls, or bright lights. This is a material surface, not a complete UI screenshot. It will sit behind live white text and controls, so keep the middle especially calm and dark. Match the existing site's `#17151d`, `#211e29`, `#2c2735` metal world and the lock-core crown's blue-violet material; keep copper and cyan out of this image because CSS supplies exact signal accents. Fill the entire rectangular image, no transparency, no shadows beyond the image, crop-safe on every side.

**Selected source / processing / runtime:** `panel-alloy-source-v1.png` (1536 × 1024). Sharp resizes proportionally to 960 × 640 and exports quality-82 WebP as `public/assets/protected-gate/panel-alloy.webp` (about 33 KB). CSS crops it beneath a translucent dark overlay; the real panel border remains CSS.

## Asset: password well material

**Purpose and layers:** Dark, shallow machined cavity inside the real password input. The input's border, caret, focus ring, text, and dimensions remain CSS/browser-native. The image supplies only recess material and can be center-cropped across widths from about 430 px to 244 px at 51 px high.

**Prompt (one image):**

> Use case: stylized-concept. Asset type: crop-safe raster material for the interior of a password input on a dark mecha test-chamber site. Show a straight-on extreme close-up of a nearly black blue-violet recessed alloy channel: fine horizontal machining, soft depth from a darker upper lip to a subtle cool lower reflection, tiny realistic surface imperfections, no individual object or readable feature. The center must remain dark and uniform enough for live typed characters. No painted border, rounded rectangle, screws, slot outline, placeholder text, glyph, digits, cursor, keyhole, glow, copper line, cyan light, logo, or surrounding scene. It is only the inner material; CSS supplies the exact input border and states. Palette near `#10121b` and `#19161f`, with only muted blue-gray reflection. Wide landscape composition, full bleed opaque image, safe to crop heavily from top and bottom and at either side.

**Selected source / processing / runtime:** `password-well-source-v1.png` (2073 × 758). Sharp resamples the non-geometric material to a 960 × 160 strip and exports quality-82 WebP as `public/assets/protected-gate/password-well.webp` (about 5 KB). CSS handles the cavity border, focus ring and live input.

## Asset: amber release key surface

**Purpose and layers:** Luminous but readable material beneath the live “解锁” button text. CSS supplies the accurate button border, bevel, hover, pressed, disabled and keyboard focus states. The material is center-cropped within a roughly 430 × 52 px desktop button and narrower mobile buttons.

**Prompt (one image):**

> Use case: stylized-concept. Asset type: crop-safe raster face material for a primary unlock button. Make a straight-on close-up of warm amber anodized metal with a subtle directional brushed grain and a controlled pale-gold reflection along the upper part, shifting into deeper honey-gold toward the lower part. Keep contrast gentle and the central field uniform so dark live button text stays highly legible. No complete button silhouette, border, rounded corners, icon, label, letters, numbers, key, lock, screws, decorative symbols, cyan elements, dark spots, bloom, or surrounding scene. This is a full-bleed material field only; CSS provides the exact control shape and interaction states. Match the site's `#ffd200`, `#ffe360`, `#d88c3c` accent family without making it orange. Wide landscape opaque image that can be cropped across desktop and phone widths.

**Superseded source / processing:** `amber-key-source-v1.png` (1672 × 941). Sharp resampled it to a 960 × 160 quality-84 WebP. The unused v1 runtime derivative was moved out of `public/` to `amber-key-v1.webp` in this design-reference directory (about 6 KB). Its uniform bright-gold face did not match the surrounding dark mechanical housing closely enough.

## Asset: amber release key surface v2

**Purpose and layers:** Replace the overly uniform bright-gold v1 button face. The new bitmap gives the button a dark titanium housing around a restrained amber action field, echoing the existing lock-core crown. CSS still owns exact border dimensions, keyboard focus, hover, pressed and disabled states; the two-character button label remains live and centered. The central horizontal band will be cropped into a wide strip without stretching discrete hardware.

**Prompt (one image):**

> Use case: stylized-concept. Asset type: front-facing horizontal material plate for the primary unlock button of Hatrix's dark mecha test-chamber site. Create a wide, low-profile physical actuator surface viewed perfectly straight on: a calm warm-amber enamel center framed visually by dark charcoal-violet and blue-gray titanium shoulders toward the two ends, with restrained copper joining seams and subtle milled depth. Use the same material family as an existing compact blue-gray lock-core crown with a narrow amber light slit. The middle 65–70% must be a fairly uniform, moderately bright amber region so small dark live Chinese text remains easy to read; side shoulders and lower edge provide depth without becoming black holes. Put all important material cues in the central horizontal band because it will be cropped vertically into a 6:1 UI strip. Keep a horizontally balanced silhouette and enough plain surface to crop across desktop and mobile button widths. No text, numbers, logo, icon, keyhole, padlock, full website mockup, standalone button shadow, screws, large bright white streak, glitter, wood grain, orange plastic, loud sci-fi glow, or separately raised end caps. Full-bleed opaque image. Palette: `#17151d`, `#2c2735`, muted blue-gray titanium, thin `#d88c3c` copper, controlled `#ffd200` amber. The result should look like a machined control in this site, not a generic yellow gradient button.

**Superseded source / processing:** `amber-key-source-v2.png` (2172 × 724), generated with Codex built-in imagegen. Sharp cropped a centered 2172 × 362 strip (top 181), resized it to 960 × 160, then split it into 160 px left and right metal ends plus a 640 px central amber field. The quality-85 derivatives were moved out of `public/` to `amber-key-v2-left.webp`, `amber-key-v2-center.webp`, and `amber-key-v2-right.webp` in this directory. Their simpler shoulder plating was replaced by the H-3 release actuator below.

## Asset: checkbox socket

**Purpose and layers:** One transparent miniature pressed-metal socket shared by “显示 key” and “7 天免解锁”. It will display at about 18 × 18 px, with CSS drawing a clear gold checked fill and check mark above it. The image must survive downsampling without tiny independent details.

**Prompt (one image):**

> Use case: stylized-concept. Asset type: a single transparent-background miniature checkbox socket for a mecha control console, viewed exactly front-on with a square silhouette. Make a simple dark blue-violet recessed center bounded by a thin but physical warm-copper machined bezel, tiny top-left edge reflection, and visible lower-right depth. Strong clean silhouette and restrained contrast that remain legible at 18 px. No tick or check mark, no active gold fill, text, numbers, icon, logo, screws, keyhole, surrounding panel, drop shadow outside the socket, or elaborate microdetails. Preserve a square outer shape with modest transparent margin, genuine clean alpha. Match the site's dark titanium and copper materials. The generated raster provides only the unselected socket; CSS draws the selected state and accessible focus ring.

**Selected source / processing / runtime:** `checkbox-socket-source-v1.png` (1254 × 1254). Sharp trims alpha margin, downsamples to 72 × 72, slightly reduces saturation, and exports quality-90/alpha-quality-95 WebP as `public/assets/protected-gate/checkbox-socket.webp` (about 2 KB). Both checkboxes reuse it at about 18 px; CSS draws the gold checked fill, check mark and focus state.

## Asset: industrial release actuator v3

**Purpose and layers:** A replacement material assembly for the real unlock button. Dark end clamps and a quieter amber actuator face create the sense of a thumb-operated release built into the H-3 control console. The live button retains its label, dimensions, focus outline, hover, pressed, and disabled states. The generated source must tolerate slicing into rigid ends and one horizontally adaptable central field for desktop and mobile widths.

**Prompt (one image):**

> Use case: stylized-concept. Asset type: front-facing, wide 3D material assembly for the real primary unlock button of the H-3 co-assembly test-bay console. Generate one perfectly orthographic horizontal mechanical release actuator, centered and bilaterally symmetrical, approximately 3:1 canvas with a low, wide component across the middle horizontal strip. Its outer 16–20% on each side is substantial interlocking charcoal-violet and blue-gray milled titanium: overlapping removable armour plates, stepped bevels, recessed seams and a few functional copper guide edges, visibly deeper and more industrial than a simple dark shoulder. Between them is a broad inset amber-gold pressed-metal thumb plate, a shallow physical recess with directional brushing and a restrained upper reflection. Keep the middle 55–60% of the image quiet, uniform moderately bright amber with no hardware or markings: dark live Chinese button text is placed there by CSS. Add only two tiny cyan status pinpoints near the outer shoulder seams, never near the text. Match reference image 1 for site material, warm/cool balance and precise mechanical craft; reference image 2 is only the current layout to improve upon, not a shape to copy. The H-3 world uses maintainable release hardware, not fantasy energy devices. Parallel horizontal top and bottom edges, level joins, exact symmetry, straight-on lighting from upper left; all hardware must remain wholly in the end regions so it will never be stretched. Deep graphite-purple #17151d, raised alloy #2c2735, copper #d88c3c, controlled amber #ffd200, very sparse cyan #00ddeb. Full-bleed opaque dark background outside the middle component, generous vertical crop allowance. No text, lettering, numbers, logo, icon, keyhole, padlock, hand, screws in the central field, diagonal tilt, perspective, surrounding webpage, yellow plastic, broad neon glow, white flare or decorative fake gauges. Input image 1 is the existing lock-core crown style reference. Input image 2 is the prior button layout reference. Create a NEW design, not an edit of either.

**Selected source / processing / runtime:** `industrial-release-source-v3.png` (2172 × 724), generated with Codex built-in imagegen using the existing lock-core crown as a material reference and v2 button only as a layout reference. Sharp cropped a 2172 × 362 strip from top 165, resized it to 960 × 160, and split it into a 210 px left end, 540 px quiet center, and 210 px right end. Quality-86 runtime WebPs are `public/assets/protected-gate/industrial-release-left.webp`, `industrial-release-center.webp`, and `industrial-release-right.webp` (about 22 KB combined). CSS sizes the rigid ends by height and adapts only the central field to the real button width; text and interaction states remain live.
