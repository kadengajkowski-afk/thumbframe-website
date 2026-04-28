import { type CSSProperties, useState } from "react";
import { useUiStore, type SaveStatus } from "@/state/uiStore";
import { supabase } from "@/lib/supabase";
import { FileMenu } from "./FileMenu";

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
        {user ? (
          <UserBadge email={user.email} avatarUrl={user.avatarUrl} />
        ) : (
          <button
            type="button"
            style={signInBtn}
            onClick={() => openAuth(true)}
            title="Sign in to sync your work across devices"
            data-testid="topbar-signin"
          >
            Sign in to sync
          </button>
        )}
        <button
          type="button"
          style={shipItBtn}
          title="Export the canvas (Cmd+E)"
          onClick={() => openExport(true)}
          data-testid="topbar-ship"
        >
          Ship it
        </button>
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
      <button
        type="button"
        style={userBadgeBtn}
        onClick={() => setOpen((o) => !o)}
        title={props.email ?? ""}
        data-testid="topbar-user"
      >
        {props.avatarUrl ? (
          <img src={props.avatarUrl} alt="" style={avatarImg} />
        ) : (
          <span style={avatarFallback}>{initials}</span>
        )}
      </button>
      {open && (
        <div style={userMenu} onMouseLeave={() => setOpen(false)}>
          <div style={userMenuEmail}>{props.email}</div>
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

function Logo() {
  return (
    <div style={logoGroup} aria-label="thumbframe">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <line x1="10" y1="2.5" x2="10" y2="17" stroke="var(--accent-cream)" strokeWidth="1" strokeLinecap="round" />
        <path d="M 10.5 4 L 17 14.5 L 10.5 14.5 Z" fill="var(--accent-cream)" fillOpacity="0.9" />
        <path d="M 3 15 L 17 15 L 14.5 17.5 L 5.5 17.5 Z" fill="var(--accent-cream)" fillOpacity="0.72" />
      </svg>
      <span style={wordmark}>thumbframe</span>
    </div>
  );
}

const bar: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
  height: 48, borderBottom: "1px solid var(--border-ghost)",
  background: "var(--bg-space-1)", color: "var(--text-primary)",
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
