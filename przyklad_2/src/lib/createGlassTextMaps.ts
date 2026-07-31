export type GlassTextMapOptions = {
  text: string;
  width: number;
  height: number;
  resolutionWidth: number;
  fontFamily: string;
  fontSize: number;
  fontStyle: string;
  fontWeight: string;
  fontsLoaded: boolean;
  letterSpacing: number;
  lineHeight: number;
  textAlign: CanvasTextAlign;
  textTransform: string;
  whiteSpace: string;
  refractionPadding: number;
  glassThickness: number;
  lensStrength: number;
  distortionAmount: number;
  lightAngle?: number;
};

export type GlassTextMaps = {
  displacementUrl: string;
  edgeUrl: string;
  height: number;
  maskUrl: string;
  width: number;
};

const SQRT_TWO = Math.SQRT2;
const MAX_CACHE_ENTRIES = 18;
const mapCache = new Map<string, Promise<GlassTextMaps>>();

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function transformText(text: string, textTransform: string) {
  if (textTransform === "uppercase") return text.toLocaleUpperCase();
  if (textTransform === "lowercase") return text.toLocaleLowerCase();

  if (textTransform === "capitalize") {
    return text.replace(
      /(^|\s)(\p{L})/gu,
      (_, space: string, letter: string) =>
        `${space}${letter.toLocaleUpperCase()}`,
    );
  }

  return text;
}

function measureLine(
  context: CanvasRenderingContext2D,
  line: string,
  letterSpacing: number,
) {
  return (
    context.measureText(line).width +
    Math.max(0, Array.from(line).length - 1) * letterSpacing
  );
}

