# SENTRACKER image prompts

All four final assets were generated with the built-in image generation tool and
saved locally as optimized WebP files. The first image is the product anchor; all
later prompts use it as an identity reference.

## 01 — Product anchor / hero

Use case: `product-mockup`. Premium experimental footwear hero. One original
SENTRACKER TRC-01 shoe: low asymmetric silhouette, sharply segmented
acid-chartreuse outsole, deep aubergine woven-ripstop upper, black technical mesh
tongue, offset graphite quick-lacing, smoky TPU heel stabilizer, geometric
stitching and one narrow yellow pressure-trace strip. Lateral three-quarter view,
diagonal toe-up composition, nearly-black plum studio void, hard directional
off-white light, realistic texture and restrained film grain. No text, trademark,
extra shoe, distorted construction, generic neon or cyberpunk styling.

Output: `public/images/trc-01-hero.webp`

## 02 — Outsole / construction

Use case: `identity-preserve`. Rotate the exact anchor product to reveal its
bottom. Preserve silhouette, materials, lacing, heel frame and colors. Build a
physically plausible segmented chartreuse traction field with one central signal
path. Off-white technical-paper ground, faint registration marks, crisp studio
shadows, entire sole visible. No words, redesign, watermark or deformed tread.

Output: `public/images/trc-01-outsole.webp`

## 03 — Terrain shift

Use case: `identity-preserve`. The exact TRC-01 crosses from wet night asphalt
onto pale rough gravel. Low ground-level camera, cropped technical trouser, one
shoe hero in a grounded stride, controlled 35 mm motion energy, physical
acid-yellow survey line, cool ambient night and hard raking flash. Preserve the
product design; no skyline, logos, extra limbs, cyberpunk environment or generic
sports-advertising treatment.

Output: `public/images/trc-01-terrain.webp`

## 04 — Material macro

Use case: `identity-preserve`. Extreme editorial macro of the same product at the
meeting point of ripstop, quick-lace hardware, smoky heel stabilizer and
chartreuse pressure line. Diagonal crop, one sharp material junction, dark plum
negative area, narrow raking off-white light and realistic dust/stitching
imperfections. Preserve all construction details; no text, redesign or synthetic
glow.

Output: `public/images/trc-01-macro.webp`

## 2026-07-30 product variants and camera sequence

These four assets were generated with the built-in image generation tool from
the original lateral cutout as the product identity reference. Each render used
a flat removable chroma background, then the background was converted locally
to an alpha channel with soft matte and despill. Final WebP files use `yuva420p`.

### 05. Dust Index colorway

Use case: `precise-object-edit`. Preserve the exact lateral three-quarter camera,
shoe geometry, proportions, seams, lace anchors, heel cage, outsole lugs and
four-square side mark. Change only the material treatment to warm mineral-grey
ripstop, sand suede, burnt-oxide segmented outsole and piping, smoked dark-brown
heel cage, charcoal laces and midsole. Premium photoreal product detail. Center
the complete shoe with generous padding. Flat `#00ff00` removal background, no
shadow, floor, reflection, text, watermark, extra objects or green in the shoe.

Output: `public/images/trc-01-dust-lateral-3q-cutout.webp`

### 06. Night Return colorway

Use case: `precise-object-edit`. Preserve the exact lateral three-quarter camera,
shoe geometry, proportions, seams, lace anchors, heel cage, outsole lugs and
four-square side mark. Change only the material treatment to graphite-black
ripstop, deep cool-charcoal overlays, pale glacier-cyan segmented outsole and
piping, smoked blue-grey heel cage, black laces and midsole. Premium
photoreal product detail. Center the complete shoe with generous padding. Flat
`#ff00ff` removal background, no shadow, floor, reflection, text, watermark,
extra objects or magenta in the shoe.

Output: `public/images/trc-01-night-lateral-3q-cutout.webp`

### 07. Front three-quarter camera

