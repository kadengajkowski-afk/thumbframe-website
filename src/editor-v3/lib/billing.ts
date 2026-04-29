import { supabase } from "./supabase";

/** Day 38 — Stripe checkout + customer portal helpers.
 *
 * Both endpoints live on snapframe-api and use flexAuthMiddleware
 * (Supabase access token). Day 38 reuses v1's existing routes:
 *   POST /api/create-checkout-session  → Stripe Checkout Session URL
 *   POST /api/create-portal-session    → Stripe Customer Portal URL
 *
 * Both return `{ url }`. We redirect the browser there. Same pattern
 * v1's `utils/checkout.js` shipped — kept consistent so v1 + v3 share
 * the same pipeline.
 */

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://thumbframe-api-production.up.railway.app";

export type BillingErrorCode =
  | "AUTH_REQUIRED"
  | "NOT_CONFIGURED"
  | "NO_CUSTOMER"
  | "NETWORK_ERROR"
  | "UPSTREAM_ERROR";

export class BillingError extends Error {
  code: BillingErrorCode;
  status: number | undefined;
  constructor(code: BillingErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postBilling(path: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new BillingError("AUTH_REQUIRED", "Sign in to manage billing", 401);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    throw new BillingError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Network error",
    );
  }
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: unknown }).error)
        : `Request failed (${res.status})`;
    const code: BillingErrorCode =
      res.status === 401 ? "AUTH_REQUIRED"
      : res.status === 400 && /no.*customer/i.test(message) ? "NO_CUSTOMER"
      : res.status === 500 && /not configured/i.test(message) ? "NOT_CONFIGURED"
      : "UPSTREAM_ERROR";
    throw new BillingError(code, message, res.status);
  }
  const json = (await res.json()) as { url?: string };
  if (!json.url) throw new BillingError("UPSTREAM_ERROR", "No URL returned");
  return json.url;
}

/** Open Stripe Checkout in the current tab. Returns when the redirect
 * has been initiated (the function does not resolve before navigation
 * — caller code that runs after `await` will not execute). */
export async function startCheckout(): Promise<void> {
  const url = await postBilling("/api/create-checkout-session");
  if (typeof window !== "undefined") window.location.assign(url);
}

/** Open Stripe Customer Portal in the current tab. */
export async function openCustomerPortal(): Promise<void> {
  const url = await postBilling("/api/create-portal-session");
  if (typeof window !== "undefined") window.location.assign(url);
}
