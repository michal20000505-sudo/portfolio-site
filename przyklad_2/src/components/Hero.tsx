import { useEffect, useRef } from "react";
import { LiquidGlassText } from "./LiquidGlassText";

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(pointer: coarse)").matches) return;

    const onPointerMove = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      hero.style.setProperty("--pointer-x", x.toFixed(3));
      hero.style.setProperty("--pointer-y", y.toFixed(3));
    };

    const onPointerLeave = () => {
      hero.style.setProperty("--pointer-x", "0");
      hero.style.setProperty("--pointer-y", "0");
    };

    hero.addEventListener("pointermove", onPointerMove, { passive: true });
    hero.addEventListener("pointerleave", onPointerLeave);

    return () => {
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <section ref={heroRef} className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-word hero-word--top" aria-hidden="true">
        <span className="word">GROUND</span>
      </div>
      <div className="hero-product-frame" data-cursor="ROTATE / 01">
        <div className="hero-product-reveal">
          <div className="hero-product-tilt">
            <div className="hero-orbit" aria-hidden="true" />
            <img
              src="/images/trc-01-cutout.webp"
              alt="SENTRACKER TRC-01 technical trail sneaker in deep plum and acid yellow"
              width="1536"
              height="1024"
              fetchPriority="high"
            />
            <div className="hero-scan" aria-hidden="true" />
            <svg
              className="hero-trajectory"
              viewBox="0 0 1000 600"
              aria-hidden="true"
            >
              <path d="M40 485C212 520 272 110 520 188S724 514 960 86" />
              <circle cx="520" cy="188" r="7" />
            </svg>
            <div
              className="hero-callout hero-callout--upper"
              aria-hidden="true"
            >
              <span>01 / UPPER</span>
              <strong>Woven ripstop</strong>
            </div>
            <div
              className="hero-callout hero-callout--frame"
              aria-hidden="true"
            >
              <span>02 / FRAME</span>
              <strong>Smoked TPU</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="hero-word hero-word--bottom" aria-hidden="true">
        <span className="word liquid-glass-shell liquid-glass-shell--feedback">
          <LiquidGlassText>FEEDBACK</LiquidGlassText>
        </span>
      </div>
      <div className="hero-meta">
        <p>Trail traction prototype</p>
        <p>TRC-01 / Field study 01</p>
      </div>
      <div className="hero-deck">
        <span>TRAIL RESEARCH / OBJECT 01</span>
        <p>
          A trail prototype tuned for wet asphalt, loose gravel and the split
          second between them.
        </p>
      </div>
      <div className="hero-index">
        <span>01 / 08</span>
        <p>Contact maps the route.</p>
      </div>
      <h1 id="hero-title" className="sr-only">
        SENTRACKER TRC-01. The trail writes back.
      </h1>
      <p className="hero-slogan">
        <span>The trail</span>
        <em>writes back.</em>
      </p>
      <a className="scroll-signal" href="#movement">
        <span>Inspect the contact system</span>
        <i aria-hidden="true" />
      </a>
      <dl className="hero-spec-list" aria-label="TRC-01 material specification">
        <div>
          <dt>Upper</dt>
          <dd>Woven ripstop</dd>
        </div>
        <div>
          <dt>Frame</dt>
          <dd>Smoked TPU</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>Segmented rubber</dd>
        </div>
      </dl>
      <p className="hero-serial" aria-hidden="true">
        ST/TRC/01 / FIELD SIGNAL
      </p>
    </section>
  );
}
