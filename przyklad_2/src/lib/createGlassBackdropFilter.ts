export type GlassBackdropFilterOptions = {
  width: number;
  height: number;
  displacementUrl: string;
  strength: number;
  chromaticAberration?: number;
};

export function createGlassBackdropFilter({
  width,
  height,
  displacementUrl,
  strength,
  chromaticAberration = 0,
}: GlassBackdropFilterOptions) {
  const filterWidth = Math.max(1, Math.round(width));
  const filterHeight = Math.max(1, Math.round(height));
  const redStrength = strength + chromaticAberration * 2;
  const greenStrength = strength + chromaticAberration;
  const svg = `<svg height="${filterHeight}" width="${filterWidth}" viewBox="0 0 ${filterWidth} ${filterHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="displace" x="-20%" y="-40%" width="140%" height="180%" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" height="${filterHeight}" width="${filterWidth}" href="${displacementUrl}" preserveAspectRatio="none" result="displacementMap"/>
      <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${redStrength}" xChannelSelector="R" yChannelSelector="G" result="shiftedR"/>
      <feColorMatrix in="shiftedR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedR"/>
      <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${greenStrength}" xChannelSelector="R" yChannelSelector="G" result="shiftedG"/>
      <feColorMatrix in="shiftedG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedG"/>
      <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength}" xChannelSelector="R" yChannelSelector="G" result="shiftedB"/>
      <feColorMatrix in="shiftedB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="displacedB"/>
      <feBlend in="displacedR" in2="displacedG" mode="screen" result="displacedRG"/>
      <feBlend in="displacedRG" in2="displacedB" mode="screen"/>
    </filter>
  </defs>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}#displace`;
}
