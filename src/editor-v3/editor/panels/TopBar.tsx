import { type CSSProperties, useEffect, useState } from "react";
import { useUiStore, type SaveStatus } from "@/state/uiStore";
import { supabase } from "@/lib/supabase";
import { fetchTodayAiUsage, type AiUsage } from "@/lib/aiUsage";
import { FileMenu } from "./FileMenu";
import { Tooltip } from "./Tooltip";

/** Day 18 + 20 — TopBar. Logo / project name / Ship It on the right.
 * Day 20 adds a save-status indicator + sign-in button (or avatar
 * dropdown when signed in). */

export function TopBar() {
  const openExport = useUiStore((s) => s.setExportPanelOpen);
  const openAuth = useUiStore((s) => s.setAuthPanelOpen);
  const projectName = useUiStore((s) => s.projectName);
  const setProjectName = useUiStore((s) => s.setProjectName);
  const user = useUiStore((s) => s.user);
  const saveStatus = useUiStore((s) => s.saveStatus);
  const [editingName, setEditingName] = useState(false);
  const signedIn = !!user;

  return (
    <header style={bar} data-alive="topbar">
      <div style={leftGroup}>
        <Logo />
      </div>
      <div style={centerGroup}>
        {editingName ? (
          <input
            autoFocus
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
            }}
            style={projectNameInput}
            data-testid="project-name-input"
          />
        ) : (
          <FileMenu onStartRename={() => setEditingName(true)} />
        )}
        <SaveStatusBadge status={saveStatus} signedIn={signedIn} />
      </div>
      <div style={rightGroup}>
        <AiStatusBadge />
        <PinnedKitBadge />
        <Tooltip label="Help & support" position="below">
          <button
            type="button"
            style={helpBtn}
            onClick={() => useUiStore.getState().setHelpPanelOpen(true)}
            aria-label="Open help and support"
            data-testid="topbar-help"
          >
            ?
          </button>
        </Tooltip>
        {user ? (
          <UserBadge email={user.email} avatarUrl={user.avatarUrl} />
        ) : (
          <Tooltip label="Sign in to sync your work" position="below">
            <button
              type="button"
              style={signInBtn}
              onClick={() => openAuth(true)}
              aria-label="Sign in to sync"
              data-testid="topbar-signin"
            >
              Sign in to sync
            </button>
          </Tooltip>
        )}
        <Tooltip label="Ship it" shortcut="⌘E" position="below">
          <button
            type="button"
            style={shipItBtn}
            onClick={() => openExport(true)}
            aria-label="Ship it (Cmd+E)"
            data-testid="topbar-ship"
          >
            Ship it
          </button>
        </Tooltip>
      </div>
    </header>
  );
}

function SaveStatusBadge({ status, signedIn }: { status: SaveStatus; signedIn: boolean }) {
  if (status.kind === "idle") return null;
  if (status.kind === "saving") {
    return <span style={saveBadge} data-testid="save-status">Saving…</span>;
  }
  if (status.kind === "error") {
    return (
      <span style={{ ...saveBadge, color: "var(--accent-orange)" }} data-testid="save-status">
        Couldn't save — try again
      </span>
    );
  }
  // Signed-in users save to Supabase (synced); signed-out save to
  // localStorage (this browser only). Different copy so users know
  // whether their work is reachable from another device.
  return (
    <span style={saveBadge} data-testid="save-status">
      {relativeTime(status.at, signedIn)}
    </span>
  );
}