function wrapParagraph(
  context: CanvasRenderingContext2D,
  paragraph: string,
  maxWidth: number,
  letterSpacing: number,
) {
  if (!paragraph) return [""];

  const words = paragraph.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (
      currentLine &&
      measureLine(context, candidate, letterSpacing) > maxWidth
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function renderTextMask(options: GlassTextMapOptions) {
  const mapWidth = Math.round(clamp(options.resolutionWidth, 256, 1280));
  const mapHeight = Math.max(
    48,
    Math.round((mapWidth * options.height) / options.width),
  );
  const scale = mapWidth / options.width;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D is required to build the liquid glass mask.");
  }

  canvas.width = mapWidth;
  canvas.height = mapHeight;
  context.scale(scale, scale);
  context.fillStyle = "#fff";
  context.textBaseline = "alphabetic";
  context.textAlign = options.textAlign;
  context.font = [
    options.fontStyle,
    options.fontWeight,
    `${options.fontSize}px`,
    options.fontFamily,
  ].join(" ");

  if ("fontKerning" in context) context.fontKerning = "normal";

  const letterSpacingContext = context as CanvasRenderingContext2D & {
    letterSpacing?: string;
  };

  if ("letterSpacing" in letterSpacingContext) {
    letterSpacingContext.letterSpacing = `${options.letterSpacing}px`;
  }

  const text = transformText(options.text, options.textTransform);
  const availableWidth = Math.max(
    1,
    options.width - options.refractionPadding * 2,
  );
  const shouldWrap =
    !options.whiteSpace.includes("nowrap") &&
    !options.whiteSpace.includes("pre");
  const lines = text.split(/\r?\n/).flatMap((paragraph) =>
    shouldWrap
      ? wrapParagraph(
          context,
          paragraph,
          availableWidth,
          options.letterSpacing,
        )
      : [paragraph],
  );
  const metrics = context.measureText("Hg");
  const ascent =
    metrics.actualBoundingBoxAscent || options.fontSize * 0.78;
  const descent =
    metrics.actualBoundingBoxDescent || options.fontSize * 0.22;
  const glyphHeight = ascent + descent;
  const blockHeight = Math.max(
    glyphHeight,
    (lines.length - 1) * options.lineHeight + glyphHeight,
  );
  const verticalScale = Math.min(
    1,
    Math.max(
      0.12,
      (options.height - options.refractionPadding * 0.5) / blockHeight,
    ),
  );
  const scaledLineHeight = options.lineHeight * verticalScale;
  const scaledAscent = ascent * verticalScale;
  const scaledGlyphHeight = glyphHeight * verticalScale;
  const scaledBlockHeight =
    (lines.length - 1) * scaledLineHeight + scaledGlyphHeight;
  const firstBaseline =
    (options.height - scaledBlockHeight) / 2 + scaledAscent;
  const anchorX =
    options.textAlign === "left" || options.textAlign === "start"
      ? options.refractionPadding
      : options.textAlign === "right" || options.textAlign === "end"
        ? options.width - options.refractionPadding
        : options.width / 2;

  context.save();
  context.translate(anchorX, firstBaseline);
  context.scale(1, verticalScale);

  lines.forEach((line, index) => {
    context.fillText(
      line,
      0,
      (index * scaledLineHeight) / verticalScale,
      availableWidth,
    );
  });

  context.restore();

  return {
    canvas,
    context,
    mapHeight,
    mapWidth,
    mask: context.getImageData(0, 0, mapWidth, mapHeight),
  };
}

function buildOpticalMaps(
  mask: ImageData,
  mapWidth: number,
  mapHeight: number,
  options: GlassTextMapOptions,
) {
  const pixelCount = mapWidth * mapHeight;
  const inside = new Uint8Array(pixelCount);
  const distance = new Float32Array(pixelCount);

  distance.fill(Number.POSITIVE_INFINITY);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const alpha = mask.data[pixel * 4 + 3];
    inside[pixel] = alpha > 16 ? 1 : 0;
  }

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const pixel = y * mapWidth + x;

      if (!inside[pixel]) continue;

      const touchesOutside =
        x === 0 ||
        y === 0 ||
        x === mapWidth - 1 ||
        y === mapHeight - 1 ||
        !inside[pixel - 1] ||
        !inside[pixel + 1] ||
        !inside[pixel - mapWidth] ||
        !inside[pixel + mapWidth];

      if (touchesOutside) distance[pixel] = 0;
    }
  }

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const pixel = y * mapWidth + x;

      if (!inside[pixel]) continue;

      let nearest = distance[pixel];

      if (x > 0) nearest = Math.min(nearest, distance[pixel - 1] + 1);
      if (y > 0) {
        nearest = Math.min(nearest, distance[pixel - mapWidth] + 1);
      }
      if (x > 0 && y > 0) {
        nearest = Math.min(
          nearest,
          distance[pixel - mapWidth - 1] + SQRT_TWO,
        );
      }
      if (x < mapWidth - 1 && y > 0) {
        nearest = Math.min(
          nearest,
          distance[pixel - mapWidth + 1] + SQRT_TWO,
        );
      }

      distance[pixel] = nearest;
    }
  }

  for (let y = mapHeight - 1; y >= 0; y -= 1) {
    for (let x = mapWidth - 1; x >= 0; x -= 1) {
      const pixel = y * mapWidth + x;

      if (!inside[pixel]) continue;

      let nearest = distance[pixel];

      if (x < mapWidth - 1) {
        nearest = Math.min(nearest, distance[pixel + 1] + 1);
      }
      if (y < mapHeight - 1) {
        nearest = Math.min(
          nearest,
          distance[pixel + mapWidth] + 1,
        );
      }
      if (x < mapWidth - 1 && y < mapHeight - 1) {
        nearest = Math.min(
          nearest,
          distance[pixel + mapWidth + 1] + SQRT_TWO,
        );
      }
      if (x > 0 && y < mapHeight - 1) {
        nearest = Math.min(
          nearest,
          distance[pixel + mapWidth - 1] + SQRT_TWO,
        );
      }

      distance[pixel] = nearest;
    }
  }

  const displacementCanvas = document.createElement("canvas");
  const displacementContext = displacementCanvas.getContext("2d");
  const edgeCanvas = document.createElement("canvas");
  const edgeContext = edgeCanvas.getContext("2d");

  if (!displacementContext || !edgeContext) {
    throw new Error("Canvas 2D is required to build the liquid glass maps.");
  }

  displacementCanvas.width = mapWidth;
  displacementCanvas.height = mapHeight;
  edgeCanvas.width = mapWidth;
  edgeCanvas.height = mapHeight;

  const displacement = displacementContext.createImageData(
    mapWidth,
    mapHeight,
  );
  const edgeMap = edgeContext.createImageData(mapWidth, mapHeight);
  const lightRadians = ((options.lightAngle ?? 38) * Math.PI) / 180;
  const lightX = Math.cos(lightRadians);
  const lightY = Math.sin(lightRadians);
  const rimWidth = clamp(
    mapHeight * (0.075 + options.glassThickness * 0.07),
    7,
    26,
  );
  let containsText = false;

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const pixel = y * mapWidth + x;
      const channel = pixel * 4;

      displacement.data[channel] = 128;
      displacement.data[channel + 1] = 128;
      displacement.data[channel + 2] = 0;
      displacement.data[channel + 3] = 255;

      edgeMap.data[channel] = 255;
      edgeMap.data[channel + 1] = 255;
      edgeMap.data[channel + 2] = 255;
      edgeMap.data[channel + 3] = 0;

      if (!inside[pixel]) continue;

      containsText = true;

      const left =
        x > 0 && inside[pixel - 1] ? distance[pixel - 1] : 0;
      const right =
        x < mapWidth - 1 && inside[pixel + 1]
          ? distance[pixel + 1]
          : 0;
      const top =
        y > 0 && inside[pixel - mapWidth]
          ? distance[pixel - mapWidth]
          : 0;
      const bottom =
        y < mapHeight - 1 && inside[pixel + mapWidth]
          ? distance[pixel + mapWidth]
          : 0;
      const gradientX = (right - left) * 0.5;
      const gradientY = (bottom - top) * 0.5;
      const gradientLength = Math.hypot(gradientX, gradientY);
      const normalX =
        gradientLength > 0.0001 ? gradientX / gradientLength : 0;
      const normalY =
        gradientLength > 0.0001 ? gradientY / gradientLength : 0;
      const depth = clamp(distance[pixel] / rimWidth, 0, 1);
      const edge = 1 - depth;
      const denominator = Math.pow(
        Math.max(0.0001, 1 - Math.pow(edge, 4)),
        0.75,
      );
      const slope = Math.pow(edge, 3) / denominator;
      const incidentAngle = Math.atan(slope);
      const transmittedAngle = Math.asin(
        Math.sin(incidentAngle) / 1.5,
      );
      const edgeRefraction = clamp(
        Math.sin(incidentAngle - transmittedAngle) / 0.745,
        0,
        1,
      );
      const coverage = mask.data[channel + 3] / 255;
      const lensRefraction =
        Math.sin(Math.min(1, depth) * Math.PI * 0.5) *
        options.lensStrength *
        0.28;
      const wave =
        Math.sin(x * 0.071 + y * 0.043) *
        Math.cos(x * 0.019 - y * 0.057) *
        options.distortionAmount;
      const displacementStrength =
        (edgeRefraction + lensRefraction + wave) * coverage * 118;
      const lightFacing = normalX * lightX + normalY * lightY;
      const primaryHighlight = Math.pow(Math.max(0, lightFacing), 4);
      const returnHighlight =
        0.18 * Math.pow(Math.max(0, -lightFacing), 3);
      const rimLight =
        Math.pow(edge, 1.55) *
        clamp(0.07 + primaryHighlight + returnHighlight, 0, 1);
      const edgeAlpha =
        Math.pow(edge, 1.3) * coverage * (0.46 + rimLight * 0.54);

      displacement.data[channel] = Math.round(
        clamp(128 + normalX * displacementStrength, 0, 255),
      );
      displacement.data[channel + 1] = Math.round(
        clamp(128 + normalY * displacementStrength, 0, 255),
      );
      displacement.data[channel + 2] = Math.round(rimLight * 255);
      edgeMap.data[channel + 3] = Math.round(edgeAlpha * 255);
    }
  }

  if (!containsText) {
    throw new Error("The liquid glass mask did not contain visible text.");
  }

  displacementContext.putImageData(displacement, 0, 0);
  edgeContext.putImageData(edgeMap, 0, 0);

  return {
    displacementUrl: displacementCanvas.toDataURL("image/png"),
    edgeUrl: edgeCanvas.toDataURL("image/png"),
  };
}