Use case: `product-mockup`. Preserve the TRC-01 identity, materials and
construction from the reference. Re-render it from a high front three-quarter
view, looking down about 35 degrees toward the toe box, toe toward lower left
and heel toward upper right. Keep aubergine ripstop, black quick-lacing, smoked
angular heel cage, acid-yellow piping and segmented outsole. Entire shoe,
generous padding, mechanically plausible construction. Flat `#00ff00` removal
background, no shadow, floor, reflection, text, watermark or extra objects.

Output: `public/images/trc-01-field-front-3q-cutout.webp`

### 08. Rear three-quarter camera

Use case: `product-mockup`. Preserve the TRC-01 identity, materials and
construction from the reference. Re-render it from a low rear three-quarter
view that exposes the angular smoked heel cage and acid-yellow trail outsole,
heel toward lower right and toe receding toward upper left. Entire shoe,
generous padding, sharp textile and rubber detail, mechanically plausible
construction. Flat `#00ff00` removal background, no shadow, floor, reflection,
text, watermark or extra objects.

Output: `public/images/trc-01-field-rear-3q-cutout.webp`

## 2026-07-30 eight-view locked turntable

The rejected twelve-frame batch was generated as separate images and produced
duplicate angles and direction changes. It is not used by the site. The final
sequence was generated with the built-in image generation tool as two coherent
2 by 2 contact sheets. Rendering four neighboring views together kept camera
direction and product identity consistent.

The sheets were cropped into eight 45-degree views. Their chroma backgrounds
were converted locally to alpha with a soft matte and despill. Final assets are
1536 by 1024 WebP files with responsive 768 by 512 siblings. Every file uses
`yuva420p`.

### Shared contact-sheet prompt

Use case: `product-mockup`.

Asset type: one half of an eight-frame deterministic 360-degree turntable.

Primary request: Create one 2 by 2 contact sheet containing four unmistakably
different, consecutive 45-degree camera steps around the exact same fixed
TRC-01 right-foot trail shoe. Treat the sheet as one 3D turntable sequence.
Geometry, construction, materials, scale, camera height and lighting stay
locked. Only camera azimuth changes.

Input images: the lateral, front three-quarter and rear three-quarter TRC-01
cutouts are identity and construction references. The second sheet also uses
the approved first sheet as its camera, scale and continuity reference.

Product lock: deep aubergine ripstop upper; black tongue, quick laces, midsole
and hardware; smoky angular heel cage; thin acid-yellow piping; chunky
segmented acid-yellow outsole; small four-square mark. Keep lace count, stitch
map, panels, heel cage, outsole lugs, materials and proportions identical.

Camera lock: fixed shoe and pivot, camera orbit only; fixed 70 mm lens; camera
12 degrees above the midsole; zero roll; identical distance, horizon, lighting
and local midsole alignment. One complete shoe per quadrant with equal padding.

Layout: landscape 3:2 canvas; exactly four equal quadrants in a 2 by 2 grid;
one centered shoe per quadrant; no overlap, crop, divider, label, number,
caption or text.

Lighting: identical neutral catalog light from upper front-left. No cast
shadow, contact shadow or reflection.

Background: solid `#ff5a00` chroma field across the canvas, no texture, floor
or objects. Do not use the key color in the product.

Constraints: every step must visibly rotate by the same 45 degrees. No two
cells may look alike. No duplicate angle, mirror shortcut, side swap, direction
reversal, design drift, missing part, extra object, motion blur, fisheye,
top-down camera or watermark.

### Viewpoints and outputs

1. `0°`, direct front: `trc-01-turn-01.webp`
2. `45°`, front outer three-quarter: `trc-01-turn-02.webp`
3. `90°`, exact outer lateral: `trc-01-turn-03.webp`
4. `135°`, outer rear three-quarter: `trc-01-turn-04.webp`
5. `180°`, direct rear: `trc-01-turn-05.webp`
6. `225°`, medial rear three-quarter: `trc-01-turn-06.webp`
7. `270°`, exact medial lateral: `trc-01-turn-07.webp`
8. `315°`, medial front three-quarter: `trc-01-turn-08.webp`

Each frame also has a responsive sibling with the `-sm.webp` suffix.

## 2026-07-30 SENTRACKER identity mark

Use case: `logo-brand`.

