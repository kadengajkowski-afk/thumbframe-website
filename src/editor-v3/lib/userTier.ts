import { supabase } from "./supabase";
import { useUiStore } from "@/state/uiStore";

/** Day 38 — derive userTier from Supabase profiles.
 *
 * Source of truth is the `profiles` row keyed by email (legacy: id is
 * bigint, not auth.uid). The webhook (server-side, service-role)
 * writes is_pro / plan / subscription_status when checkout completes
 * and on subscription updates. Frontend reads via a select-own-row
 * RLS policy added in the same day's migration.
 *
 * Dev override: a localStorage flag set by the command-palette
 * "Toggle Pro tier (dev)" entry takes precedence. The override is
 * surfaced through `loadDevTier()` already; this module only flips
 * the live tier when there's a real session AND no dev override set
 * explicitly to free. */

export type ProfileRow = {
  is_pro: boolean | null;
  plan: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
};

const DEV_OVERRIDE_KEY = "thumbframe:dev-tier-override";

/** Returns true if the dev override is engaged. The dev toggle on
 * uiStore writes a separate `thumbframe:dev-tier` key — this flag
 * lets a developer say "actually use the real Stripe tier, ignore
 * the dev value" without having to clear localStorage. */
function devOverrideEngaged(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DEV_OVERRIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export async function fetchUserProfile(email: string): Promise<ProfileRow | null> {
  if (!supabase || !email) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_pro, plan, subscription_status, stripe_customer_id")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.warn("[userTier] profile fetch failed:", error.message);
    return null;
  }
  return (data as ProfileRow | null) ?? null;
}

export function tierFromProfile(profile: ProfileRow | null): "free" | "pro" {
  if (!profile) return "free";
  if (profile.is_pro === true) return "pro";
  if (profile.plan === "pro") return "pro";
  if (profile.subscription_status === "active" || profile.subscription_status === "trialing") {
    return "pro";
  }
  return "free";
}

/** Resolve the live tier and write it into uiStore. Honors the dev
 * override (uiStore.userTier already comes from localStorage at boot;
 * if devOverrideEngaged() is true we do NOT clobber it). */
export async function resolveUserTier(email: string | null | undefined): Promise<void> {
  if (!email) return;
  if (devOverrideEngaged()) return;
  const profile = await fetchUserProfile(email);
  const tier = tierFromProfile(profile);
  useUiStore.getState().setUserTier(tier);
}

export const _internals = { devOverrideEngaged };
