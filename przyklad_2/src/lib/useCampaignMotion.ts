import { type RefObject, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function useCampaignMotion(
  scope: RefObject<HTMLDivElement | null>,
  ready: boolean,
  previewMode = false,
) {
  useLayoutEffect(() => {
    if (!ready || !scope.current) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isMobile = window.matchMedia(
      "(max-width: 760px), (max-width: 950px) and (max-height: 500px)",
    ).matches;

    // Tells the portfolio card the hero has finished its opening beat, so the
    // card can drop its placeholder. The card never scrolls this frame.
    const notifyPreviewReady = () => {
      if (previewMode && window.parent !== window) {
        window.parent.postMessage(
          { type: "sentracker-preview-ready" },
          window.location.origin,
        );
      }
    };

    if (reduceMotion) {
      document.documentElement.classList.add("reduced-motion");
      notifyPreviewReady();
      return () => document.documentElement.classList.remove("reduced-motion");
    }

    const terrainScrollVideo =
      scope.current.querySelector<HTMLVideoElement>(".terrain-scroll-video");

    const movementFrames = Array.from(
      scope.current.querySelectorAll<HTMLImageElement>(
        ".movement-spin-frame",
      ),
    );
    const movementFrameCounter =
      scope.current.querySelector<HTMLElement>(".movement-frame-counter");
    const movementProductWrap =
      scope.current.querySelector<HTMLElement>(".movement-product-wrap");
    const movementShutter =
      scope.current.querySelector<HTMLElement>(".movement-shutter");
    const movementOrbitBar =
      scope.current.querySelector<HTMLElement>(".movement-orbit-track i");
    const movementCameraMark =
      scope.current.querySelector<HTMLElement>(".movement-camera-mark");
    const movementTrajectoryPath =
      scope.current.querySelector<SVGPathElement>(".trajectory-path");
    const movementTrajectoryHead =
      scope.current.querySelector<SVGGElement>(".trajectory-head");
    let activeMovementFrame = 0;
    let movementTrajectoryLength =
      movementTrajectoryPath?.getTotalLength() ?? 0;
    let movementProductWidth = movementProductWrap?.clientWidth ?? 0;

    if (movementTrajectoryPath && movementTrajectoryLength > 0) {
      movementTrajectoryPath.style.strokeDasharray =
        `${movementTrajectoryLength} ${movementTrajectoryLength}`;
    }

    movementFrames.forEach((frame) => {
      if (typeof frame.decode === "function") {
        void frame.decode().catch(() => undefined);
      }
    });

    const clamp = (value: number, minimum: number, maximum: number) =>
      Math.min(maximum, Math.max(minimum, value));

    const terrainVideoDuration = 1;
    const terrainVideoFrameRate = 24;
    let pendingTerrainVideoFrame = 0;
    let renderedTerrainVideoFrame = -1;

    const renderTerrainVideo = (rawProgress: number) => {
      if (!terrainScrollVideo) return;

      pendingTerrainVideoFrame = Math.round(
        clamp(rawProgress, 0, 1) * terrainVideoFrameRate,
      );

      if (
        terrainScrollVideo.readyState < HTMLMediaElement.HAVE_METADATA ||
        pendingTerrainVideoFrame === renderedTerrainVideoFrame
      ) {
        return;
      }

      const availableDuration = Number.isFinite(terrainScrollVideo.duration)
        ? Math.max(0, terrainScrollVideo.duration - 0.001)
        : terrainVideoDuration;
      const targetTime = Math.min(
        pendingTerrainVideoFrame / terrainVideoFrameRate,
        terrainVideoDuration,
        availableDuration,
      );

      renderedTerrainVideoFrame = pendingTerrainVideoFrame;
      terrainScrollVideo.currentTime = targetTime;
    };

    const syncTerrainVideoMetadata = () => {
      renderedTerrainVideoFrame = -1;
      renderTerrainVideo(pendingTerrainVideoFrame / terrainVideoFrameRate);
    };

    terrainScrollVideo?.addEventListener(
      "loadedmetadata",
      syncTerrainVideoMetadata,
    );

    const smoothstep = (edgeStart: number, edgeEnd: number, value: number) => {
      const progress = clamp(
        (value - edgeStart) / (edgeEnd - edgeStart),
        0,
        1,
      );

      return progress * progress * (3 - 2 * progress);
    };

    const renderMovementOrbit = (rawProgress: number) => {
      if (movementFrames.length === 0) return;

      const progress = clamp(rawProgress, 0, 1);
      const frameCount = movementFrames.length;
      const phase = progress >= 1 ? frameCount : progress * frameCount;
      const fromFrame =
        progress >= 1 ? frameCount - 1 : Math.floor(phase);
      const toFrame = (fromFrame + 1) % frameCount;
      const localProgress = progress >= 1 ? 1 : phase - fromFrame;
      const blend = smoothstep(0.18, 0.82, localProgress);
      const shutterCut = -6 + blend * 112;
      const topCut = clamp(shutterCut + 6, 0, 100);
      const bottomCut = clamp(shutterCut - 6, 0, 100);
      const outgoingClip = `polygon(${topCut}% 0, 100% 0, 100% 100%, ${bottomCut}% 100%)`;
      const incomingClip = `polygon(0 0, ${topCut}% 0, ${bottomCut}% 100%, 0 100%)`;
      const dominantFrame = blend < 0.5 ? fromFrame : toFrame;

      movementFrames.forEach((frame, index) => {
        const isOutgoing = index === fromFrame;
        const isIncoming = index === toFrame;
        const isVisible = isOutgoing || isIncoming;

        frame.style.visibility = isVisible ? "visible" : "hidden";
        frame.style.opacity = isVisible ? "1" : "0";
        frame.style.zIndex = isIncoming ? "2" : "1";
        frame.style.willChange = isVisible
          ? "clip-path, transform"
          : "auto";

        if (isOutgoing) {
          frame.style.clipPath = outgoingClip;
          frame.style.transform = `translate3d(${-0.55 * blend}%, 0, 0) scale(${
            1 - 0.006 * blend
          })`;
        } else if (isIncoming) {
          frame.style.clipPath = incomingClip;
          frame.style.transform = `translate3d(${
            0.55 * (1 - blend)
          }%, 0, 0) scale(${0.994 + 0.006 * blend})`;
        } else {
          frame.style.clipPath = "inset(0 100% 0 0)";
          frame.style.transform = "none";
        }
      });

      if (dominantFrame !== activeMovementFrame) {
        movementFrames[activeMovementFrame]?.classList.remove("is-active");
        movementFrames[dominantFrame]?.classList.add("is-active");
        activeMovementFrame = dominantFrame;
      }

      if (movementFrameCounter) {
        movementFrameCounter.textContent =
          progress >= 0.999
            ? "360° / LOOP"
            : `${String(dominantFrame + 1).padStart(2, "0")} / ${String(
                frameCount,
              ).padStart(2, "0")}`;
        movementFrameCounter.style.opacity = String(
          0.42 + 0.58 * Math.min(1, Math.abs(localProgress - 0.5) * 2.8),
        );
        movementFrameCounter.style.transform = `translateY(${
          (0.5 - Math.abs(localProgress - 0.5)) * 4
        }px)`;
      }

      if (movementShutter) {
        movementShutter.style.setProperty(
          "--shutter-x",
          `${movementProductWidth * (shutterCut / 100)}px`,
        );
        movementShutter.style.opacity = String(
          Math.sin(Math.PI * blend) * 0.82,
        );
      }

      if (movementOrbitBar) {
        movementOrbitBar.style.transform = `scaleX(${progress})`;
      }

      if (movementCameraMark) {
        movementCameraMark.style.setProperty(
          "--camera-angle",
          `${progress}turn`,
        );
      }

      if (movementTrajectoryPath && movementTrajectoryLength > 0) {
        movementTrajectoryPath.style.strokeDashoffset = `${
          movementTrajectoryLength * (1 - progress)
        }`;

        if (movementTrajectoryHead) {
          const point = movementTrajectoryPath.getPointAtLength(
            movementTrajectoryLength * progress,
          );
          const edgeFade = Math.min(
            1,
            progress * 18,
            (1 - progress) * 18,
          );

          movementTrajectoryHead.setAttribute(
            "transform",
            `translate(${point.x} ${point.y})`,
          );
          movementTrajectoryHead.style.opacity = String(edgeFade);
        }
      }
    };

    // Inside the portfolio card there is nothing to scroll, and smooth-scroll
    // hijacking would only fight the parent page.
    const lenis = previewMode
      ? null
      : new Lenis({
          duration: 0.9,
          smoothWheel: true,
          syncTouch: false,
          wheelMultiplier: 0.82,
        });

    const updateScrollTrigger = () => ScrollTrigger.update();
    const updateLenis = (time: number) => lenis?.raf(time * 1000);

    if (lenis) {
      lenis.on("scroll", updateScrollTrigger);
      gsap.ticker.add(updateLenis);
      gsap.ticker.lagSmoothing(0);
    }

    const context = gsap.context(() => {
      const opening = gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .from(".hero-word .word", {
          yPercent: 115,
          stagger: 0.07,
          duration: 1.1,
        })
        .from(
          ".hero-product-reveal",
          {
            clipPath: "inset(48% 0 48% 0)",
            yPercent: 7,
            scale: 0.94,
            duration: 1.15,
          },
          0.1,
        )
        .from(
          ".hero-callout",
          {
            autoAlpha: 0,
            x: -14,
            duration: 0.55,
            stagger: 0.08,
          },
          0.52,
        )
        .from(
          ".hero-meta, .hero-index, .hero-deck, .hero-spec-list, .hero-slogan, .hero-serial, .scroll-signal",
          { autoAlpha: 0, duration: 0.5, stagger: 0.06 },
          0.62,
        );

      opening.eventCallback("onComplete", notifyPreviewReady);

      gsap.to(".hero-product-frame", {
        yPercent: isMobile ? 4 : 8,
        rotate: isMobile ? 0 : 1,
        scale: isMobile ? 1.01 : 1.025,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: isMobile ? 0.7 : 1.15,
          invalidateOnRefresh: true,
        },
      });

      gsap.to(".hero-word--top", {
        xPercent: isMobile ? -1 : -3,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.15,
          invalidateOnRefresh: true,
        },
      });

      gsap.to(".hero-word--bottom", {
        xPercent: isMobile ? 1 : 3,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.15,
          invalidateOnRefresh: true,
        },
      });

      if (movementFrames.length > 0) {
        const movementOrbit = { progress: 0 };

        renderMovementOrbit(0);

        gsap
          .timeline({
            scrollTrigger: {
              trigger: ".movement",
              start: "top top",
              end: "bottom bottom",
              scrub: isMobile ? 0.16 : 0.32,
              invalidateOnRefresh: true,
              onRefresh: () => {
                movementTrajectoryLength =
                  movementTrajectoryPath?.getTotalLength() ?? 0;
                movementProductWidth = movementProductWrap?.clientWidth ?? 0;
                if (movementTrajectoryPath && movementTrajectoryLength > 0) {
                  movementTrajectoryPath.style.strokeDasharray =
                    `${movementTrajectoryLength} ${movementTrajectoryLength}`;
                }
                renderMovementOrbit(movementOrbit.progress);
              },
            },
          })
          .to(
            movementOrbit,
            {
              progress: 1,
              duration: 1,
              ease: "none",
              onUpdate: () => renderMovementOrbit(movementOrbit.progress),
            },
            0,
          )
          .fromTo(
            movementProductWrap,
            {
              yPercent: 1.5,
              scale: 0.985,
            },
            {
              yPercent: -1.5,
              scale: 1.015,
              duration: 1,
              ease: "none",
            },
            0,
          )
          .to(
            ".movement-stage",
            {
              backgroundColor: "#2a1043",
              duration: 0.42,
              ease: "none",
            },
            0.58,
          );
      }

      gsap.utils.toArray<HTMLElement>(".chapter-mark").forEach((mark) => {
        gsap.from(mark, {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 0.8,
          ease: "expo.out",
          scrollTrigger: {
            trigger: mark,
            start: "top 84%",
          },
        });
      });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".construction",
            start: "top 75%",
            end: "bottom 30%",
            scrub: isMobile ? 0.65 : 0.9,
            invalidateOnRefresh: true,
          },
        })
        .fromTo(
          ".construction-product-stage",
          {
            rotate: isMobile ? -3 : -7,
            scale: isMobile ? 0.94 : 0.86,
            xPercent: isMobile ? 2 : 8,
          },
          {
            rotate: isMobile ? 1 : 3,
            scale: isMobile ? 1 : 1.02,
            xPercent: isMobile ? 0 : -2,
            ease: "power2.inOut",
          },
        )
        .from(
          ".construction-callout",
          {
            x: (index) => (index % 2 ? (isMobile ? 24 : 48) : isMobile ? -24 : -48),
            opacity: 0,
            stagger: 0.08,
            ease: "expo.out",
          },
          0.12,
        )
        .from(
          ".construction-hotspot",
          {
            y: 8,
            autoAlpha: 0,
            stagger: 0.06,
            ease: "expo.out",
          },
          0.18,
        );

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".terrain",
            start: "top top",
            end: "bottom bottom",
            scrub: isMobile ? 0.7 : 0.95,
            invalidateOnRefresh: true,
            onUpdate: (self) => renderTerrainVideo(self.progress),
            onRefresh: (self) => renderTerrainVideo(self.progress),
          },
        })
        .fromTo(
          ".terrain-image",
          {
            scale: isMobile ? 1.05 : 1.08,
            clipPath: isMobile ? "inset(0 0 0 0)" : "inset(0 24% 0 0)",
          },
          {
            scale: 1,
            clipPath: "inset(0 0% 0 0)",
            ease: "power1.inOut",
          },
        )
        .fromTo(
          ".terrain-word--city",
          { xPercent: 0, opacity: 1 },
          {
            xPercent: isMobile ? -8 : -28,
            opacity: 0.18,
            ease: "power1.in",
          },
          0.15,
        )
        .fromTo(
          ".terrain-word--field",
          { xPercent: isMobile ? 8 : 34, opacity: 0 },
          { xPercent: 0, opacity: 1, ease: "power1.out" },
          0.45,
        )
        .to(".terrain-scan", { xPercent: 115, ease: "none" }, 0);

      gsap.fromTo(
        ".macro-image",
        {
          scale: isMobile ? 1.08 : 1.12,
          clipPath: "inset(0 0 100% 0)",
        },
        {
          scale: 1,
          clipPath: "inset(0 0 0% 0)",
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".focus",
            start: "top 70%",
            end: "55% 55%",
            scrub: 0.6,
          },
        },
      );

      gsap.from(".focus-display span", {
        yPercent: 110,
        rotate: 2,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: {
          trigger: ".focus-display",
          start: "top 82%",
        },
      });

      gsap.fromTo(
        ".focus-exploded-image",
        {
          yPercent: isMobile ? 3 : 6,
          scale: isMobile ? 0.985 : 0.96,
        },
        {
          yPercent: isMobile ? -2 : -4,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".focus-exploded",
            start: "top 88%",
            end: "bottom 28%",
            scrub: isMobile ? 0.65 : 0.9,
            invalidateOnRefresh: true,
          },
        },
      );

      gsap.from(".material-list > div", {
        x: isMobile ? -12 : -24,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.75,
        ease: "expo.out",
        scrollTrigger: {
          trigger: ".focus-exploded",
          start: "top 78%",
        },
      });

      gsap.to(".colorway-product", {
        rotate: isMobile ? -1.5 : -3,
        yPercent: isMobile ? -2 : -3,
        ease: "sine.inOut",
        scrollTrigger: {
          trigger: ".colorways",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.15,
          invalidateOnRefresh: true,
        },
      });

      gsap.from(".signal-selector-heading", {
        x: isMobile ? 0 : -18,
        y: isMobile ? 12 : 0,
        autoAlpha: 0,
        duration: 0.65,
        ease: "expo.out",
        scrollTrigger: {
          trigger: ".colorways",
          start: "top 72%",
        },
      });

      gsap.from(".final-line span", {
        yPercent: 120,
        stagger: 0.08,
        duration: 1.1,
        ease: "expo.out",
        scrollTrigger: {
          trigger: ".final-statement",
          start: "top 68%",
        },
      });
    }, scope);

    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 80);

    return () => {
      window.clearTimeout(refreshTimer);
      context.revert();
      movementFrames.forEach((frame, index) => {
        frame.classList.toggle("is-active", index === 0);
        frame.style.removeProperty("visibility");
        frame.style.removeProperty("opacity");
        frame.style.removeProperty("z-index");
        frame.style.removeProperty("clip-path");
        frame.style.removeProperty("transform");
        frame.style.removeProperty("will-change");
      });
      activeMovementFrame = 0;
      if (movementFrameCounter) {
        movementFrameCounter.textContent = `01 / ${String(
          movementFrames.length,
        ).padStart(2, "0")}`;
        movementFrameCounter.style.removeProperty("opacity");
        movementFrameCounter.style.removeProperty("transform");
      }
      if (movementShutter) {
        movementShutter.style.removeProperty("--shutter-x");
        movementShutter.style.removeProperty("opacity");
      }
      if (movementOrbitBar) {
        movementOrbitBar.style.removeProperty("transform");
      }
      if (movementCameraMark) {
        movementCameraMark.style.removeProperty("--camera-angle");
      }
      if (movementTrajectoryPath) {
        movementTrajectoryPath.style.removeProperty("stroke-dasharray");
        movementTrajectoryPath.style.removeProperty("stroke-dashoffset");
      }
      if (movementTrajectoryHead) {
        movementTrajectoryHead.removeAttribute("transform");
        movementTrajectoryHead.style.removeProperty("opacity");
      }
      terrainScrollVideo?.removeEventListener(
        "loadedmetadata",
        syncTerrainVideoMetadata,
      );
      if (lenis) {
        gsap.ticker.remove(updateLenis);
        lenis.off("scroll", updateScrollTrigger);
        lenis.destroy();
      }
    };
  }, [ready, scope, previewMode]);
}
