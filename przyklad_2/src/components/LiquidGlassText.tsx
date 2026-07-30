import {
  type CSSProperties,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createGlassTextMaps,
  type GlassTextMaps,
} from "../lib/createGlassTextMaps";

export type LiquidGlassOptions = {
  refractionStrength: number;
  lensStrength: number;
  dispersion: number;
  glassThickness: number;
  edgeHighlight: number;
  distortionAmount: number;
};

type LiquidGlassTextProps = {
  children: string | number;
  className?: string;
  options?: Partial<LiquidGlassOptions>;
  quality?: number;
  style?: CSSProperties;
};

const liquidGlassDefaults: LiquidGlassOptions = {
  refractionStrength: 30,
  lensStrength: 0.16,
  dispersion: 0.045,
  glassThickness: 0.72,
  edgeHighlight: 0.76,
  distortionAmount: 0.012,
};

function supportsRefractiveBackdrop() {
  if (typeof CSS === "undefined") return false;

  const backdropSupported =
    CSS.supports("backdrop-filter", "blur(1px)") ||
    CSS.supports("-webkit-backdrop-filter", "blur(1px)");
  const svgFilterSupported = CSS.supports("filter", "url(#glass-filter)");

  return backdropSupported && svgFilterSupported;
}

function toPixels(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function LiquidGlassText({
  children,
  className,
  options,
  quality,
  style,
}: LiquidGlassTextProps) {
  const text = String(children);
  const instanceId = useId().replaceAll(":", "");
  const filterId = `liquid-glass-refraction-${instanceId}`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const [maps, setMaps] = useState<GlassTextMaps | null>(null);
  const [mappedText, setMappedText] = useState("");
  const [refractionScale, setRefractionScale] = useState(
    liquidGlassDefaults.refractionStrength,
  );
  const pipelineSupported = useMemo(supportsRefractiveBackdrop, []);
  const resolvedOptions = {
    ...liquidGlassDefaults,
    ...options,
  };

  useEffect(() => {
    const root = rootRef.current;

    if (!root || !text) return;

    let disposed = false;
    let generation = 0;
    let timer = 0;
    let nearViewport = !("IntersectionObserver" in window);

    const renderMaps = async () => {
      const currentGeneration = ++generation;

      if ("fonts" in document) {
        await document.fonts.ready;
      }

      if (disposed || !nearViewport) return;

      const bounds = root.getBoundingClientRect();

      if (bounds.width < 2 || bounds.height < 2) return;

      const computed = window.getComputedStyle(root);
      const fontSize = toPixels(computed.fontSize, 16);
      const lineHeight = toPixels(computed.lineHeight, fontSize * 1.2);
      const letterSpacing =
        computed.letterSpacing === "normal"
          ? 0
          : toPixels(computed.letterSpacing, 0);
      const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
      const resolutionWidth =
        quality ??
        Math.round(Math.min(1280, Math.max(256, bounds.width * deviceScale)));
      const refractionPadding = Math.min(
        bounds.width * 0.05,
        Math.max(4, resolvedOptions.refractionStrength * 1.1),
      );
      const responsiveRefraction =
        resolvedOptions.refractionStrength *
        Math.min(1, Math.max(0.55, bounds.height / 180));

      setRefractionScale(Number(responsiveRefraction.toFixed(2)));

      try {
        const nextMaps = await createGlassTextMaps({
          text,
          width: bounds.width,
          height: bounds.height,
          resolutionWidth,
          fontFamily: computed.fontFamily,
          fontSize,
          fontStyle: computed.fontStyle,
          fontWeight: computed.fontWeight,
          letterSpacing,
          lineHeight,
          textAlign: computed.textAlign as CanvasTextAlign,
          textTransform: computed.textTransform,
          whiteSpace: computed.whiteSpace,
          refractionPadding,
          glassThickness: resolvedOptions.glassThickness,
          lensStrength: resolvedOptions.lensStrength,
          distortionAmount: resolvedOptions.distortionAmount,
        });

        if (!disposed && currentGeneration === generation) {
          setMaps(nextMaps);
          setMappedText(text);
        }
      } catch {
        if (!disposed && currentGeneration === generation) {
          setMaps(null);
          setMappedText("");
        }
      }
    };

    const scheduleRender = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void renderMaps();
      }, 90);
    };

    const resizeObserver =
      "ResizeObserver" in window
        ? new ResizeObserver(() => {
            if (nearViewport) scheduleRender();
          })
        : null;
    const intersectionObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              nearViewport = entry.isIntersecting;

              if (nearViewport) scheduleRender();
            },
            { rootMargin: "28% 0px" },
          )
        : null;

    resizeObserver?.observe(root);
    intersectionObserver?.observe(root);

    if (!intersectionObserver) scheduleRender();

    return () => {
      disposed = true;
      generation += 1;
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [
    className,
    quality,
    resolvedOptions.distortionAmount,
    resolvedOptions.glassThickness,
    resolvedOptions.lensStrength,
    resolvedOptions.refractionStrength,
    style?.fontFamily,
    style?.fontSize,
    style?.fontStyle,
    style?.fontWeight,
    style?.letterSpacing,
    style?.lineHeight,
    style?.textTransform,
    style?.whiteSpace,
    text,
  ]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) return;

    let active = true;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              active = entry.isIntersecting;
              root.dataset.glassActive = String(active);
            },
            { rootMargin: "18% 0px" },
          )
        : null;

    const paintLight = () => {
      frame = 0;

      if (!active) return;

      const bounds = root.getBoundingClientRect();
      const x = Math.min(
        1,
        Math.max(0, (pointerX - bounds.left) / bounds.width),
      );
      const y = Math.min(
        1,
        Math.max(0, (pointerY - bounds.top) / bounds.height),
      );

      root.style.setProperty("--glass-light-x", `${(x * 100).toFixed(2)}%`);
      root.style.setProperty("--glass-light-y", `${(y * 100).toFixed(2)}%`);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active) return;

      pointerX = event.clientX;
      pointerY = event.clientY;

      if (!frame) frame = window.requestAnimationFrame(paintLight);
    };

    observer?.observe(root);

    if (!reducedMotion && !coarsePointer) {
      window.addEventListener("pointermove", onPointerMove, {
        passive: true,
      });
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const activeMaps = mappedText === text ? maps : null;
  const maskStyle = activeMaps
    ? ({
        maskImage: `url("${activeMaps.maskUrl}")`,
        WebkitMaskImage: `url("${activeMaps.maskUrl}")`,
      } as CSSProperties)
    : undefined;
  const edgeMaskStyle = activeMaps
    ? ({
        maskImage: `url("${activeMaps.edgeUrl}")`,
        WebkitMaskImage: `url("${activeMaps.edgeUrl}")`,
      } as CSSProperties)
    : undefined;
  const cssVariables = {
    ...style,
    "--glass-highlight": resolvedOptions.edgeHighlight,
    "--glass-thickness": resolvedOptions.glassThickness,
  } as CSSProperties;
  const mode =
    activeMaps && pipelineSupported
      ? "refracted"
      : activeMaps
        ? "fallback"
        : "loading";
  const dispersion = resolvedOptions.dispersion;

  return (
    <span
      ref={rootRef}
      className={`liquid-glass-text${className ? ` ${className}` : ""}`}
      data-glass-active="true"
      data-glass-mode={mode}
      style={cssVariables}
    >
      <span className="liquid-glass-text__source">{text}</span>
      {activeMaps ? (
        <>
          <span
            className="liquid-glass-text__lens liquid-glass-text__lens--base"
            style={maskStyle}
            aria-hidden="true"
          />
          {pipelineSupported ? (
            <span
              className="liquid-glass-text__lens liquid-glass-text__lens--refracted"
              style={{
                ...maskStyle,
                filter: `url(#${filterId})`,
              }}
              aria-hidden="true"
            />
          ) : null}
          <span
            className="liquid-glass-text__surface"
            style={maskStyle}
            aria-hidden="true"
          />
          <span
            className="liquid-glass-text__caustic"
            style={maskStyle}
            aria-hidden="true"
          />
          <span
            className="liquid-glass-text__depth"
            style={edgeMaskStyle}
            aria-hidden="true"
          />
          <span
            className="liquid-glass-text__edge"
            style={edgeMaskStyle}
            aria-hidden="true"
          />
          <svg
            className="liquid-glass-text__filters"
            width="0"
            height="0"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <filter
                id={filterId}
                x="-10%"
                y="-40%"
                width="120%"
                height="180%"
                colorInterpolationFilters="sRGB"
              >
                <feImage
                  href={activeMaps.displacementUrl}
                  x="0%"
                  y="0%"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                  result="normal-map"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="normal-map"
                  scale={refractionScale * (1 + dispersion)}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="red-shift"
                />
                <feColorMatrix
                  in="red-shift"
                  values="1 0 0 0 0
                          0 0 0 0 0
                          0 0 0 0 0
                          0 0 0 1 0"
                  result="red-channel"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="normal-map"
                  scale={refractionScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="green-shift"
                />
                <feColorMatrix
                  in="green-shift"
                  values="0 0 0 0 0
                          0 1 0 0 0
                          0 0 0 0 0
                          0 0 0 1 0"
                  result="green-channel"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="normal-map"
                  scale={refractionScale * (1 - dispersion)}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="blue-shift"
                />
                <feColorMatrix
                  in="blue-shift"
                  values="0 0 0 0 0
                          0 0 0 0 0
                          0 0 1 0 0
                          0 0 0 1 0"
                  result="blue-channel"
                />
                <feBlend
                  in="red-channel"
                  in2="green-channel"
                  mode="screen"
                  result="red-green"
                />
                <feBlend
                  in="red-green"
                  in2="blue-channel"
                  mode="screen"
                  result="dispersed"
                />
                <feColorMatrix
                  in="dispersed"
                  type="saturate"
                  values="1.14"
                  result="refracted"
                />
                <feColorMatrix
                  in="normal-map"
                  values="0 0 1 0 0
                          0 0 1 0 0
                          0 0 1 0 0
                          0 0 1 0 0"
                  result="rim-light"
                />
                <feComponentTransfer
                  in="rim-light"
                  result="soft-rim-light"
                >
                  <feFuncR type="linear" slope="0.34" />
                  <feFuncG type="linear" slope="0.39" />
                  <feFuncB type="linear" slope="0.46" />
                  <feFuncA
                    type="linear"
                    slope={resolvedOptions.edgeHighlight * 0.72}
                  />
                </feComponentTransfer>
                <feBlend
                  in="refracted"
                  in2="soft-rim-light"
                  mode="screen"
                />
              </filter>
            </defs>
          </svg>
        </>
      ) : null}
    </span>
  );
}
