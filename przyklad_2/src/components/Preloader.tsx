import { type CSSProperties, useEffect, useRef } from "react";
import gsap from "gsap";

type PreloaderProps = {
  onReady: () => void;
};

export function Preloader({ onReady }: PreloaderProps) {
  const preloaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = preloaderRef.current;
    if (!element) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    document.documentElement.classList.add("is-loading");

    if (reducedMotion) {
      document.documentElement.classList.remove("is-loading");
      onReady();
      return;
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        document.documentElement.classList.remove("is-loading");
        onReady();
      },
    });

    timeline
      .fromTo(
        ".calibration-node",
        { scaleY: 0.08 },
        {
          scaleY: 1,
          duration: 0.42,
          stagger: 0.07,
          ease: "power3.out",
        },
      )
      .to(".calibration-node", {
        scaleY: 0.24,
        duration: 0.26,
        stagger: { each: 0.04, from: "edges" },
        ease: "power2.inOut",
      })
      .to(
        ".calibration-trace",
        { scaleX: 1, duration: 0.72, ease: "power2.inOut" },
        0.18,
      )
      .to(
        element,
        {
          clipPath: "inset(0 0 100% 0)",
          duration: 0.68,
          ease: "power4.inOut",
        },
        0.96,
      );

    return () => {
      timeline.kill();
      document.documentElement.classList.remove("is-loading");
    };
  }, [onReady]);

  return (
    <div
      ref={preloaderRef}
      className="preloader"
      role="status"
      aria-label="Calibrating surface pressure"
    >
      <div className="preloader-topline">
        <span>SENTRACKER / TRC-01</span>
        <span>Surface calibration</span>
      </div>
      <div className="calibration-field" aria-hidden="true">
        {Array.from({ length: 13 }, (_, index) => (
          <i
            className="calibration-node"
            key={index}
            style={{ "--node": index } as CSSProperties}
          />
        ))}
        <span className="calibration-trace" />
      </div>
      <p className="preloader-status">
        Pressure enters.
        <br />
        Direction returns.
      </p>
    </div>
  );
}
