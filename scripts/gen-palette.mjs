#!/usr/bin/env node
// Build a cohesive categorical chart palette from ONE brand color.
// Approach (same idea as i-want-hue / Coolors "generate from base"): keep
// saturation + lightness CONSTANT and sweep hue evenly, so every swatch reads as
// part of one coordinated family instead of a random rainbow. The hero series
// (index 0, the dominant band) is pinned to the true brand color so the chart
// stays on-brand; the rest are softer/lighter so they don't fight it.
//
//   node scripts/gen-palette.mjs [hexBrand] [N]
const BRAND = process.argv[2] || "#f0531f";
const N = parseInt(process.argv[3] || "13", 10);
const SAT = 0.50; // muted -> cohesive, not neon
const LIG = 0.66; // bright enough to read on the near-black bg

const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  h /= 360;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return "#" + to(f(0)) + to(f(8)) + to(f(4));
}

const [H] = rgbToHsl(hexToRgb(BRAND));
// Start the sweep ~halfway round so the hero band's neighbour is a contrasting
// cool tone (max separation for the biggest two bands), then continue evenly.
const pal = [BRAND];
for (let i = 1; i < N; i++) {
  const hue = (H + 180 + (i - 1) * (360 / (N - 1))) % 360;
  pal.push(hslToHex(hue, SAT, LIG));
}
console.log(JSON.stringify(pal));
pal.forEach((c, i) => console.log(String(i).padStart(2), c, i === 0 ? "(brand hero)" : ""));
