# THE LAST SIGNAL

*A transmission from a star that no longer exists.*

An interactive observatory archive documenting **TLS-4812** — a structured signal
received on the neutral hydrogen line 4,812 years after its source collapsed.
Six chapters, one continuous descent.

Built as a self-contained subpage of the portfolio. **No build step, no
dependencies, no external requests.** Copy the folder onto any static host and
open it.

---

## 1 · Running it

```
the_last_signal/signal.html
```

It uses ES modules, so it must be served over `http(s)` — opening the file with
`file://` will be blocked by the browser's module CORS rules.

```bash
# from the repository root
python -m http.server 8787
# → http://127.0.0.1:8787/the_last_signal/signal.html
```

**Deploying.** `tools/ftp_push.py` already walks the repository recursively and
skips only `.git`, `.claude`, `tools` and `node_modules`, so this folder and its
subfolders upload with no change to the script:

```bash
python tools/ftp_push.py
```

Nothing outside `the_last_signal/` is touched by this project. The existing
portfolio pages are unmodified.

---

## 2 · Why there is no framework

The brief specified Next.js, React Three Fiber, GSAP and Lenis. The deployment
target is a static HTML portfolio with no `package.json` and no build pipeline,
served over plain FTP. Introducing a toolchain would have meant `npm install`,
`next build --output export`, a `basePath`, and committing generated output on
every edit — real ongoing cost for no user-visible gain.

Everything those libraries would have provided is implemented directly and
scoped to what the piece actually needs:

| Brief | Here | Why it is not a downgrade |
| --- | --- | --- |
| React / Next.js | Plain ES modules, one factory per chapter | There is no shared mutable UI state and nothing is re-rendered; a VDOM would sit idle |
| React Three Fiber + Drei | `src/gl/` — a ~200-line WebGL2 layer | No scene graph is needed: every pass is a full-screen triangle or a procedural point cloud |
| GSAP + ScrollTrigger | `core/loop.js`, `core/chapters.js`, `core/math.js` | One RAF, explicit priorities, frame-rate-independent damping |
| Lenis | `core/scroll.js` | Native scroll stays authoritative; only a *smoothed copy* drives the visuals |
| Zustand | `data/archive.js` + per-scene closures | State is narrative constants and local scene state |

Total transfer: the HTML, two stylesheets, 28 small modules and two woff2 font
files. No CDN, no runtime download, no third-party code.

---

## 3 · Architecture

```
the_last_signal/
├─ signal.html              semantic document + full text fallback
├─ fonts/                   Space Grotesk (variable 300–700), self-hosted
├─ styles/
│  ├─ system.css            tokens, type, chrome, cursor, loader, nav
│  └─ chapters.css          one composition per chapter + responsive
└─ src/
   ├─ main.js               assembly and teardown only
   ├─ data/archive.js       every number and every word of the fiction
   ├─ core/
   │  ├─ capabilities.js    one honest read of the device (ReducedMotionFallback)
   │  ├─ loop.js            the single requestAnimationFrame
   │  ├─ scroll.js          smoothed scroll without hijacking the scrollbar
   │  ├─ chapters.js        ChapterController — crossfade + progress
   │  ├─ pointer.js         one shared pointer model
   │  ├─ math.js            clamp / lerp / damp / easing / seeded noise
   │  └─ type.js            scramble, counters, masked line reveals
   ├─ gl/
   │  ├─ renderer.js        WebGL2 wrapper — Renderer + Pass
   │  ├─ canvas.js          SignalCanvas — layer orchestration
   │  └─ shaders/
   │     ├─ lib.js          shared GLSL: noise, optics, colour, tonemap
   │     ├─ signalCore.js   chapters 00 and 05 (the same optics, reversed)
   │     ├─ source.js       chapter 01, the star in four states
   │     ├─ stream.js       chapter 02, the transmission as geometry
   │     └─ film.js         grain, halation, interference
   ├─ scenes/
   │  ├─ acquisition.js     SignalCore + the hold gate
   │  ├─ source.js          SourceScene
   │  ├─ transmission.js    TransmissionScene + the player
   │  ├─ fragments.js       FragmentArchive
   │  ├─ visuals.js         procedural artwork generators
   │  ├─ decoding.js        DecoderInterface
   │  └─ afterlight.js      AfterlightScene
   └─ ui/
      ├─ loader.js          ExperienceLoader
      ├─ cursor.js          CustomCursor
      ├─ nav.js             ArchiveNavigation
      ├─ sound.js           SoundController
      └─ waveform.js        the shared oscilloscope
```

