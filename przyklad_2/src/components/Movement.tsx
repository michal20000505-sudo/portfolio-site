import { assetUrl } from "../lib/assetUrl";
import { LiquidGlassText } from "./LiquidGlassText";

const rotationFrames = Array.from({ length: 8 }, (_, index) => {
  const frame = String(index + 1).padStart(2, "0");

  return {
    full: assetUrl(`/images/trc-01-turn-${frame}.webp`),
    small: assetUrl(`/images/trc-01-turn-${frame}-sm.webp`),
  };
});

const trajectoryPath =
  "M-100 715C160 690 330 226 604 342c258 109 276 447 540 318 168-82 240-305 556-387";

export function Movement() {
  return (
    <section
      className="movement"
      id="movement"
      aria-labelledby="movement-title"
    >
      <div className="movement-stage">
        <div className="movement-grid" aria-hidden="true" />
        <div className="chapter-label chapter-label--light">
          <span>01 / TRAJECTORY</span>
          <span>360° camera orbit / 8 locked views</span>
        </div>
        <h2 id="movement-title" className="movement-title">
          <span>NO</span>
          <span className="sr-only">BLIND</span>
          <em>side.</em>
        </h2>
        <LiquidGlassText className="movement-title-outline">
          BLIND
        </LiquidGlassText>
        <svg
          className="movement-trajectory"
          viewBox="0 0 1600 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="trajectory-guide"
            d={trajectoryPath}
          />
          <path
            className="trajectory-path"
            d={trajectoryPath}
          />
          <g className="trajectory-head">
            <circle className="trajectory-head-ring" r="13" />
            <circle className="trajectory-head-core" r="4.5" />
          </g>
        </svg>
        <div className="movement-product-wrap" data-cursor="ORBIT / 01-08">
          <div className="movement-frame-stack">
            {rotationFrames.map((frame, index) => (
              <img
                key={frame.full}
                className={`movement-spin-frame${index === 0 ? " is-active" : ""}`}
                src={frame.full}
                srcSet={`${frame.small} 768w, ${frame.full} 1536w`}
                sizes="(max-width: 760px) 104vw, 68vw"
                alt={
                  index === 0
                    ? "TRC-01 trail shoe shown in an eight-angle 360-degree rotation study"
                    : ""
                }
                aria-hidden={index === 0 ? undefined : true}
                width="1536"
                height="1024"
                loading="eager"
                fetchPriority={index === 0 ? "high" : "low"}
                decoding="async"
              />
            ))}
          </div>
          <span className="movement-shutter" aria-hidden="true" />
          <span className="movement-camera-mark" aria-hidden="true">
            <i />
          </span>
        </div>
        <div className="movement-orbit-readout" aria-hidden="true">
          <div className="movement-orbit-meta">
            <span>CAMERA ORBIT / 360°</span>
            <strong className="movement-frame-counter">01 / 08</strong>
          </div>
          <div className="movement-orbit-track">
            <i />
          </div>
          <div className="movement-orbit-labels">
            <span>FRONT</span>
            <span>LATERAL</span>
            <span>REAR</span>
            <span>MEDIAL</span>
          </div>
        </div>
        <div className="telemetry-rail telemetry-rail--left" aria-hidden="true">
          <span>REST / 00</span>
          <span>LOAD / 17</span>
          <span>SHIFT / 41</span>
          <span>TRACE / 78</span>
          <span>FIELD / 99</span>
        </div>
        <div className="telemetry-rail telemetry-rail--right" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <p className="movement-copy">
          Eight angles.
          <br />
          Every joint exposed.
        </p>
        <span className="movement-axis" aria-hidden="true">
          X / 0.00 → 1.00
        </span>
      </div>
    </section>
  );
}