async function renderGlassTextMaps(options: GlassTextMapOptions) {
  const renderedMask = renderTextMask(options);
  const opticalMaps = buildOpticalMaps(
    renderedMask.mask,
    renderedMask.mapWidth,
    renderedMask.mapHeight,
    options,
  );

  return {
    ...opticalMaps,
    height: options.height,
    maskUrl: renderedMask.canvas.toDataURL("image/png"),
    width: options.width,
  };
}

export function createGlassTextMaps(options: GlassTextMapOptions) {
  const cacheKey = [
    options.text,
    Math.round(options.width),
    Math.round(options.height),
    Math.round(options.resolutionWidth),
    options.fontFamily,
    options.fontSize.toFixed(2),
    options.fontStyle,
    options.fontWeight,
    String(options.fontsLoaded),
    options.letterSpacing.toFixed(3),
    options.lineHeight.toFixed(2),
    options.textAlign,
    options.textTransform,
    options.whiteSpace,
    options.refractionPadding.toFixed(2),
    options.glassThickness.toFixed(3),
    options.lensStrength.toFixed(3),
    options.distortionAmount.toFixed(4),
    options.lightAngle ?? 38,
  ].join("|");
  const cached = mapCache.get(cacheKey);

  if (cached) return cached;

  const maps = renderGlassTextMaps(options);
  mapCache.set(cacheKey, maps);

  if (mapCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = mapCache.keys().next().value;

    if (oldestKey) mapCache.delete(oldestKey);
  }

  return maps;
}
