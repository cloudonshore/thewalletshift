import type { Provider } from "@/lib/services";

// The lowercased free-text search haystack for a provider. Shared by the
// client-side directory UI (services-directory.tsx) and the server-side
// /api/services/search endpoint so both rank identically — agents searching via
// the API get the same matches a human gets in the browser. Keep the field set
// in sync with the search docs in app/SKILL.md/route.ts.
export function haystack(p: Provider): string {
  return [
    p.name,
    p.summary,
    p.descr,
    p.label,
    p.ens,
    ...p.tags,
    ...p.endpoints.map((e) => e.host),
    ...p.skills.flatMap((s) => [s.name, ...s.tags]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