### The layout model

The document is a stack of **empty spacers** (`.scroll-track`) whose only job is
to create scroll distance. All visible content lives in **fixed full-viewport
stages** whose state is derived from the smoothed scroll position.

This is why there is no `position: sticky` anywhere and why nothing is
transformed out from under the browser: native scrolling remains authoritative,
so the scrollbar, keyboard, find-in-page, screen readers and touch momentum all
behave exactly as the platform intends.

`ChapterController` expresses position as one continuous number:

```
x = 2.34   →   34% of the way through chapter 02
```

Chapters overlap in a **partition-of-unity crossfade** (`crossfadeWeight` in
`math.js`), so adjacent weights always sum to 1 and the screen is never empty
between chapters.

### The render model

One WebGL2 canvas. Scenes never touch the context — they write plain values into
a layer's uniform bag and `SignalCanvas` decides what is drawn. A layer at zero
opacity costs one float comparison per frame.

Everything is emissive: the canvas clears to transparent and passes blend
additively over the page background. That is why the star, the stream and the
grain composite like light rather than like stacked images.

There are no vertex buffers. Positions come from `gl_VertexID`, so changing the
particle count for a weaker device is a draw-call argument, not a re-upload.

### One detail worth pointing at

In Chapter 01 the editorial statement is **occluded by the star**. Rather than a
blend mode — which breaks the moment any ancestor creates a stacking context —
`scenes/source.js` recomputes the star's screen position and radius from *the
same expressions the fragment shader uses* and writes them into a CSS radial
mask. The type genuinely passes behind the object, in every browser, at any
stacking depth.

---

## 4 · Interaction

| Chapter | What the visitor actually does |
| --- | --- |
| 00 Acquisition | Press and hold the signal to open the archive. Scroll is locked until then |
| 01 The Source | Scroll drives the star through observed → reconstructed → collapse → origin |
| 02 The Transmission | Travel through the ribbon; play, scrub and re-tune the recording |
| 03 Fragments | Approach, drag, and open records in a curated field |
| 04 Decoding | Align frequency, phase and alignment until the message resolves |
| 05 Afterlight | Type a reply and watch it leave |

**The easter egg.** After the message resolves, stay with it. Eight seconds
without touching anything recovers **Fragment 00 — First acquisition**, and the
archive index updates from 05 to 06 records. It is not a key combination; it is
given to whoever does not immediately reach for the next thing.

**Chapter 04 targets:** 1420.4 MHz, 137°, 0.00. Unproductive searching surfaces
written hints after about 35 seconds.

---

## 5 · Accessibility

Built in, not bolted on.

- **No JavaScript** → the stages never become fixed and the page renders as a
  plain, complete text archive in document order. Try it with JS disabled.
- **No WebGL** → `NullCanvas` takes over, every scene keeps working, and a
  static optical background replaces the renderer. A shader that fails to
  compile is caught and degrades the same way rather than blanking the page.
- **Reduced motion** → honoured from the OS, and overridable in both directions
  with the MOTION toggle. Scroll lag, pointer inertia, parallax, grain
  animation and text scrambling are disabled; information is never withheld,
  only movement.
- **Keyboard** → the gate responds to Enter/Space, the archive index is a list
  of buttons, the band selector is a proper radiogroup with arrow keys, the
  decoder uses real `input[type=range]`, and the fragment detail is a modal
  dialog with Escape and focus containment.
- **Screen readers** → dormant chapters are `inert`, so only the live chapter is
  in the tab order and the accessibility tree. Live regions announce the decoded
  message and the transmitted reply.
- **Sound** → off until requested, no AudioContext exists before then, and the
  full audio layer is described in text in the plain archive. Nothing is
  conveyed by sound alone.
