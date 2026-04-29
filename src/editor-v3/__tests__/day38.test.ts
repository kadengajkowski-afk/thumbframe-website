import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock supabase singleton — flip the maybeSingle() result per-test
// to exercise the profile→tier resolver.
let mockSession: { access_token: string } | null = { access_token: "FAKE" };
let mockProfile: {
  is_pro?: boolean | null;
  plan?: string | null;
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
} | null = null;

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: mockSession }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: mockProfile, error: null }),
        }),
      }),
    }),
  },
  isSupabaseConfigured: () => true,
}));

import {
  fetchUserProfile,
  tierFromProfile,
  resolveUserTier,
} from "@/lib/userTier";
import { startCheckout, openCustomerPortal, BillingError } from "@/lib/billing";
import { useUiStore } from "@/state/uiStore";

beforeEach(() => {
  mockSession = { access_token: "FAKE" };
  mockProfile = null;
  useUiStore.setState({
    upgradePanelOpen: false,
    userTier: "free",
    user: null,
  });
  // Clear dev override so resolveUserTier writes to uiStore.
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("thumbframe:dev-tier-override");
  }
});

afterEach(() => vi.restoreAllMocks());

// ── tierFromProfile (pure) ────────────────────────────────────────────────────

describe("Day 38 — tierFromProfile derives tier from profile shape", () => {
  it("null profile → free", () => {
    expect(tierFromProfile(null)).toBe("free");
  });

  it("is_pro: true → pro", () => {
    expect(tierFromProfile({ is_pro: true, plan: null, subscription_status: null, stripe_customer_id: null })).toBe("pro");
  });

  it("plan: 'pro' (without is_pro flag) → pro", () => {
    expect(tierFromProfile({ is_pro: null, plan: "pro", subscription_status: null, stripe_customer_id: null })).toBe("pro");
  });

  it("subscription_status: 'active' → pro", () => {
    expect(tierFromProfile({ is_pro: null, plan: null, subscription_status: "active", stripe_customer_id: null })).toBe("pro");
  });

  it("subscription_status: 'trialing' → pro", () => {
    expect(tierFromProfile({ is_pro: null, plan: null, subscription_status: "trialing", stripe_customer_id: null })).toBe("pro");
  });

  it("subscription_status: 'canceled' → free", () => {
    expect(tierFromProfile({ is_pro: false, plan: "free", subscription_status: "canceled", stripe_customer_id: "cus_x" })).toBe("free");
  });
});

// ── fetchUserProfile + resolveUserTier (Supabase) ─────────────────────────────

describe("Day 38 — fetchUserProfile + resolveUserTier", () => {
  it("fetchUserProfile returns the row from the Supabase mock", async () => {
    mockProfile = { is_pro: true, plan: "pro", subscription_status: "active", stripe_customer_id: "cus_1" };
    const profile = await fetchUserProfile("u@example.com");
    expect(profile?.is_pro).toBe(true);
  });

  it("resolveUserTier writes 'pro' into uiStore for an active sub", async () => {
    mockProfile = { is_pro: true, plan: "pro", subscription_status: "active", stripe_customer_id: "cus_1" };
    await resolveUserTier("u@example.com");
    expect(useUiStore.getState().userTier).toBe("pro");
  });

  it("resolveUserTier writes 'free' for a canceled sub", async () => {
    useUiStore.getState().setUserTier("pro");
    mockProfile = { is_pro: false, plan: "free", subscription_status: "canceled", stripe_customer_id: "cus_1" };
    await resolveUserTier("u@example.com");
    expect(useUiStore.getState().userTier).toBe("free");
  });

  it("resolveUserTier no-ops when dev override is engaged", async () => {
    window.localStorage.setItem("thumbframe:dev-tier-override", "1");
    useUiStore.getState().setUserTier("pro");
    mockProfile = { is_pro: false, plan: "free", subscription_status: null, stripe_customer_id: null };
    await resolveUserTier("u@example.com");
    expect(useUiStore.getState().userTier).toBe("pro"); // unchanged
  });

  it("resolveUserTier no-ops on null email", async () => {
    useUiStore.getState().setUserTier("pro");
    await resolveUserTier(null);
    expect(useUiStore.getState().userTier).toBe("pro");
  });
});

// ── billing client ────────────────────────────────────────────────────────────

describe("Day 38 — billing.ts startCheckout / openCustomerPortal", () => {
  it("startCheckout AUTH_REQUIRED when no session", async () => {
    mockSession = null;
    let caught: BillingError | null = null;
    try {
      await startCheckout();
    } catch (err) {
      caught = err as BillingError;
    }
    expect(caught?.code).toBe("AUTH_REQUIRED");
  });

  it("openCustomerPortal NO_CUSTOMER when 400 + 'No Stripe customer'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "No Stripe customer found. Complete a checkout first." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    let caught: BillingError | null = null;
    try {
      await openCustomerPortal();
    } catch (err) {
      caught = err as BillingError;
    }
    expect(caught?.code).toBe("NO_CUSTOMER");
  });

  it("startCheckout NOT_CONFIGURED when 500 + 'not configured'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Stripe not configured — STRIPE_SECRET_KEY missing" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
    let caught: BillingError | null = null;
    try {
      await startCheckout();
    } catch (err) {
      caught = err as BillingError;
    }
    expect(caught?.code).toBe("NOT_CONFIGURED");
  });
});

// ── uiStore wiring ────────────────────────────────────────────────────────────

describe("Day 38 — uiStore.upgradePanelOpen", () => {
  it("toggles via setUpgradePanelOpen", () => {
    useUiStore.getState().setUpgradePanelOpen(true);
    expect(useUiStore.getState().upgradePanelOpen).toBe(true);
    useUiStore.getState().setUpgradePanelOpen(false);
    expect(useUiStore.getState().upgradePanelOpen).toBe(false);
  });
});

// ── UpgradePanel render branches ──────────────────────────────────────────────

describe("Day 38 — UpgradePanel renders correct body per tier", () => {
  it("returns null when closed", async () => {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { UpgradePanel } = await import("@/editor/panels/UpgradePanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(UpgradePanel)));
    expect(container.querySelector('[data-testid="upgrade-panel"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it("free tier shows 'Upgrade now' button", async () => {
    useUiStore.setState({ upgradePanelOpen: true, userTier: "free" });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { UpgradePanel } = await import("@/editor/panels/UpgradePanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(UpgradePanel)));

    expect(container.querySelector('[data-testid="upgrade-checkout"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="upgrade-manage"]')).toBeNull();
    expect(container.textContent).toContain("$15");

    act(() => root.unmount());
    container.remove();
  });

  it("pro tier shows 'Manage subscription' button", async () => {
    useUiStore.setState({ upgradePanelOpen: true, userTier: "pro" });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { UpgradePanel } = await import("@/editor/panels/UpgradePanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(UpgradePanel)));

    expect(container.querySelector('[data-testid="upgrade-manage"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="upgrade-checkout"]')).toBeNull();
    expect(container.textContent).toContain("You're Pro");

    act(() => root.unmount());
    container.remove();
  });
});

// ── Cmd+U command ─────────────────────────────────────────────────────────────

describe("Day 38 — file.upgrade command toggles uiStore", () => {
  it("running file.upgrade opens the panel", async () => {
    const { runCommand } = await import("@/lib/commands");
    expect(useUiStore.getState().upgradePanelOpen).toBe(false);
    runCommand("file.upgrade");
    expect(useUiStore.getState().upgradePanelOpen).toBe(true);
  });
});
