import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createGlassBackdropFilter } from "../lib/createGlassBackdropFilter";
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
  const displacementFilterUrl = useMemo(
    () =>
      activeMaps
        ? createGlassBackdropFilter({
            width: activeMaps.width,
            height: activeMaps.height,
            displacementUrl: activeMaps.displacementUrl,
            strength: refractionScale,
            chromaticAberration: resolvedOptions.dispersion,
          })
        : null,
    [activeMaps, refractionScale, resolvedOptions.dispersion],
  );
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
    activeMaps && displacementFilterUrl && pipelineSupported
      ? "refracted"
      : activeMaps
        ? "fallback"
        : "loading";
  const backdropFilter = displacementFilterUrl
    ? `blur(0px) url('${displacementFilterUrl}') blur(0px) brightness(1.1) saturate(1.5)`
    : undefined;

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
          {pipelineSupported && backdropFilter ? (
            <span
              className="liquid-glass-text__lens liquid-glass-text__lens--refracted"
              style={{
                ...maskStyle,
                WebkitBackdropFilter: backdropFilter,
                backdropFilter,
              }}
              aria-hidden="true"
            />
          ) : null}
          <span
            className="liquid-glass-text__edge"
            style={edgeMaskStyle}
            aria-hidden="true"
          />
        </>
      ) : null}
    </span>
  );
}