function relativeTime(at: number, signedIn: boolean): string {
  const suffix = signedIn ? "" : " locally";
  const sec = Math.floor((Date.now() - at) / 1000);
  if (sec < 5) return `Saved${suffix}`;
  if (sec < 60) return `Saved ${sec}s ago${suffix}`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Saved ${min}m ago${suffix}`;
  return `Saved${suffix}`;
}

function UserBadge(props: { email: string | null; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const initials = (props.email ?? "?").charAt(0).toUpperCase();
  return (
    <div style={userBadgeWrap}>
      <Tooltip label={props.email ?? "Account"} position="below">
        <button
          type="button"
          style={userBadgeBtn}
          onClick={() => setOpen((o) => !o)}
          aria-label={`Account menu (${props.email ?? "signed in"})`}
          aria-haspopup="menu"
          aria-expanded={open}
          data-testid="topbar-user"
        >
          {props.avatarUrl ? (
            <img src={props.avatarUrl} alt="" style={avatarImg} />
          ) : (
            <span style={avatarFallback}>{initials}</span>
          )}
        </button>
      </Tooltip>
      {open && (
        <div style={userMenu} onMouseLeave={() => setOpen(false)}>
          <div style={userMenuEmail}>{props.email}</div>
          <button
            type="button"
            style={userMenuItem}
            onClick={() => {
              setOpen(false);
              useUiStore.getState().setUpgradePanelOpen(true);
            }}
            data-testid="topbar-billing"
          >
            Billing
          </button>
          <button
            type="button"
            style={userMenuItem}
            onClick={async () => {
              setOpen(false);
              await supabase?.auth.signOut();
            }}
            data-testid="topbar-signout"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Day 35 — AI status badge. While a chat stream is open, shows a
 * subtle "thinking…" indicator. Otherwise (signed in only) shows the
 * remaining-quota dot which surfaces "X used today (Y left)" + token
 * total on hover. Hidden entirely when not signed in. */
function AiStatusBadge() {
  const streaming = useUiStore((s) => s.aiStreaming);
  const user = useUiStore((s) => s.user);
  const userId = user?.id ?? null;
  const [usage, setUsage] = useState<AiUsage | null>(null);

  useEffect(() => {
    if (!userId) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    fetchTodayAiUsage(userId).then((u) => {
      if (!cancelled) setUsage(u);
    });
    return () => { cancelled = true; };
    // streaming -> false transition refetches the count
  }, [userId, streaming]);

  if (streaming) {
    return (
      <span style={aiThinking} data-testid="topbar-ai-thinking">
        <span style={aiThinkingDot} /> thinking…
      </span>
    );
  }
  if (!userId || !usage) return null;
  const tokensLabel = usage.tokensTotal > 0
    ? ` · ${usage.tokensTotal.toLocaleString()} tokens`
    : "";
  const title = `${usage.used} of ${usage.limit} AI calls used today (${usage.remaining} left)${tokensLabel}`;
  return (
    <span
      style={aiUsage}
      title={title}
      data-testid="topbar-ai-usage"
      aria-label={title}
    >
      {usage.remaining}/{usage.limit}
    </span>
  );
}

/** Day 32 — small badge in TopBar showing the pinned Brand Kit's avatar
 * + channel name. Click opens the panel. Hidden when nothing pinned. */
function PinnedKitBadge() {
  const pinned = useUiStore((s) => s.pinnedBrandKit);
  const openKit = useUiStore((s) => s.setBrandKitPanelOpen);
  if (!pinned) return null;
  return (
    <Tooltip label={`Brand Kit: ${pinned.channelTitle}`} shortcut="⌘B" position="below">
      <button
        type="button"
        style={pinnedBadge}
        onClick={() => openKit(true)}
        aria-label={`Open Brand Kit for ${pinned.channelTitle}`}
        data-testid="topbar-pinned-kit"
      >
        {pinned.avatarUrl ? (
          <img src={pinned.avatarUrl} alt="" style={pinnedAvatar} />
        ) : (
          <span style={pinnedAvatarFallback}>{pinned.channelTitle.charAt(0).toUpperCase()}</span>
        )}
        <span style={pinnedLabel}>{pinned.channelTitle}</span>
      </button>
    </Tooltip>
  );
}

function Logo() {
  return (
    <div style={logoGroup} aria-label="thumbframe">
      {/* Day 64c — actual painterly ship logo PNG. */}
      <img
        src="/brand/ship-logo-final.png"
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
        style={{ objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}
      />
      <span style={wordmark}>thumbframe</span>
    </div>
  );
}

const bar: CSSProperties = {
  // Day 64d — width:100% was missing. Without it, the bar shrinks
  // to its content (~540px) inside the WoodWall flex container,
  // pinning the right group near the middle of the topbar instead
  // of at the right edge.
  width: "100%",
  display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
  height: 48,
  // Day 64b — wood now owned by parent WoodWall. TopBar is just a
  // transparent layout row sitting on the wood. The wall paints
  // the texture; this just decorates it.
  background: "transparent",
  borderBottom: "1px solid rgba(160, 101, 30, 0.55)",
  boxShadow:
    "inset 0 1px 0 0 var(--brass-bright), " +
    "inset 0 2px 0 0 rgba(245, 230, 200, 0.12)",
  color: "var(--brass-cream)",
  position: "relative",
  zIndex: 1,
};
const leftGroup: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minWidth: 200 };
const centerGroup: CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
};
const rightGroup: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, minWidth: 200, justifyContent: "flex-end",
};
const logoGroup: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8 };
const wordmark: CSSProperties = {
  // Day 58 — Fraunces serif for the wordmark, matching landing brand.
  fontFamily: "var(--font-serif)",
  fontSize: 16,
  letterSpacing: "0.01em",
  fontWeight: 500,
  fontStyle: "italic",
  color: "var(--cream-100)",
  textTransform: "lowercase",
};
const projectNameInput: CSSProperties = {
  fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)",
  borderRadius: 4, padding: "2px 6px", fontFamily: "inherit",
  width: 180,
};
const saveBadge: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic",
};
const signInBtn: CSSProperties = {
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  padding: "5px 12px", fontSize: 12, cursor: "pointer",
};
const shipItBtn: CSSProperties = {
  // Day 61 — Captain's Quarters Ship It pill. Brass-cream interior
  // with brass-mid border. Replaces the Day 58 orange CTA. Hover
  // brightens the border to brass-bright (handled inline via :hover
  // CSS in the rendered component, otherwise falls back to opacity).
  background: "var(--brass-cream)",
  color: "var(--brass-shadow)",
  border: "1.5px solid var(--brass-mid)",
  borderRadius: 999,
  padding: "8px 18px",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.02em",
  cursor: "pointer",
  boxShadow:
    "inset 0 1px 0 0 rgba(255, 255, 255, 0.45), " +
    "0 2px 8px -2px rgba(58, 40, 24, 0.35)",
  transition:
    "border-color var(--motion-fast) var(--ease-standard), " +
    "transform var(--motion-fast) var(--ease-standard), " +
    "box-shadow var(--motion-fast) var(--ease-standard)",
};
const pinnedBadge: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "3px 8px 3px 3px",
  background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)",
  borderRadius: 14, cursor: "pointer", color: "var(--text-primary)",
  maxWidth: 160, overflow: "hidden",
};
const pinnedAvatar: CSSProperties = {
  width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
};
const pinnedAvatarFallback: CSSProperties = {
  width: 22, height: 22, borderRadius: "50%",
  background: "var(--bg-space-2)",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 11, color: "var(--accent-cream)", fontWeight: 600, flexShrink: 0,
};
const pinnedLabel: CSSProperties = {
  fontSize: 11, color: "var(--text-primary)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const userBadgeWrap: CSSProperties = { position: "relative" };
const userBadgeBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: "50%",
  background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)",
  cursor: "pointer", padding: 0, overflow: "hidden",
};
const avatarImg: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const avatarFallback: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: "100%", height: "100%",
  fontSize: 12, fontWeight: 600, color: "var(--accent-cream)",
};
const userMenu: CSSProperties = {
  position: "absolute", right: 0, top: 36, minWidth: 200,
  background: "var(--bg-space-2)", border: "1px solid var(--border-ghost)",
  borderRadius: 6, padding: 6, zIndex: 50,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
};
const userMenuEmail: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)",
  padding: "6px 8px", borderBottom: "1px solid var(--border-ghost)",
  marginBottom: 4, wordBreak: "break-all",
};
const userMenuItem: CSSProperties = {
  width: "100%", textAlign: "left", padding: "6px 8px",
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 12, cursor: "pointer", borderRadius: 4,
};
const aiThinking: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic",
};
const aiThinkingDot: CSSProperties = {
  width: 6, height: 6, borderRadius: "50%",
  background: "var(--accent-cream)",
  animation: "tf-pulse 1.2s ease-in-out infinite",
};
const aiUsage: CSSProperties = {
  display: "inline-flex", alignItems: "center",
  fontSize: 10, color: "var(--text-secondary)",
  padding: "2px 6px", border: "1px solid var(--border-ghost)",
  borderRadius: 10, cursor: "help", letterSpacing: "0.04em",
};
// Day 55 — Help & support trigger. Sits between AI usage badge and
// the Sign-in / avatar button. Compact 24px circular ?.
const helpBtn: CSSProperties = {
  width: 24, height: 24, padding: 0,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--border-ghost)",
  borderRadius: "50%",
  color: "var(--text-secondary)",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit",
};
