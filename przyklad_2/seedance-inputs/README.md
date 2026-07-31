# Seedance 1.5 Pro — TRC-01 full-environment video prompts

These versions are complete full-frame campaign films. They use real
environments instead of chroma keying, so the exported video can be placed on
the site without removing its background.

The older files with `-blue` in their names are retained only as the previous
attempt and should not be uploaded for these generations.

## 01 — Alpine 360-degree product rotation

### Upload

- First frame: `rotation-first-alpine.png`
- Last frame: `rotation-last-alpine.png`

The first and last frames are intentionally identical. Do not add the old blue
identity sheet.

### Settings

- Model: Seedance 1.5 Pro / Video 3.5 Pro
- Mode: first and last frame image-to-video
- Duration: 12 seconds
- Aspect ratio: original input ratio / 3:2
- Resolution: highest available
- Audio: off; if it cannot be disabled, use only very quiet mountain wind

### Prompt

```text
Create a finished, full-frame, premium photorealistic outdoor product campaign film from the uploaded first and last frames. The complete alpine environment is an intentional part of the final film. Do not replace it with a studio background, solid color or transparency. The first and last frames are intentionally identical and are hard visual anchors for a seamless loop.

The camera is completely locked in the exact uploaded position. The mountain ridges, granite foreground, horizon and framing remain fixed. One exact right-foot SENTRACKER TRC-01 rotates smoothly in place around its own vertical center axis, completing exactly one clockwise 360-degree product turn and returning precisely to the uploaded starting three-quarter view. The shoe turns; the camera does not orbit. Keep the pivot fixed under the center of the midsole. Use constant scale and constant distance with no sliding, translation, bobbing, tilting or change of elevation. Hold the opening frame for 0.4 seconds, complete one continuous mechanically smooth revolution, then settle into the identical closing frame for 0.4 seconds.

Lock the product identity in every frame: deep aubergine ripstop upper; black textured tongue; identical graphite quick-lacing, lace anchors and hardware; the same panel seams and small four-square side mark; smoky translucent angular TPU heel cage; black sculpted midsole; one narrow acid-yellow pressure line; chunky segmented acid-yellow trail outsole with stable, mechanically plausible lugs. Preserve the exact right-foot orientation, silhouette, proportions, materials, lace count, heel-cage construction and lug pattern. As the shoe rotates, reveal physically coherent front, lateral, rear and medial sides of the same object.

Preserve the uploaded high-alpine sunset environment: dark graphite granite, layered mountain ridges, natural atmospheric haze, deep plum-violet sky and restrained warm amber horizon. Keep the lighting cinematic but credible. The fixed sunset light produces natural moving highlights across the rotating ripstop, TPU and rubber. Allow only extremely subtle distant haze and grass movement. The environment must not warp, morph, zoom or change geography, and it must return to the matching loop state in the final frame.

No camera movement, orbit, zoom, dolly, pan, tilt, roll, handheld shake or focus breathing. No redesign, morphing, breathing geometry, wobble, jitter, duplicate shoe, side swap, mirror shortcut, direction reversal, changing lace count, changing lug pattern, missing parts, extra objects, strong motion blur, fisheye, text, labels, logo changes, watermark, particles, people, hands or visible turntable. No dialogue or music.
```

## 02 — Alpine field-lab exploded view

### Upload

- First frame: `exploded-first-alpine-lab.png`
- Last frame: `exploded-last-alpine-lab.png`

### Settings

- Model: Seedance 1.5 Pro / Video 3.5 Pro
- Mode: first and last frame image-to-video
- Duration: 10 seconds
- Aspect ratio: original input ratio / 3:2
- Resolution: highest available
- Audio: off; if it cannot be disabled, use only quiet wind and a restrained
  mechanical separation sound

### Prompt

```text
Create a finished, full-frame, premium photorealistic technical product film from the uploaded first and last frames. The open alpine field-testing station and distant mountains are an intentional part of the final film. Do not replace the environment with a studio background, solid color or transparency. Treat both uploaded frames as hard visual anchors.

The camera and the complete environment are locked for the entire shot: fixed lateral three-quarter technical-product viewpoint, fixed perspective, zero roll, no orbit, no pan, no tilt, no zoom, no dolly and no focus breathing. Preserve the exact granite walls, off-white mineral-composite platform, structural panels, mountain horizon, twilight sky and framing from the uploaded images.

Begin with the exact fully assembled right-foot SENTRACKER TRC-01 shown in the first frame. Hold it still for 0.8 seconds, then lift it only slightly above the platform and separate it with controlled industrial precision into exactly four complete, mechanically plausible layers: 1) the aubergine ripstop upper with tongue, collar, quick-laces and hardware; 2) the smoky translucent TPU heel frame and support cage; 3) the black sculpted cushioning midsole and structural carrier with the narrow acid-yellow pressure line; 4) the segmented acid-yellow rubber outsole with its trail lugs.

Each component remains rigid and travels along a straight, clean, parallel separation path. The layers ease into the exact final positions, scale, spacing, perspective and alignment of the uploaded last frame. Hold the completed exploded assembly for the final 1.2 seconds. The four layers must mentally reconstruct into the same shoe.

Preserve the exact silhouette, panel seams, lace count, lace anchors, four-square side mark, heel-cage geometry, midsole profile, pressure line, outsole segments, lug pattern, materials, colors and right-foot orientation. Use the existing soft technical key light from upper left, with physically credible material highlights. Allow only extremely subtle distant mountain haze outside the station. The platform and architecture remain completely still.

No additional layers, duplicate parts, internal electronics, cutaway anatomy, deformation, melting, morphing, flexing, spinning parts, drifting alignment, camera movement, environment changes, strong motion blur, smoke, dust, sparks, energy effects, holograms, arrows, labels, numbers, text, logo changes, watermark, people, hands, tools or robots. No dialogue or music.
```

## Environment plates

These are the clean backgrounds used to prepare the first and last frames. They
do not need to be uploaded to Seedance:

- `environment-alpine-ridge.png`
- `environment-alpine-lab.png`

## If 3:2 is unavailable

Choose 16:9 and keep the complete product inside the centered 3:2 safe area.
Do not crop any part of the shoe. The site can display the final video with
`object-fit: cover` when the section uses the whole environment.