Asset type: horizontal master logo for the SENTRACKER experimental
trail-footwear campaign website.

Primary request: Create an original compact symbol plus wordmark for the company
SENTRACKER. Use a small geometric trail-coordinate and pressure-trace emblem
followed by the exact uppercase word `SENTRACKER`. Give the wordmark custom
condensed mechanical letterforms that remain legible at header size. Run one
acid-lime route line precisely through `TR` as a recorded trail signal while the
rest of the word stays clean.

Style: flat vector-like construction, crisp hard edges, strong silhouette and
balanced negative space. Warm off-white `#f3f0e8` and acid lime `#b6ff00` only.
No 3D, gradient, mockup, shoe illustration, mountain, shield, wing, swoosh,
generic tech hexagon, extra text, tagline or watermark.

Text, verbatim: `SENTRACKER`, exactly once.

Generation background: perfectly flat `#00ffff` chroma field with no shadow,
texture, reflection, floor plane, glow or lighting variation. The background was
removed locally with border auto-key sampling, a soft matte and despill. The
transparent result was cropped, upscaled to 2640 by 522 and exported as a PNG
master plus an optimized alpha WebP for the site.

Outputs:

- `public/images/sentracker-logo.png`
- `public/images/sentracker-logo.webp`

## 2026-07-30 alpine sunset campaign photography

Both frames were generated with the built-in image generation tool from the
approved TRC-01 lateral and outsole references. The product identity is locked
to the aubergine ripstop upper, black speed-lace system, smoky heel frame,
black chassis, thin acid pressure line and segmented acid-yellow outsole.

### Desktop closing frame

Use case: `ads-marketing`.

Create a wide, full-bleed closing campaign photograph of one exact TRC-01 on a
rough dark-granite ledge above layered mountain ridges. Place the shoe on the
right side, toe pointing left, with calm negative space across the left and
center for the closing headline. Photograph the final ten minutes of golden
hour with a restrained warm rim light, cool plum shadows, natural atmospheric
haze and premium outdoor editorial detail. Keep the lighting cinematic but
credible. No text, people, additional shoe, fantasy terrain, artificial neon
glow, excessive HDR or watermark.

Outputs:

- `public/images/trc-01-sunset-campaign.png`
- `public/images/trc-01-sunset-campaign.webp`

### Mobile closing frame

Use case: `ads-marketing`.

Create a faithful portrait companion to the approved desktop photograph, not a
different shoot. Preserve the exact TRC-01, granite ledge, distant mountain
ridges, sunset direction and color grade. Use a vertical mobile composition
with exactly one complete shoe across the lower 38 percent of the image and
calm mountain and sky space above it for the headline. Toe left, heel right,
natural final-light rim and detailed shadows. No text, extra product, people,
floating shoe, fantasy landscape, border or watermark.

Outputs:

- `public/images/trc-01-sunset-campaign-mobile.png`
- `public/images/trc-01-sunset-campaign-mobile.webp`

## 2026-07-30 TRC-01 exploded assembly

Use case: `product-mockup`.

Generate one mechanically plausible exploded technical render of the exact
TRC-01 in the approved lateral three-quarter camera. Separate the assembly into
four complete, aligned layers with consistent spacing, scale and vanishing
points: the aubergine ripstop upper with tongue, collar, laces and hardware; the
smoky translucent TPU heel frame and support cage; the black sculpted
cushioning midsole and structural carrier; and the acid-yellow segmented rubber
outsole with its trail lugs. Every layer must mentally reconstruct into the
same shoe. Premium catalog lighting, crisp material separation, no floor or
cast shadow. No duplicate shoe, repeated part, labels, arrows, numbers, text,
watermark or unrelated internal anatomy.

Generation background: a flat `#ff5a00` chroma field with no floor, reflection
or ambient spill. The generated field was removed locally with border auto-key
sampling, a soft matte, light edge feathering and despill. The approved master
has a true alpha channel; the site sibling is an optimized alpha WebP.

Outputs:

- `public/images/trc-01-exploded-view.png`
- `public/images/trc-01-exploded-view.webp`
