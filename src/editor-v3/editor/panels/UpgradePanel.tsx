import { useEffect, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { startCheckout, openCustomerPortal, BillingError } from "@/lib/billing";
import { toast } from "@/toasts/toastStore";
import * as s from "./UpgradePanel.styles";

/** Day 38 — Upgrade-to-Pro panel.
 *
 * Modal. Cmd+U opens, also reachable from every Pro-gated CTA in the
 * editor (4K export, BG remove cap, AI-gen cap, TopBar billing menu).
 * Free users see the feature list + $15/mo + Upgrade button. Pro users
 * see "You're Pro" + Manage subscription → Stripe Customer Portal.
 *
 * Both buttons hand off to lib/billing.ts which calls the Railway
 * endpoints and `window.location.assign(...)`s to Stripe. */

const FEATURES = [
  "Unwatermarked exports + 4K PNG",
  "100 HD background removes / month",
  "40 AI image generations / month",
  "30 Hero Composites / month",
  "Unlimited ThumbFriend AI chat",
  "All five personalities + Brutal Mode",
  "Brand Kit auto-extract from any channel",
  "Priority support",
];

export function UpgradePanel() {
  const open = useUiStore((u) => u.upgradePanelOpen);
  const close = useUiStore((u) => u.setUpgradePanelOpen);
  const userTier = useUiStore((u) => u.userTier);
  const user = useUiStore((u) => u.user);
  const isPro = userTier === "pro";
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  async function onUpgrade() {
    if (!user) {
      toast("Sign in to upgrade — opening account…");
      useUiStore.getState().setAuthPanelOpen(true);
      close(false);
      return;
    }
    setBusy(true);
    try {
      await startCheckout();
    } catch (err) {
      setBusy(false);
      const msg =
        err instanceof BillingError
          ? err.code === "AUTH_REQUIRED" ? "Sign in first"
          : err.code === "NOT_CONFIGURED" ? "Billing not configured yet"
          : err.message
          : "Couldn't start checkout";
      toast(msg);
    }
  }

  async function onManage() {
    setBusy(true);
    try {
      await openCustomerPortal();
    } catch (err) {
      setBusy(false);
      const msg =
        err instanceof BillingError
          ? err.code === "NO_CUSTOMER" ? "No active subscription found"
          : err.message
          : "Couldn't open billing portal";
      toast(msg);
    }
  }

  return (
    <div role="dialog" aria-label="Upgrade to Pro" style={s.backdrop} onClick={() => close(false)}>
      <div style={s.card} onClick={(e) => e.stopPropagation()} data-testid="upgrade-panel">
        {isPro ? <ProBody onManage={onManage} busy={busy} /> : <FreeBody onUpgrade={onUpgrade} busy={busy} />}
        <button type="button" style={s.closeBtn} onClick={() => close(false)} aria-label="Close">×</button>
      </div>
    </div>
  );
}

function FreeBody({ onUpgrade, busy }: { onUpgrade: () => void; busy: boolean }) {
  return (
    <>
      <header style={s.header}>
        <span style={s.kicker}>ThumbFrame Pro</span>
        <h2 style={s.title}>Ship faster, win the click.</h2>
        <div style={s.priceRow}>
          <span style={s.price}>$15</span>
          <span style={s.priceUnit}>/ month</span>
        </div>
      </header>
      <ul style={s.featureList}>
        {FEATURES.map((f) => (
          <li key={f} style={s.featureRow}>
            <span style={s.check}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        style={busy ? s.primaryBtnDisabled : s.primaryBtn}
        disabled={busy}
        onClick={onUpgrade}
        data-testid="upgrade-checkout"
      >
        {busy ? "Opening Stripe…" : "Upgrade now"}
      </button>
      <p style={s.fineprint}>Cancel anytime. Powered by Stripe.</p>
    </>
  );
}

function ProBody({ onManage, busy }: { onManage: () => void; busy: boolean }) {
  return (
    <>
      <header style={s.header}>
        <span style={s.kickerPro}>ThumbFrame Pro</span>
        <h2 style={s.title}>You're Pro.</h2>
        <p style={s.proLine}>
          All Pro features unlocked. Manage your subscription, payment
          method, or invoices in the Stripe portal.
        </p>
      </header>
      <button
        type="button"
        style={busy ? s.primaryBtnDisabled : s.primaryBtn}
        disabled={busy}
        onClick={onManage}
        data-testid="upgrade-manage"
      >
        {busy ? "Opening portal…" : "Manage subscription"}
      </button>
    </>
  );
}
