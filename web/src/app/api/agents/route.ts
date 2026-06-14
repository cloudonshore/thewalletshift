import { NextResponse } from "next/server";
import { fetchGcsText } from "@/lib/gcs";

// Serves the full agent dataset (~6 MB) to the /agents browser. Reads from GCS in
// production (authenticated, cached); in local dev reads the gitignored local copy
// written by scripts/export-agents.sh. The response is CDN-cacheable so the big
// payload is served from the edge, not re-fetched per visitor.
export const revalidate = 21600; // 6h

export async function GET() {
  let body: string | null = null;

  if (process.env.NODE_ENV !== "production") {
    try {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      body = await readFile(join(process.cwd(), "src/data/agents.json"), "utf8");
    } catch {
      body = null;
    }
  }
  if (!body) body = await fetchGcsText("agents.json", revalidate);
  if (!body) return NextResponse.json({ error: "agents dataset unavailable" }, { status: 503 });

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
