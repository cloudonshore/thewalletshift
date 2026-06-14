// Categorical chart palette generated with "i want hue" (tools.medialab.sciences-po
// .fr/iwanthue) — a 14-colour, perceptually-distinct set (13 service categories + one
// spare for a future category). The brand orange is pinned first so the dominant
// band (DeFi Yield) stays on-brand.
export const BRAND = "#f0531f";

const PALETTE = [
  "#f0531f", "#5d7c3f", "#798fca", "#3c4d49", "#cdce55", "#7347c4", "#522f64",
  "#c99ead", "#6b382d", "#c8485c", "#72d25d", "#8ccdb8", "#c88d4e", "#ce55b6",
];

// One color per category, cycling if there are ever more categories than swatches.
export function categoryPalette(n: number): string[] {
  return Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);
}

// Semantic tier colors (TierBar + the service-vs-tail growth area), drawn from the
// same palette so the whole UI reads as one set.
export const TIER = {
  service: BRAND, // brand orange
  collectible: "#7347c4", // templated NFT collectibles
  neutral: "#3f4654", // placeholder/spam + the non-callable long tail
};
