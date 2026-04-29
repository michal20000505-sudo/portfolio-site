---
name: Michał Jarosiński Portfolio
description: Creative portfolio — web design, branding, and graphic design since 2014.
colors:
  studio-black: "#050505"
  studio-white: "#ffffff"
  electric-cyan: "#00ffff"
  signal-magenta: "#ff00ff"
  exposed-yellow: "#ffff00"
  surface-raised: "#1a1a1a"
  surface-mid: "#222222"
  surface-border: "#333333"
  text-muted: "#888888"
  text-dim: "#666666"
typography:
  display:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 8vw, 8rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 300
    lineHeight: 1.9
  label:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 500
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "50px"
spacing:
  xs: "15px"
  sm: "30px"
  md: "50px"
  lg: "80px"
  xl: "150px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.electric-cyan}"
    rounded: "{rounded.md}"
    padding: "14px 32px"
  button-primary-hover:
    backgroundColor: "{colors.electric-cyan}"
    textColor: "{colors.studio-black}"
    rounded: "{rounded.md}"
    padding: "14px 32px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sm}"
---

# Design System: Michał Jarosiński Portfolio

## 1. Overview

**Creative North Star: "The Joyful Technician"**

This is a system built by someone who genuinely loves the craft. The glitch animations, rubber-band text, magnetic cursors, and starfield particles are not decoration — they are evidence. Evidence that the person who built this portfolio spent real time on each effect because it delighted them, not because a brief required it. That joy is the brand signal.

The palette is rooted in CMYK process printing: cyan, magenta, and yellow on a near-absolute black ground. Where print is static ink on a dark substrate, this site makes those same primaries interactive and alive. Future design additions should reinforce this logic: if an effect or color can't be traced back to "this is how the materials behave," reconsider it.

The intended audience — Polish SMB owners evaluating a designer to hire — should finish browsing and feel two things: admiration at the technical craft, and warmth toward the person who made it. The personality is playful and approachable, not cold-agency or technical-showcase. Every copywriting decision and layout choice should serve that combination.

**Key Characteristics:**
- Full-palette CMYK triad (cyan, magenta, yellow) on a printing-plate ground
- Single geometric sans (Space Grotesk) across every role; hierarchy through scale and weight only
- No box-shadows; depth via tonal layering and ambient glow
- Interactive elements that respond before they are touched (magnetic, proximity-aware)
- Motion as evidence of craft, not as decoration
- Warmth through personality and specificity, not through warm hue or rounded friendliness

## 2. Colors: The CMYK Studio Palette

Three process primaries on a printing-plate ground. Each accent color has a specific functional tier. The palette is deliberate, not restrained — all three accents are used, but each occupies a different layer of the UI.

