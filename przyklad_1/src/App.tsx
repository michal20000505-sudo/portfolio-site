import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const archiveFacts = [
  ["Material", "CaCO₃ / cotton / air"],
  ["Exposure", "1/250 — f/8"],
  ["Wind", "NNE 31 km/h"],
  ["Duration", "06:42:18"],
];

function usePreloader() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();
    let pageReady = document.readyState === "complete";
    let frame = 0;
    let exitTimer = 0;

    const markReady = () => {
      pageReady = true;
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      const staged = Math.min(92, (elapsed / 850) * 92);
      const resolved =
        pageReady && elapsed > 850
          ? Math.min(100, 92 + ((elapsed - 850) / 260) * 8)
          : staged;

      setProgress(Math.round(resolved));

      if (resolved >= 100) {
        exitTimer = window.setTimeout(() => setVisible(false), 320);
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("load", markReady, { once: true });
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("load", markReady);
      cancelAnimationFrame(frame);
      clearTimeout(exitTimer);
    };
  }, []);

  return { progress, visible };
}

function Preloader({
  progress,
  visible,
}: {
  progress: number;
  visible: boolean;
}) {
  return (
    <div
      className={`preloader ${visible ? "is-visible" : "is-finished"}`}
      aria-hidden={!visible}
    >
      <div className="preloader__top">
        <span>FAULT / 08</span>
        <span>FIELD RECORD</span>
      </div>
      <div
        className="preloader__counter"
        role="progressbar"
        aria-label="Loading the archive"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span>{progress.toString().padStart(3, "0")}</span>
        <sup>%</sup>
      </div>
      <div className="preloader__track" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <p>Calibrating surface pressure</p>
    </div>
  );
}

