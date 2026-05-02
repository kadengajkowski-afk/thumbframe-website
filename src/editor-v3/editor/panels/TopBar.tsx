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
    // Day 57 — wave shimmer accompanies the saving state. Themed
    // alternative to a generic spinner.
    return (
      <span style={saveBadge} data-testid="save-status">
        <WaveIcon />
        <span>Saving…</span>
        <style>{SAVE_KEYFRAMES}</style>
      </span>
    );
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
      <AnchorIcon />
      <span>{relativeTime(status.at, signedIn)}</span>
    </span>
  );
}

function AnchorIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="2.6" r="1.1" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="6" y1="3.7" x2="6" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="3.5" y1="5.4" x2="8.5" y2="5.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M 2.6 8 Q 2.6 10.2 6 10.2 Q 9.4 10.2 9.4 8" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 12" aria-hidden="true" className="tf-wave-icon">
      <path
        d="M 0 6 Q 1.75 3 3.5 6 Q 5.25 9 7 6 Q 8.75 3 10.5 6 Q 12.25 9 14 6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SAVE_KEYFRAMES = `
@keyframes tf-wave-drift {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-2px); }
}
.tf-wave-icon { animation: tf-wave-drift 1.4s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) { .tf-wave-icon { animation: none; } }
`;

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
    <div style={logoGroup} aria-label="thumbframe" className="tf-logo-group">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="tf-logo-mark">
        <line x1="10" y1="2.5" x2="10" y2="17" stroke="var(--accent-cream)" strokeWidth="1" strokeLinecap="round" />
        <path d="M 10.5 4 L 17 14.5 L 10.5 14.5 Z" fill="var(--accent-cream)" fillOpacity="0.9" />
        <path d="M 3 15 L 17 15 L 14.5 17.5 L 5.5 17.5 Z" fill="var(--accent-cream)" fillOpacity="0.72" />
      </svg>
      <span style={wordmark}>thumbframe</span>
      <style>{LOGO_KEYFRAMES}</style>
    </div>
  );
}

const LOGO_KEYFRAMES = `
@keyframes tf-logo-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-1px); }
}
.tf-logo-group:hover .tf-logo-mark { animation: tf-logo-bob 4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .tf-logo-group:hover .tf-logo-mark { animation: none; }
}
`;

const bar: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
  height: 48,
  // Day 57 — atmospheric gradient. Slightly darker at top, fading
  // toward bg-space-1 at bottom. The bottom border becomes a hint
  // of "horizon line" — cream tint at very low opacity.
  background:
    "linear-gradient(180deg, var(--bg-space-0) 0%, var(--bg-space-1) 100%)",
  borderBottom: "1px solid var(--border-ghost)",
  boxShadow: "inset 0 -1px 0 rgba(249, 240, 225, 0.03)",
  color: "var(--text-primary)",
  position: "relative",
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
  fontSize: 13, letterSpacing: "0.06em", fontWeight: 500,
  color: "var(--accent-cream)", textTransform: "lowercase",
};
const projectNameInput: CSSProperties = {
  fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)",
  borderRadius: 4, padding: "2px 6px", fontFamily: "inherit",
  width: 180,
};
const saveBadge: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic",
  display: "inline-flex", alignItems: "center", gap: 5,
};
const signInBtn: CSSProperties = {
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  padding: "5px 12px", fontSize: 12, cursor: "pointer",
};
const shipItBtn: CSSProperties = {
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 6, padding: "6px 14px",
  fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
  cursor: "pointer",
  transition: "opacity var(--motion-fast) var(--ease-standard)",
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