### Primary
- **Electric Cyan** (#00ffff): The main interactive accent. Link hover states, button borders, active UI elements, cursor highlights, scroll-progress indicators. Cyan reads forward without aggression — it signals attention without alarm.

### Secondary
- **Signal Magenta** (#ff00ff): Used in ambient glow layers, background atmosphere, and secondary animation highlights. Never on text. Its role is environmental: it occupies the periphery and creates depth alongside cyan without competing for the same surface.

### Tertiary
- **Exposed Yellow** (#ffff00): Tertiary accent for particle effects, scroll-progress gradients (as a terminus), and glitch-shadow offsets. Rarely structural. Its extreme luminosity makes it effective in very small doses.

### Neutral
- **Studio Black** (#050505): The base. Every surface starts here. The near-black (not #000000) prevents the flat, digital harshness of absolute black while remaining visually indistinguishable.
- **Studio White** (#ffffff): Primary text on dark surfaces. In new surfaces, consider a faint warm tint (e.g. #f8f6f4) to reduce starkness.
- **Surface Raised** (#1a1a1a): First layer above ground. Card backgrounds, section containers, hover states on dark elements.
- **Surface Mid** (#222222): Second layer. Inner group boundaries, selected states, section dividers.
- **Surface Border** (#333333): Borders and dividers. Never colored; never visually prominent.
- **Text Muted** (#888888): Secondary text, metadata, category labels, navigation defaults.
- **Text Dim** (#666666): Tertiary text, placeholders, captions.

### Named Rules

**The CMYK Logic Rule.** Cyan leads interactions. Magenta occupies ambience. Yellow punctuates motion. These roles are not interchangeable. Using magenta for a CTA border or cyan for a background glow erodes the visual grammar the eye has already mapped.

**The One Darkness Rule.** The background is Studio Black (#050505) everywhere. Do not introduce a second background color for hero sections, overlays, or off-canvas panels. Depth is Surface Raised and Surface Mid, not a second dark value.

## 3. Typography

**Single font family:** Space Grotesk (weights 300, 500, 700) with system-ui, sans-serif fallback. Loaded from Google Fonts.

**Character:** One geometric sans across every role. Hierarchy is achieved entirely through scale and weight contrast — the typeface itself never changes. This creates a unified voice where all text belongs to the same person; the volume varies, the accent does not.

### Hierarchy
- **Display** (700, clamp(3.5rem, 8vw, 8rem), line-height 0.9, letter-spacing -0.02em): Hero titles only. Always uppercase. Tight line-height and negative tracking at scale make letterforms read as a unit. At smaller viewports, the clamp keeps it readable without breaking the density.
- **Headline** (700, clamp(2rem, 4vw, 4rem), line-height 1.1): Section titles and major headings. Always uppercase. The step from Display to Headline must be at least 1.25x in rendered size — never less.
- **Title** (500, 1.5rem, line-height 1.3): Subsection labels, project names, card headings. Mixed case. The shift from uppercase to mixed case marks the transition from declaration to communication.
- **Body** (300, 1.2rem, line-height 1.9): Long-form descriptions, about copy, service explanations. Max line-length 70ch. Weight 300 reads cleanly on dark backgrounds at this size — do not use it below 1rem.
- **Label** (500, 0.9rem, letter-spacing 0.1em, uppercase): Tags, metadata, navigation items, timestamps, category chips. The extra tracking at small size aids legibility on dark backgrounds.

### Named Rules

**The Weight Jump Rule.** Minimum weight contrast between adjacent hierarchy levels is one full step: 300 to 500, or 500 to 700. Never 300 to 300 differentiated only by size.

**The Uppercase Ceiling Rule.** Display and Headline are always uppercase. Title and below are always mixed case. Uppercase body copy is prohibited outside Label contexts.

## 4. Elevation

This system is shadow-free at rest. Depth is achieved through exactly three mechanisms:

1. **Tonal layering.** Studio Black is ground. Surface Raised (#1a1a1a) and Surface Mid (#222) create the first two planes. An element on Surface Raised reads as "above" ground without any shadow — tonal contrast does the work.
2. **Ambient glow.** Three large, heavily blurred colored circles (cyan, magenta, yellow) float in the background with slow 15-second drift animations at ~3% opacity. They function as environmental lighting, not spotlight effects — they establish atmosphere, not hierarchy.
3. **Transform on state.** Interactive elevation is expressed through translateY(-2px) on hover, not shadow changes. The element moves toward the user; the lighting does not change.

### Named Rules

**The No-Shadow Rule.** box-shadow as a depth mechanism is prohibited. If elevation must be signaled, use tonal layering or a state transform. The exception: a reactive glow (e.g. box-shadow: 0 0 30px rgba(0,255,255,0.3) on hover) is a feedback signal, not an elevation signal — its purpose is response, not static depth.

**The Ambient Glow Rule.** The three ambient circles are background atmosphere only. Do not bring glow into the foreground as card halos, text glows, or spotlight effects. The contrast between the glowing background and the flat foreground elements is the composition.

## 5. Components

### Buttons

Magnetic and responsive. Primary CTAs lean toward the cursor before the click. On hover, the outline inverts: the border fills, the text swaps to the background color, a faint cyan glow appears below.

- **Shape:** Gently curved (12px radius)
- **Primary default:** Transparent fill, Electric Cyan border (1px solid), Electric Cyan text, 14px 32px padding, weight 500, letter-spacing 0.05em, uppercase
- **Primary hover:** Electric Cyan fill, Studio Black text, box-shadow: 0 0 30px rgba(0,255,255,0.3), translateY(-2px); transition 0.4s cubic-bezier(0.165,0.84,0.44,1)
- **Focus-visible:** 2px Electric Cyan outline, offset 4px
- **Magnetic effect (JS-required):** On mousemove within a proximity radius, the button translates up to 30% of the pointer offset distance toward the cursor. Applied via JavaScript; not expressible in CSS alone.

### Tags / Chips

Pill-shaped category labels. Static, informational.

- **Shape:** Full pill (50px radius)
- **Style:** Transparent background, Surface Border (1px solid #333), Text Muted (#888) text, 6px 16px padding, font Label scale (0.9rem, weight 500, letter-spacing 0.05em, uppercase)
- **No hover state required.** These are labels, not actions.

### Portfolio Cards

Work samples. The card frames; the image carries the weight.

- **Corner style:** Gently curved (16px radius)
- **Background:** Surface Raised (#1a1a1a)
- **Border:** Surface Border (1px solid #333) at rest; no border on hover
- **Hover state:** box-shadow: 0 0 40px rgba(0,255,255,0.1), translateY(-4px); image scales 1.05 with 0.6s ease-out (cubic-bezier(0.23,1,0.32,1))
- **Image container:** overflow hidden so the scale is clipped by the card boundary
- **Internal padding:** 30px (spacing.sm) on the text area below the image

### Navigation

Transparent, typographic, minimal.

- **Background:** Transparent (fixed position, no surface)
- **Default state:** Text Muted (#888), Label scale
- **Hover state:** Electric Cyan (#00ffff), transition 0.3s ease
- **Active / current page:** Electric Cyan at full opacity
- **Mobile (≤768px):** Hamburger toggle slides in a full-viewport dark overlay (Studio Black, 0.98 opacity, backdrop-blur 10px). Links are centered, large (Title scale), stacked vertically.

### Glitch Title (Signature Component)

The hero display title uses layered CSS glitch: two pseudo-elements (::before, ::after) carry Electric Cyan and Signal Magenta tint offsets respectively, animated via clip-path with 2.5–3.5s loops running at different rates. The base element reads cleanly at rest. The glitch fires intermittently.

**The Glitch-Once Rule.** The glitch effect is reserved for the hero title. Applying it to section headings, hover states, or interactive elements dilutes the signal to noise.

## 6. Do's and Don'ts

### Do:
- **Do** use Space Grotesk at weight 700 for all Display and Headline text. No exceptions, no second typeface.
- **Do** use Electric Cyan as the primary interactive signal: link hover, button borders, active states, focus rings.
- **Do** achieve depth through tonal layering (Studio Black → Surface Raised → Surface Mid) and ambient glow. These are the only depth mechanisms.
- **Do** set Display and Headline type uppercase, Title and below mixed case.
- **Do** cap body copy at 70ch max-width. Long dark-background lines fatigue readers.
- **Do** implement the magnetic proximity effect on primary CTAs. It is a signature interaction and part of the brand impression.
- **Do** honor prefers-reduced-motion: disable or simplify 3D perspective transforms, particle systems, and rubber-band text for affected users.
- **Do** keep ambient glow circles in the background layer. They are atmosphere, not decoration.

### Don't:
- **Don't** build a site that reads as a generic Webflow template: whitespace-maximal layout, serif display headline, scroll-reveal-only animation, anonymous portfolio grid. This portfolio exists precisely because that aesthetic is invisible.
- **Don't** create a corporate portfolio: no case-study templates, no bullet-pointed outcomes, no heavy methodology sections that bury the work.
- **Don't** use box-shadow as a depth mechanism. The No-Shadow Rule is absolute at rest.
- **Don't** apply the glitch effect to any element other than the hero title.
- **Don't** assign magenta or yellow to interactive states. Those roles belong to cyan.
- **Don't** use weight 300 below 1rem. It becomes illegible on dark backgrounds at small scale.
- **Don't** introduce a second typeface. The single-family system is intentional — a second face breaks voice coherence.
- **Don't** use glassmorphism (backdrop-filter blur on decorative card containers) as a default surface style. The ambient glow system already creates depth; frosted glass on top is redundant.
- **Don't** use side-stripe borders (border-left or border-right greater than 1px as a colored accent). Rewrite with full borders, background tints, or nothing.