function App() {
  const previewMode = new URLSearchParams(window.location.search).has("preview");
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorLabelRef = useRef<HTMLSpanElement>(null);
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { progress, visible: loading } = usePreloader();

  useEffect(() => {
    if (!menuOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.body.classList.add("menu-is-open");
    window.addEventListener("keydown", closeOnEscape);
    firstMenuLinkRef.current?.focus();

    return () => {
      document.body.classList.remove("menu-is-open");
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const cursor = cursorRef.current;
    const label = cursorLabelRef.current;
    const root = rootRef.current;

    if (previewMode || !finePointer || reducedMotion || !cursor || !label || !root) return;

    document.documentElement.classList.add("has-custom-cursor");
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.28, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.28, ease: "power3" });

    const moveCursor = (event: PointerEvent) => {
      xTo(event.clientX);
      yTo(event.clientY);
      cursor.dataset.visible = "true";
    };

    const updateCursor = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      const interactive = target.closest<HTMLElement>("[data-cursor]");
      const labelText = interactive?.dataset.cursor ?? "";
      cursor.dataset.active = interactive ? "true" : "false";
      label.textContent = labelText;
    };

    const hideCursor = () => {
      cursor.dataset.visible = "false";
    };

    window.addEventListener("pointermove", moveCursor);
    root.addEventListener("pointerover", updateCursor);
    document.documentElement.addEventListener("mouseleave", hideCursor);

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", moveCursor);
      root.removeEventListener("pointerover", updateCursor);
      document.documentElement.removeEventListener("mouseleave", hideCursor);
    };
  }, [previewMode]);

  useLayoutEffect(() => {
    if (loading || !rootRef.current) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let lenis: Lenis | null = null;
    let ticker: ((time: number) => void) | null = null;

    if (!reducedMotion && finePointer && !previewMode) {
      lenis = new Lenis({
        lerp: 0.075,
        smoothWheel: true,
        syncTouch: false,
      });
      lenis.on("scroll", ScrollTrigger.update);
      ticker = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);
    }

    const context = gsap.context(() => {
      const notifyPreviewReady = () => {
        if (previewMode && window.parent !== window) {
          window.parent.postMessage(
            { type: "fault-preview-ready" },
            window.location.origin,
          );
        }
      };

      gsap.to(".site-progress__fill", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.15,
        },
      });

      if (reducedMotion) {
        notifyPreviewReady();
        return;
      }

      const opening = gsap.timeline({ defaults: { ease: "power4.out" } });
      opening
        .fromTo(
          ".hero__letter",
          { yPercent: 112, rotate: 7 },
          {
            yPercent: 0,
            rotate: 0,
            duration: 1.45,
            stagger: 0.065,
            clearProps: "transform",
          },
        )
        .fromTo(
          ".hero__media-mask",
          { clipPath: "inset(100% 0 0 0)" },
          { clipPath: "inset(0% 0 0 0)", duration: 1.25 },
          0.18,
        )
        .fromTo(
          ".hero__slash",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.95 },
          0.48,
        )
        .fromTo(
          ".hero__meta-item",
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.07 },
          0.62,
        );
      opening.eventCallback("onComplete", notifyPreviewReady);

      gsap.to(".hero__image", {
        yPercent: 11,
        scale: 1.065,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 0.9,
        },
      });

      gsap.to(".hero__word", {
        xPercent: -4.5,
        force3D: false,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });

      gsap.fromTo(
        ".thesis__rule",
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".thesis",
            start: "top 75%",
            end: "bottom 65%",
            scrub: true,
          },
        },
      );

      gsap.utils
        .toArray<HTMLElement>(".statement__line-inner")
        .forEach((line, index) => {
          gsap.fromTo(
            line,
            { yPercent: 112, rotate: index % 2 === 0 ? 2 : -2 },
            {
              yPercent: 0,
              rotate: 0,
              ease: "power4.out",
              scrollTrigger: {
                trigger: line,
                start: "top 90%",
                end: "top 58%",
                scrub: 0.65,
              },
            },
          );
        });

      const media = gsap.matchMedia();
      media.add("(min-width: 900px)", () => {
        const track = trackRef.current;
        const section = archiveRef.current;
        if (!track || !section) return;

        const travel = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const horizontalTween = gsap.to(track, {
          x: () => -travel(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${travel()}`,
            pin: true,
            scrub: 0.75,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        gsap.to(".archive__progress-fill", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${travel()}`,
            scrub: true,
          },
        });

        gsap.utils
          .toArray<HTMLElement>(".panel__image img")
          .forEach((image) => {
            gsap.fromTo(
              image,
              { scale: 1.09 },
              {
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: image,
                  containerAnimation: horizontalTween,
                  start: "left right",
                  end: "right left",
                  scrub: true,
                },
              },
            );
          });
      });

      gsap.fromTo(
        ".index__number",
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)",
          ease: "none",
          scrollTrigger: {
            trigger: ".index",
            start: "top 80%",
            end: "top 15%",
            scrub: 0.9,
          },
        },
      );

      gsap.fromTo(
        ".index__fact span:last-child",
        { xPercent: 18 },
        {
          xPercent: 0,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".index__facts",
            start: "top 75%",
          },
        },
      );

      gsap.to(".finale__signal", {
        xPercent: 28,
        ease: "none",
        scrollTrigger: {
          trigger: ".finale",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      return () => media.revert();
    }, rootRef);

    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh).catch(() => undefined);
    window.addEventListener("load", refresh, { once: true });

    return () => {
      window.removeEventListener("load", refresh);
      context.revert();
      if (ticker) gsap.ticker.remove(ticker);
      lenis?.destroy();
    };
  }, [loading, previewMode]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <Preloader progress={progress} visible={loading} />
      <div
        ref={cursorRef}
        className="cursor"
        data-visible="false"
        data-active="false"
        aria-hidden="true"
      >
        <span ref={cursorLabelRef} />
      </div>

      <div ref={rootRef} className="site-shell">
        <div className="site-progress" aria-hidden="true">
          <span className="site-progress__fill" />
        </div>

        <a className="skip-link" href="#manifest">
          Skip to the manifesto
        </a>

        <header className="site-header">
          <a className="brand" href="#top" data-cursor="TOP">
            <span>FAULT</span>
            <em>/08</em>
          </a>
          <div className="site-header__coordinates" aria-hidden="true">
            <span>40°50′ N</span>
            <span>14°15′ E</span>
          </div>
          <button
            className="menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
            data-cursor={menuOpen ? "CLOSE" : "OPEN"}
          >
            <span>{menuOpen ? "Close" : "Index"}</span>
            <i aria-hidden="true" />
          </button>
        </header>

        <aside
          id="site-menu"
          className={`site-menu ${menuOpen ? "is-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <div className="site-menu__meta">
            <span>Field archive</span>
            <span>Edition 08 / 2026</span>
          </div>
          <nav aria-label="Section index">
            <a
              ref={firstMenuLinkRef}
              href="#manifest"
              tabIndex={menuOpen ? 0 : -1}
              onClick={closeMenu}
              data-cursor="GO"
            >
              <small>01</small>
              <span>Manifest</span>
            </a>
            <a
              href="#archive"
              tabIndex={menuOpen ? 0 : -1}
              onClick={closeMenu}
              data-cursor="GO"
            >
              <small>02</small>
              <span>Contact sheets</span>
            </a>
            <a
              href="#index"
              tabIndex={menuOpen ? 0 : -1}
              onClick={closeMenu}
              data-cursor="GO"
            >
              <small>03</small>
              <span>Material index</span>
            </a>
          </nav>
          <p>Nothing disappears. It changes pressure.</p>
        </aside>

        <main>
          <section className="hero" id="top" aria-labelledby="hero-title">
            <h1 id="hero-title" className="sr-only">
              FAULT / 08 — an archive of pressure
            </h1>

            <div className="hero__masthead" aria-hidden="true">
              <div className="hero__word">
                {"FAULT".split("").map((letter, index) => (
                  <span className="hero__letter-wrap" key={`${letter}-${index}`}>
                    <span className="hero__letter">{letter}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="hero__media">
              <div className="hero__media-mask" data-cursor="VIEW">
                <img
                  className="hero__image"
                  src="./images/fault-hero.webp"
                  alt="A performer in a weathered red coat turning in a pale limestone quarry."
                  width="1120"
                  height="1400"
                  fetchPriority="high"
                />
              </div>
              <div className="hero__media-code" aria-hidden="true">
                <span>REC_08—A</span>
                <span>∆P 101.3 kPa</span>
              </div>
            </div>

            <div className="hero__slash" aria-hidden="true">
              <span>LIVE MATERIAL</span>
            </div>

            <div className="hero__edition hero__meta-item">
              <span>ISSUE</span>
              <strong>08</strong>
              <span>MMXXVI</span>
            </div>

            <p className="hero__intro hero__meta-item">
              A field archive of movement, matter
              <br />
              and what remains after contact.
            </p>

            <div className="hero__location hero__meta-item">
              <span>THE QUARRY</span>
              <span>UNSTABLE TERRAIN</span>
            </div>

            <a className="hero__scroll hero__meta-item" href="#manifest">
              <span>Descend</span>
              <i aria-hidden="true">↓</i>
            </a>
          </section>

          <section className="thesis" id="manifest" aria-labelledby="thesis-title">
            <div className="thesis__rail">
              <p>01 / Manifest</p>
              <span className="thesis__rule" aria-hidden="true" />
              <p>Read vertically<br />from the surface</p>
            </div>

            <div className="thesis__content">
              <p className="thesis__kicker">A study in four movements</p>
              <h2 id="thesis-title" className="statement">
                <span className="statement__line">
                  <span className="statement__line-inner">Pressure</span>
                </span>
                <span className="statement__line statement__line--offset">
                  <span className="statement__line-inner">
                    leaves a <em>visible</em>
                  </span>
                </span>
                <span className="statement__line statement__line--end">
                  <span className="statement__line-inner">record.</span>
                </span>
              </h2>

              <div className="thesis__notes">
                <p>
                  Stone remembers the blade. Cloth remembers the wind. A body
                  remembers the room it had to cross.
                </p>
                <p>
                  FAULT is not a location. It is the instant when force becomes
                  form.
                </p>
              </div>
            </div>

            <div className="thesis__stamp" aria-hidden="true">
              <span>FIELD NOTE</span>
              <strong>101.3</strong>
              <span>KILOPASCALS</span>
            </div>
          </section>

          <section
            ref={archiveRef}
            className="archive"
            id="archive"
            aria-labelledby="archive-title"
          >
            <div className="archive__fixed-label" aria-hidden="true">
              <span>02 / Contact sheets</span>
              <div className="archive__progress">
                <i className="archive__progress-fill" />
              </div>
            </div>

            <div ref={trackRef} className="archive__track">
              <article className="panel panel--cover">
                <div className="panel__cover-grid" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="panel__cover-index">02—05</div>
                <h2 id="archive-title">
                  Contact
                  <br />
                  <em>sheets</em>
                </h2>
                <p>
                  Four observations arranged by pressure,
                  <br />
                  not by chronology.
                </p>
                <span className="panel__turn">Drag nothing / keep moving →</span>
              </article>

              <figure className="panel panel--contact">
                <div className="panel__number" aria-hidden="true">A—01</div>
                <div className="panel__image panel__image--contact" data-cursor="HOLD">
                  <img
                    src="./images/fault-contact.webp"
                    alt="A limestone-dusted hand touching a quarry wall, framed by red cloth."
                    width="1536"
                    height="1024"
                    loading="lazy"
                  />
                </div>
                <figcaption>
                  <span>Contact / Surface 14</span>
                  <p>
                    The hand reads before the eye.
                    <br />
                    Dust is the first transcript.
                  </p>
                  <small>FRAME 1:250 — NO RETOUCH</small>
                </figcaption>
              </figure>

              <figure className="panel panel--passage">
                <div className="panel__number" aria-hidden="true">A—02</div>
                <div className="panel__image panel__image--passage" data-cursor="ENTER">
                  <img
                    src="./images/fault-passage.webp"
                    alt="A performer in a red coat standing between high limestone cuts."
                    width="1536"
                    height="1024"
                    loading="lazy"
                  />
                </div>
                <figcaption>
                  <span>Passage / Cut 08</span>
                  <p>The body becomes scale.</p>
                  <small>NARROW FIELD — WIND NNE</small>
                </figcaption>
                <p className="panel__vertical" aria-hidden="true">
                  THERE IS NO NEUTRAL SURFACE
                </p>
              </figure>

              <article className="panel panel--register">
                <div className="panel__register-top">
                  <span>03:18:07</span>
                  <span>REGISTER / ACTIVE</span>
                </div>
                <div className="panel__register-mark" aria-hidden="true">
                  <span>Δ</span>
                  <span>P</span>
                </div>
                <blockquote>
                  “What looks still
                  <br />
                  is only moving
                  <br />
                  below our scale.”
                </blockquote>
                <p>End of contact sequence / continue to material index</p>
              </article>
            </div>
          </section>

          <section className="index" id="index" aria-labelledby="index-title">
            <div className="index__header">
              <p>03 / Material index</p>
              <p>Calibrated 30.07.26</p>
            </div>

            <div className="index__body">
              <div className="index__number" aria-hidden="true">08</div>
              <div className="index__copy">
                <p>Sample group</p>
                <h2 id="index-title">
                  Evidence is
                  <br />
                  a matter of scale.
                </h2>
                <p>
                  Every measurement is a crop. Move closer and certainty loses
                  its edge.
                </p>
              </div>
            </div>

            <dl className="index__facts">
              {archiveFacts.map(([term, description], index) => (
                <div
                  className="index__fact"
                  key={term}
                  style={{ "--fact-index": index + 1 } as CSSProperties}
                >
                  <dt>
                    <small>0{index + 1}</small>
                    <span>{term}</span>
                  </dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="finale" aria-labelledby="finale-title">
            <div className="finale__signal" aria-hidden="true">
              FAULT / FAULT / FAULT /
            </div>
            <div className="finale__top">
              <span>End note / 08</span>
              <span>Archive remains open</span>
            </div>
            <h2 id="finale-title">
              Nothing
              <br />
              disappears.
            </h2>
            <p>It changes pressure.</p>
            <a href="#top" data-cursor="REPLAY">
              <span>Return to the surface</span>
              <i aria-hidden="true">↑</i>
            </a>
          </section>
        </main>

        <footer className="site-footer">
          <span>FAULT / 08</span>
          <span>An independent digital field study</span>
          <span>© 2026 — Edition one of one</span>
        </footer>
      </div>
    </>
  );
}

export default App;
