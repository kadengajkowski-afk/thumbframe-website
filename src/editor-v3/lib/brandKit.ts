/** Day 31 — Brand Kit API client.
 *
 * Calls the snapframe-api endpoint POST /api/youtube/channel-by-url which
 * resolves a channel URL/handle/id and returns a partial Brand Kit
 * (channel metadata + recent thumbnails + extracted color palette).
 *
 * Color extraction runs server-side via sharp + LAB k-means; the client
 * only consumes the final hex strings. Day 33 swaps the in-memory cache
 * for a Supabase brand_kits table — the response shape stays stable so
 * the panel doesn't change. */

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://thumbframe-api-production.up.railway.app";

export type BrandKitThumbnail = {
  videoId: string;
  title: string;
  publishedAt: string | null;
  url: string;
};

export type BrandKitFont = {
  /** Canonical bundled-font name (one of BUNDLED_FONTS in state/types). */
  name: string;
  /** 0..1, server-side confidence floor of 0.6 already applied. */
  confidence: number;
};

export type BrandKit = {
  channelId: string;
  channelTitle: string;
  customUrl: string | null;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  country: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  recentThumbnails: BrandKitThumbnail[];
  /** Hex strings, "#RRGGBB". Server-extracted via LAB k-means k=8 with
   * ΔE merging. Empty array if extraction failed. */
  palette: string[];
  /** Hex string. Server-extracted as the dominant color of the channel
   * avatar (k-means k=1). Falls back to palette[0] when avatar is missing. */
  primaryAccent: string | null;
  /** Day 33 — fonts identified by Claude vision, filtered to the
   * 25-OFL bundled set, capped at 3. Empty array on detection failure
   * or when ANTHROPIC_API_KEY isn't configured. */
  fonts: BrandKitFont[];
  fromCache?: boolean;
};

export type BrandKitErrorCode =
  | "NOT_CONFIGURED"
  | "BAD_INPUT"
  | "NOT_FOUND"
  | "QUOTA_EXHAUSTED"
  | "UPSTREAM_ERROR"
  | "NETWORK_ERROR";

export type BrandKitError = {
  code: BrandKitErrorCode;
  message: string;
};

export type FetchBrandKitOptions = {
  /** Day 33 fix — when true, skip the L1 in-memory + L2 Supabase
   * caches on the backend and re-run YouTube fetch + color/font
   * extraction. Used by the "Re-extract" link in BrandKitPanel for
   * debugging stale cache rows. */
  bypassCache?: boolean;
};

export async function fetchBrandKit(
  input: string,
  options: FetchBrandKitOptions = {},
): Promise<BrandKit> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/youtube/channel-by-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, bypassCache: options.bypassCache === true }),
    });
  } catch (err) {
    throw {
      code: "NETWORK_ERROR" as const,
      message: err instanceof Error ? err.message : "Network error",
    } satisfies BrandKitError;
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response — fall through to status-only error
  }

  if (!res.ok) {
    const code = (typeof body === "object" && body && "code" in body
      ? String((body as { code?: unknown }).code)
      : "UPSTREAM_ERROR") as BrandKitErrorCode;
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: unknown }).error)
        : `Request failed (${res.status})`;
    throw { code, message } satisfies BrandKitError;
  }

  return body as BrandKit;
}
