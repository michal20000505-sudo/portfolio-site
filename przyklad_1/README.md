# FAULT / 08

Experimental single-page editorial experience built as a portfolio piece.

## Run locally

```bash
npm install
npm run dev
```

Vite prints the local development URL, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The optimized production output is written to `dist/`.

## Stack

- React + TypeScript + Vite
- GSAP + ScrollTrigger for composed motion
- Lenis for desktop wheel smoothing
- local Fontsource packages (Barlow Condensed and Cormorant Garamond)
- project-local WebP campaign photography

Motion is reduced when the operating system requests it. The desktop cursor and
hover interactions are disabled on touch devices, and the pinned horizontal
archive becomes a deliberate vertical sequence below 900 px.
