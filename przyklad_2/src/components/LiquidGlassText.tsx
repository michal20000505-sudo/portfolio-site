import {
  type CSSProperties,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

// Both feDisplacementMap scales below are absolute pixels, tuned against the
// desktop FEEDBACK box (792x183). The filter region is expressed in percent, so
// on small viewports the box shrinks while the displacement does not, and the
// backdrop gets sampled from outside the region and comes back transparent.
// Scaling the displacement with the box keeps the refraction inside its region.
const referenceGlassHeight = 183;
const baseRefraction = 96;

const liquidGlassDefaults: LiquidGlassOptions = {
  refractionStrength: 100,
  lensStrength: 0.16,
  dispersion: 2,
  glassThickness: 0.72,
  edgeHighlight: 0.76,
  distortionAmount: 0.012,
};

function supportsRefractiveBackdrop() {
  if (typeof document === "undefined") return false;

  const probe = document.createElement("div");

  probe.style.cssText = "backdrop-filter: url(#test)";

  return (
    probe.style.backdropFilter === "url(#test)" ||
    probe.style.backdropFilter === 'url("#test")'
  );
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
  const filterId = `liquid-glass-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const [maps, setMaps] = useState<GlassTextMaps | null>(null);
  const [mappedText, setMappedText] = useState("");
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

    const fontShorthand = (style: CSSStyleDeclaration) =>
      [
        style.fontStyle,
        style.fontWeight,
        `${toPixels(style.fontSize, 16)}px`,
        style.fontFamily,
      ].join(" ");

    const renderMaps = async () => {
      const currentGeneration = ++generation;

      if ("fonts" in document) {
        // document.fonts.ready can resolve before a face that has not started
        // loading yet is applied. The canvas would then draw the mask in the
        // fallback family, which is far wider than the display face and makes
        // the word overrun its box. Force the exact face first.
        const shorthand = fontShorthand(window.getComputedStyle(root));

        try {
          await document.fonts.load(shorthand, text);
        } catch {
          // A family the shorthand parser rejects must not block the mask.
        }

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
      // Keyed into the map cache so a mask drawn while the display face was
      // still missing is never reused once the face lands.
      let fontsLoaded = true;

      if ("fonts" in document) {
        try {
          fontsLoaded = document.fonts.check(fontShorthand(computed), text);
        } catch {
          fontsLoaded = true;
        }
      }

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
          fontsLoaded,
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

    const onFontsLoaded = () => {
      if (nearViewport) scheduleRender();
    };

    resizeObserver?.observe(root);
    intersectionObserver?.observe(root);
    document.fonts?.addEventListener("loadingdone", onFontsLoaded);

    if (!intersectionObserver) scheduleRender();

    return () => {
      disposed = true;
      generation += 1;
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.fonts?.removeEventListener("loadingdone", onFontsLoaded);
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

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              root.dataset.glassActive = String(entry.isIntersecting);
            },
            { rootMargin: "18% 0px" },
          )
        : null;

    observer?.observe(root);

    return () => {
      observer?.disconnect();
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
  } as CSSProperties;
  const mode =
    activeMaps && pipelineSupported
      ? "refracted"
      : activeMaps
        ? "fallback"
        : "loading";
  const backdropFilter = activeMaps
    ? `url(#${filterId}) saturate(1.72) brightness(1.08)`
    : undefined;
  const refractionScale = activeMaps
    ? Math.min(1, activeMaps.height / referenceGlassHeight)
    : 1;
  const waveRefractionScale = Math.round(baseRefraction * refractionScale);
  const edgeRefractionScale = Math.round(
    resolvedOptions.refractionStrength * 1.15 * refractionScale,
  );
  const rootStyle = {
    ...cssVariables,
    ...(activeMaps && pipelineSupported && backdropFilter
      ? {
          ...maskStyle,
          WebkitBackdropFilter: backdropFilter,
          backdropFilter,
        }
      : {}),
  } as CSSProperties;

  return (
    <>
      {activeMaps && typeof document !== "undefined"
        ? createPortal(
            <svg
              className="liquid-glass-global-filter"
              width="0"
              height="0"
              aria-hidden="true"
            >
              <defs>
                <filter
                  id={filterId}
                  x="-40%"
                  y="-100%"
                  width="180%"
                  height="300%"
                  colorInterpolationFilters="sRGB"
                >
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.007 0.026"
                    numOctaves={2}
                    seed={17}
                    result="noise"
                  />
                  <feGaussianBlur
                    in="noise"
                    stdDeviation={1.2}
                    result="soft-noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="soft-noise"
                    scale={waveRefractionScale}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="liquid-base"
                  />
                  <feImage
                    x="0"
                    y="0"
                    width={activeMaps.width}
                    height={activeMaps.height}
                    href={activeMaps.displacementUrl}
                    preserveAspectRatio="none"
                    result="edge-map"
                  />
                  <feGaussianBlur
                    in="edge-map"
                    stdDeviation={0.45}
                    result="soft-edge-map"
                  />
                  <feDisplacementMap
                    in="liquid-base"
                    in2="soft-edge-map"
                    scale={edgeRefractionScale}
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>
              </defs>
            </svg>,
            document.body,
          )
        : null}
      <span
        ref={rootRef}
        className={`liquid-glass-text${className ? ` ${className}` : ""}`}
        data-glass-active="true"
        data-glass-mode={mode}
        style={rootStyle}
        aria-hidden="true"
      >
        <span className="liquid-glass-text__source">{text}</span>
        {activeMaps ? (
          <>
            <span
              className="liquid-glass-text__lens liquid-glass-text__lens--base"
              style={maskStyle}
              aria-hidden="true"
            />
            <span
              className="liquid-glass-text__edge"
              style={edgeMaskStyle}
              aria-hidden="true"
            />
          </>
        ) : null}
      </span>
    </>
  );
}
