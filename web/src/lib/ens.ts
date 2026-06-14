// Live, on-chain ENS resolution + verification for ERC-8004 agents.
//
// Agents self-declare an ENS name in their agent card, but nobody checks it.
// This resolves the claimed name on Ethereum mainnet at request time (no baked /
// hard-coded values) and grades it against the agent's current on-chain owner:
//   - forward resolution  (name -> address)  must match the agent's owner
//   - reverse resolution   (owner -> primary name) is a stronger, bonus signal
//   - ENSIP-26 text records (avatar/description/url/socials) enrich the profile
// Turns a soft, claimed string into a verified identity — the dashboard's honesty
// layer applied to ENS. Used by the /api/ens route and the services UI.
import { createPublicClient, http, isAddress, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

// Public mainnet RPC (CORS-friendly, no key); override with ENS_RPC_URL in prod.
const RPC_URL = process.env.ENS_RPC_URL || "https://ethereum-rpc.publicnode.com";
const client = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });

// "verified" = the claimed name resolves to the agent's owner address.
// "mismatch" = it resolves, but to someone else (a claim the agent doesn't control).
// "unconfigured" = the name has no address record set (claimed but not wired up).
// "invalid"/"error" = unnormalizable name / RPC failure.
export type EnsStatus = "verified" | "mismatch" | "unconfigured" | "invalid" | "error";

export interface EnsRecord {
  key: string;
  value: string;
}
export interface EnsResolution {
  name: string;
  status: EnsStatus;
  resolved_address: string | null; // forward: name -> address
  owner: string | null; // the agent's on-chain owner we verified against
  owner_match: boolean; // resolved_address === owner
  primary_name: string | null; // reverse: owner -> primary ENS name
  primary_match: boolean; // primary_name === name (owner set this name as primary)
  records: EnsRecord[]; // ENSIP-26 text records that are actually set
  resolved_at: string;
  rpc_chain: "ethereum-mainnet";
}

// ENSIP-26 / common agent-relevant text record keys worth surfacing.
const TEXT_KEYS = ["description", "url", "avatar", "com.twitter", "com.github", "email"];

function shell(name: string, owner: string | null, status: EnsStatus): EnsResolution {
  return {
    name,
    status,
    resolved_address: null,
    owner,
    owner_match: false,
    primary_name: null,
    primary_match: false,
    records: [],
    resolved_at: new Date().toISOString(),
    rpc_chain: "ethereum-mainnet",
  };
}

export async function resolveEns(name: string, owner: string | null): Promise<EnsResolution> {
  let norm: string;
  try {
    norm = normalize(name);
  } catch {
    return shell(name, owner, "invalid");
  }
  const ownerAddr = owner && isAddress(owner) ? getAddress(owner) : null;

  try {
    const [resolved, primary, ...recordVals] = await Promise.all([
      client.getEnsAddress({ name: norm }).catch(() => null),
      ownerAddr ? client.getEnsName({ address: ownerAddr }).catch(() => null) : Promise.resolve(null),
      ...TEXT_KEYS.map((k) => client.getEnsText({ name: norm, key: k }).catch(() => null)),
    ]);

    const records: EnsRecord[] = TEXT_KEYS.map((key, i) => ({ key, value: recordVals[i] as string | null }))
      .filter((r): r is EnsRecord => !!r.value)
      .map((r) => ({ key: r.key, value: r.value.slice(0, 400) }));

    const owner_match = !!(resolved && ownerAddr && resolved.toLowerCase() === ownerAddr.toLowerCase());
    const primary_match = !!(primary && primary.toLowerCase() === norm.toLowerCase());
    const status: EnsStatus = owner_match ? "verified" : resolved ? "mismatch" : "unconfigured";

    return {
      name: norm,
      status,
      resolved_address: resolved ?? null,
      owner: ownerAddr,
      owner_match,
      primary_name: primary ?? null,
      primary_match,
      records,
      resolved_at: new Date().toISOString(),
      rpc_chain: "ethereum-mainnet",
    };
  } catch {
    return shell(norm, ownerAddr, "error");
  }
}
