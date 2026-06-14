// Categorical chart palette generated with "i want hue" (tools.medialab.sciences-po
// .fr/iwanthue) — a 14-colour, perceptually-distinct set (13 service categories + one
// spare for a future category). The brand orange is pinned first so the dominant
// band (DeFi Yield) stays on-brand.
export const BRAND = "#f0531f";

const PALETTE = [
  "#f0531f", "#553b94", "#ca8e3f", "#c77ad2", "#79c15f", "#8c2e77", "#4fc79c",
  "#d95e90", "#4e7b2b", "#6285d9", "#b6b148", "#9e2a3f", "#e16b5d", "#9d471f",
];

// One color per category, cycling if there are ever more categories than swatches.
export function categoryPalette(n: number): string[] {
  return Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);
}

// Semantic tier colors (TierBar + the service-vs-tail growth area), drawn from the
// same palette so the whole UI reads as one set.
export const TIER = {
  service: BRAND, // brand orange
  collectible: "#553b94", // templated NFT collectibles
  neutral: "#3f4654", // placeholder/spam + the non-callable long tail
};
