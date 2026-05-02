import { type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { openCustomerPortal } from "@/lib/billing";

/** Day 54 — past-due dunning banner.
 *
 * Surfaces when Stripe reports the user's subscription as past_due
 * or unpaid. Direct link to the Customer Portal (where Stripe has
 * already kicked off Smart Retries) so the user can update their
 * card without leaving the editor.
 *
 * Hidden when status is null, "active", "trialing", "canceled" (no
 * action needed) or anything else benign. Only renders for the two
 * dunning states. */

const DUNNING_STATES = new Set(["past_due", "unpaid"]);

export function PastDueBanner() {
  const status = useUiStore((s) => s.subscriptionStatus);
  if (!status || !DUNNING_STATES.has(status)) return null;
  return (
    <div role="alert" style={banner} data-testid="past-due-banner">
      <span style={icon} aria-hidden="true">⚠</span>
      <span style={message}>
        We couldn't charge your card. Update billing to keep Pro access.
      </span>
      <button
        type="button"
        style={cta}
        onClick={() => { void openCustomerPortal(); }}
        data-testid="past-due-portal"
      >
        Update billing
      </button>
    </div>
  );
}

const banner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 16px",
  background: "var(--accent-orange)",
  color: "var(--bg-space-0)",
  fontSize: 13,
  fontWeight: 500,
  borderBottom: "1px solid var(--bg-space-0)",
};

const icon: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
};

const message: CSSProperties = {
  flex: 1,
  letterSpacing: "0.01em",
};

const cta: CSSProperties = {
  background: "var(--bg-space-0)",
  color: "var(--accent-cream)",
  border: "none",
  borderRadius: 4,
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  cursor: "pointer",
};
