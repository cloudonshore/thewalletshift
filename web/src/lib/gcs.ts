// Fetch an object from the private gs://thewalletshift-data bucket, authenticated
// with the App Hosting service account via the GCE metadata server. Returns the
// raw text, or null on any failure (e.g. local dev, where there's no metadata
// server). See docs/ARCHITECTURE.md.
const BUCKET = "thewalletshift-data";
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export async function fetchGcsText(
  object: string,
  revalidateSeconds: number,
): Promise<string | null> {
  try {
    const tokenRes = await fetch(METADATA_TOKEN_URL, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 3000 },
    });
    if (!tokenRes.ok) return null;
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const res = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(object)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: revalidateSeconds },
      },
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
