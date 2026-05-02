/* @vitest-environment browser */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { useUiStore } from "@/state/uiStore";
import { PastDueBanner } from "@/editor/panels/PastDueBanner";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  host = null; root = null;
  useUiStore.setState({ subscriptionStatus: null });
});

describe("Day 54 — past-due banner", () => {
  it("hidden when subscription_status is null", () => {
    act(() => { root!.render(<PastDueBanner />); });
    expect(host!.querySelector('[data-testid="past-due-banner"]')).toBeNull();
  });

  it("hidden for healthy statuses (active, trialing, canceled)", () => {
    for (const status of ["active", "trialing", "canceled"]) {
      act(() => {
        useUiStore.getState().setSubscriptionStatus(status);
        root!.render(<PastDueBanner />);
      });
      expect(host!.querySelector('[data-testid="past-due-banner"]'),
        `should be hidden for ${status}`).toBeNull();
    }
  });

  it("renders when status is past_due", () => {
    act(() => {
      useUiStore.getState().setSubscriptionStatus("past_due");
      root!.render(<PastDueBanner />);
    });
    const banner = host!.querySelector('[data-testid="past-due-banner"]');
    expect(banner).not.toBeNull();
    expect(banner!.getAttribute("role")).toBe("alert");
    expect(host!.querySelector('[data-testid="past-due-portal"]')).not.toBeNull();
  });

  it("renders when status is unpaid", () => {
    act(() => {
      useUiStore.getState().setSubscriptionStatus("unpaid");
      root!.render(<PastDueBanner />);
    });
    expect(host!.querySelector('[data-testid="past-due-banner"]')).not.toBeNull();
  });
});

describe("Day 54 — uiStore subscription status", () => {
  it("setSubscriptionStatus round-trips", () => {
    useUiStore.getState().setSubscriptionStatus("past_due");
    expect(useUiStore.getState().subscriptionStatus).toBe("past_due");
    useUiStore.getState().setSubscriptionStatus(null);
    expect(useUiStore.getState().subscriptionStatus).toBeNull();
  });
});
