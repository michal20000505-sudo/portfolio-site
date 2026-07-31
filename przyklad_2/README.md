# SENTRACKER / TRC-01

Experimental single-product campaign built with React, TypeScript, Vite, GSAP,
ScrollTrigger and Lenis. All campaign imagery is local and optimized to WebP.

## Run

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm run preview
```

## Deploy path

The build is served from a subdirectory (`/przyklad_2/dist/`), not from a
domain root. `vite.config.ts` sets `base: "./"`, which rewrites `index.html`
and bundled imports — but **not** string literals pointing at `public/`. Any
new `public/` asset must go through `assetUrl()` from `src/lib/assetUrl.ts`:

```tsx
<img src={assetUrl("/images/trc-01-cutout.webp")} />
```

A raw `src="/images/..."` resolves against the portfolio root and 404s once
deployed, while still working on the dev server — so it will not show up
locally.

## Preview mode

`?preview=1` strips the page down to a clean canvas: no Lenis, no custom
cursor, no scrollbar, terrain video at `preload="none"`. It also posts
`sentracker-preview-ready` to a parent frame once the hero opening timeline
finishes. See `previewMode` in `src/lib/previewMode.ts`.

The portfolio card on the main page used to embed this in an iframe, but the
two live previews cost too much on the index, so the card is now a still
(`thumbnails/web/sentracker-trc01.webp`) captured from this mode at 1440×810.
Re-shoot it through `?preview=1` whenever the hero changes.

## Interaction notes

- Scroll drives the product trajectory and construction sequence.
- The hero responds subtly to a fine pointer.
- Signal selection changes the full color environment without product cards.
- Keyboard focus is visible and all controls perform an action.
- `prefers-reduced-motion` disables the loader wait, smooth scrolling and
  scroll-scrubbed movement.

The product and all technical claims are fictional concept-design elements.
