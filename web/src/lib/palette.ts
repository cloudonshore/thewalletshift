import chroma from "chroma-js";

// The brand color (the logo's red-orange). Drives --accent and the chart palette.
export const BRAND = "#f0531f";

// Categorical chart palette generated from the single brand color with chroma-js,
// in perceptually-uniform LCH space. The hero (index 0) is the brand itself; the
// rest are an even hue sweep at fixed lightness/chroma starting at the brand's
// complement, so the set reads as one coordinated family (no neon spikes) and the
// two largest bands get maximum separation.
export function categoryPalette(n: number): string[] {
  const hue = chroma(BRAND).get("lch.h");
  const out = [BRAND];
  for (let i = 1; i < n; i++) {
    const h = (hue + 180 + (i - 1) * (360 / Math.max(1, n - 1))) % 360;
    out.push(chroma.lch(70, 45, h).hex());
  }
  return out;
}
