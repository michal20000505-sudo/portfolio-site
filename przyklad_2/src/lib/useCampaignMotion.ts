import { type RefObject, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function useCampaignMotion(
  scope: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  useLayoutEffect(() => {
    if (!ready || !scope.current) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isMobile = window.matchMedia("(max-width: 760px)").matches;

    if (reduceMotion) {
      document.documentElement.classList.add("reduced-motion");
      return () => document.documentElement.classList.remove("reduced-motion");
    }

    const lenis = new Lenis({
      duration: 0.9,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.82,
    });

    const updateScrollTrigger = () => ScrollTrigger.update();
    const updateLenis = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", updateScrollTrigger);
    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .from(".hero-word .word", {
          yPercent: 115,
          stagger: 0.07,
          duration: 1.1,
        })
        .from(
          ".hero-product-tilt",
          {
            clipPath: "inset(48% 0 48% 0)",
            yPercent: 7,
            scale: 0.94,
            duration: 1.15,
          },
          0.1,
        )
        .from(
          ".hero-meta, .hero-index, .scroll-signal",
          { autoAlpha: 0, duration: 0.5, stagger: 0.06 },
          0.65,
        );

      gsap.to(".hero-product-frame", {
        yPercent: isMobile ? 8 : 15,
        rotate: isMobile ? 0 : 2,
        scale: isMobile ? 1.02 : 1.05,
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

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".movement",
            start: "top top",
            end: "bottom bottom",
            scrub: isMobile ? 0.8 : 1.2,
            invalidateOnRefresh: true,
          },
        })
        .fromTo(
          ".movement-product",
          {
            xPercent: isMobile ? -5 : -8,
            yPercent: isMobile ? 8 : 10,
            rotate: isMobile ? -3 : -8,
            scale: isMobile ? 0.94 : 0.88,
          },
          {
            xPercent: isMobile ? 3 : 7,
            yPercent: isMobile ? -3 : -6,
            rotate: isMobile ? 1 : 4,
            scale: isMobile ? 1.02 : 1.06,
            ease: "power1.inOut",
          },
        )
        .fromTo(
          ".movement-ghost--one",
          { xPercent: isMobile ? -12 : -18, opacity: 0 },
          {
            xPercent: isMobile ? 2 : 5,
            opacity: isMobile ? 0.09 : 0.14,
            ease: "power1.out",
          },
          0,
        )
        .fromTo(
          ".movement-ghost--two",
          { xPercent: isMobile ? -18 : -26, opacity: 0 },
          {
            xPercent: isMobile ? -3 : -6,
            opacity: isMobile ? 0.04 : 0.07,
            ease: "power1.out",
          },
          0,
        )
        .fromTo(
          ".trajectory-path",
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, ease: "none" },
          0,
        )
        .to(
          ".movement-stage",
          { backgroundColor: "#2a1043", ease: "none" },
          0.58,
        );

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
          ".construction-product",
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
        .fromTo(
          ".pressure-line",
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, ease: "none" },
          0.08,
        );

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".terrain",
            start: "top top",
            end: "bottom bottom",
            scrub: isMobile ? 0.7 : 0.95,
            invalidateOnRefresh: true,
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
            xPercent: isMobile ? -18 : -28,
            opacity: 0.18,
            ease: "power1.in",
          },
          0.15,
        )
        .fromTo(
          ".terrain-word--field",
          { xPercent: isMobile ? 24 : 34, opacity: 0 },
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

    window.setTimeout(() => ScrollTrigger.refresh(), 80);

    return () => {
      context.revert();
      gsap.ticker.remove(updateLenis);
      lenis.off("scroll", updateScrollTrigger);
      lenis.destroy();
    };
  }, [ready, scope]);
}
