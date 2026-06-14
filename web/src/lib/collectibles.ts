// The collectibles gallery: the collectible TIER of the taxonomy, grouped into
// the NFT *collections* it actually is (FREAK, Normie, + an experimental tail)
// rather than 1,268 near-identical agent rows. Built statically by
// scripts/build-collectibles.mjs -> collectibles.json (committed, bundled).
// This is the "every token is also a live agent" surface — distinct from
// /services (real callable services) and excluded from it by design.
import collectiblesJson from "@/data/collectibles.json";

export interface Trait {
  name: string;
  count: number;
}
export interface SharedSkill {
  name: string;
  desc: string;
}
export interface Member {
  id: number;
  name: string | null;
  trait: string | null;
  reachable: boolean;
}
export interface SubCollection {
  name: string;
  indexed: number;
  reachable: number;
  host: string | null;
  summary: string | null;
}
export interface Collection {
  key: string;
  name: string;
  host: string | null;
  kind: string | null;
  indexed: number;
  declared_size: number | null;
  reachable: number;
  x402: number;
  blurb: string;
  mechanic: string;
  site: string | null;
  opensea: string | null;
  trait_label: string;
  trait_count: number;
  traits: Trait[];
  shared_skills: SharedSkill[];
  subcollections?: SubCollection[];
  members: Member[];
}
export interface CollectiblesDoc {
  generated_at: string;
  network: string;
  registry: string;
  total: number;
  reachable: number;
  collections: Collection[];
  collection_growth: {
    categories: { key: string; label: string }[];
    series: Record<string, number | string>[];
  };
}

export const collectibles = collectiblesJson as CollectiblesDoc;
export const fmt = (n: number) => n.toLocaleString("en-US");