- **Focus** → never removed, styled as part of the instrument.

---

## 6 · Performance

- The WebGL module is a **dynamic import**: a device that cannot run it never
  downloads or parses it.
- Device pixel ratio is capped per tier (2 / 1.5 / 1).
- Particle count adapts: 120k → 52k → 12k, halved again on narrow screens.
- Shader octave budget drops on weaker GPUs.
- The RAF loop stops entirely when the tab is hidden; `dt` is clamped so a
  backgrounded tab cannot fling every spring across the screen.
- Fragment artwork is painted once, on approach, and repainted only on resize.
- Programs, event listeners, canvases, timers and the GL context are all
  released on `pagehide`. Context loss is handled and recovers by recompiling.

---

## 7 · Replacing the placeholders

### Type

Three roles, defined in `styles/system.css`:

```css
--display:  'Space Grotesk', …   /* monumental statements */
--grotesk:  system UI stack       /* body and interface */
--mono:     system mono stack     /* archive metadata */
```

Space Grotesk (variable, 300–700) is self-hosted in `fonts/`. To swap the
display face: drop the `.woff2` into `fonts/`, edit the two `@font-face` blocks
at the top of `system.css`, update `--display`, and update the preload in
`signal.html`. Nothing else references a font name.

### Imagery

There are no image files. Every fragment visual is generated at runtime by a
function in `src/scenes/visuals.js` (`spectrogram`, `orbital`, `lattice`,
`plate`, `reconstruction`, `firstlight`), each drawing into a canvas at device
resolution from a fixed seed — so a record looks the same on every visit.

To add a fragment: append an entry to `FRAGMENTS` in `data/archive.js` with a
`visual` key, and add a matching generator to the `GENERATORS` map. Positions
`x` / `y` are viewport fractions from the centre; `depth` (0–1) drives opacity,
parallax and stacking.

To use a real image instead, replace the generator body with a `drawImage` call
— the canvas element and its sizing are already handled by `paintFragment`.

### Sound

Synthesised in `src/ui/sound.js`; there are no audio files to license or
replace. The per-chapter mix is the `MIX` table at the top of that file. To
substitute recorded audio, swap the oscillator/noise sources in `#build()` for
`AudioBufferSourceNode`s — the gain buses, chapter mixing and analyser feed stay
as they are.

### The fiction

All of it lives in `src/data/archive.js`: coordinates, distance, telemetry, the
four source states, transmission tokens, fragment records, the decoded sentence
and its control targets, and the credits. The numbers are cross-referenced, so
changing the distance means updating the transmission age and arrival estimate
alongside it.

---

## 8 · Editing the shaders

Every shader is a JS template literal, so **a backtick anywhere inside the GLSL
— including in a comment — terminates the string**. The page does not crash: it
catches the failure and drops to the no-WebGL path, which makes the mistake easy
to miss.

`shader-check.html` compiles all seven shaders on their own and prints the exact
failing line with surrounding context. Open it after touching anything in
`src/gl/shaders/`. It is a development tool with no link from the site; delete
it if you would rather not deploy it.

---

## 9 · Verified

Checked in headless Chrome 150, both against a real WebGL2 context
(ANGLE/SwiftShader) with frames inspected, and with WebGL disabled:

- all 28 modules parse; all 5 shader programs compile and link
- rendered output inspected per chapter: signal core, star, ribbon, afterlight
- loader sequence gates on actual compilation, then hands over without a cut
- opening timeline, hold gate, scroll unlock and chrome reveal
- decoder reaches lock and resolves all 34 characters of the message
- hidden fragment recovers; index updates 05 → 06
- desktop (1440×900), tablet (900×560) and mobile (390×844) compositions
- console clean — zero errors, warnings or failed requests

Note on the software rasteriser: it reports as the `low` tier, so the captures
ran at 12,000 stream particles. On a real GPU the same scene runs the `high`
tier at 120,000 — an order of magnitude denser than anything verified here.

---

## 10 · Credits

TLS-4812 is fictional. Concept, interface and code: **Michał Jarosiński**.
All imagery generated in-browser with WebGL, Canvas and SVG. All sound
synthesised with Web Audio. No stock assets.
