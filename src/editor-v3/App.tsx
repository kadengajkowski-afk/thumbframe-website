import { lazy, Suspense, useEffect } from "react";
import { useUiStore } from "@/state/uiStore";
import { CompositorHost } from "@/editor/CompositorHost";
import { TextEditor } from "@/editor/TextEditor";
import { BgRemoveOverlay } from "@/editor/BgRemoveOverlay";
import { TopBar } from "@/editor/panels/TopBar";
import { LayerPanel } from "@/editor/panels/LayerPanel";
import { ContextPanel } from "@/editor/panels/ContextPanel";
// Day 56 — ThumbFriendPanel lazy-loaded. Pulls in NudgeMode + PartnerMode +
// the crew picker + the AI client off the main bundle.
const ThumbFriendPanel = lazy(() =>
  import("@/editor/panels/ThumbFriendPanel").then((m) => ({ default: m.ThumbFriendPanel })),
);
import { ShipComingAlive } from "@/editor/transitions/ShipComingAlive";
import { EmptyState } from "@/editor/EmptyState";
import { DropZone } from "@/editor/DropZone";
import { useDropTarget } from "@/editor/useDropTarget";
import { ZoomIndicator } from "@/editor/ZoomIndicator";
import { ToolPalette } from "@/editor/panels/ToolPalette";
import { CommandPalette } from "@/editor/CommandPalette";
import { PreviewRack } from "@/editor/panels/PreviewRack";

/** Day 33 — modal-style panels lazy-load on first open. Each is gated
 * behind a user action (hotkey or button) so the boot path doesn't
 * pay for code that may never run. AuthPanel, ProjectsPanel, and
 * ExportPanel were Day-30 DEFERRED follow-ups; BrandKitPanel is the
 * new Day-33 addition. PreviewRack stays eager because it's part of
 * the right-rail layout, not modal. */
const AuthPanel = lazy(() =>
  import("@/editor/panels/AuthPanel").then((m) => ({ default: m.AuthPanel })),
);
const ProjectsPanel = lazy(() =>
  import("@/editor/panels/ProjectsPanel").then((m) => ({ default: m.ProjectsPanel })),
);
const ExportPanel = lazy(() =>
  import("@/editor/panels/ExportPanel").then((m) => ({ default: m.ExportPanel })),
);
const BrandKitPanel = lazy(() =>
  import("@/editor/panels/BrandKitPanel").then((m) => ({ default: m.BrandKitPanel })),
);
const ImageGenPanel = lazy(() =>
  import("@/editor/panels/ImageGenPanel").then((m) => ({ default: m.ImageGenPanel })),
);
const UpgradePanel = lazy(() =>
  import("@/editor/panels/UpgradePanel").then((m) => ({ default: m.UpgradePanel })),
);
const ShortcutsPanel = lazy(() =>
  import("@/editor/panels/ShortcutsPanel").then((m) => ({ default: m.ShortcutsPanel })),
);
const HelpPanel = lazy(() =>
  import("@/editor/panels/HelpPanel").then((m) => ({ default: m.HelpPanel })),
);
import { installHotkeys } from "@/editor/hotkeys";
import { ToastHost } from "@/toasts/Toast";
import { supabase } from "@/lib/supabase";
import { startAutoSave } from "@/lib/autoSave";
import { resolveUserTier } from "@/lib/userTier";
import { useNudgeWatcher } from "@/editor/hooks/useNudgeWatcher";
import { MobileGate, useIsMobileViewport } from "@/editor/MobileGate";
import { PastDueBanner } from "@/editor/panels/PastDueBanner";

/** Cycle 1 shell: empty state until hasEntered, then the editor grid.
 * The ShipComingAlive wrapper owns the first-visit transition. */
export function App() {
  const hasEntered = useUiStore((s) => s.hasEntered);
  const dragActive = useDropTarget();
  // Day 54 — gate the editor on mobile viewports BEFORE the Pixi
  // boot. Returning the gate short-circuits installHotkeys + auth
  // resolution + Compositor mount; mobile users see a "use desktop"
  // card instead of a half-broken canvas.
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    if (isMobile) return;
    return installHotkeys();
  }, [isMobile]);

  // Day 44 — ThumbFriend Nudge watcher. Fires Haiku-backed nudge
  // requests after 8s of layer idle. Costs only when signed-in users
  // are actively editing; cheap (~$0.001/call, 20/day free cap).
  // Skipped on mobile — gate short-circuits the editor mount.
  useNudgeWatcher();

  if (isMobile) {
    return (
      <div style={shell}>
        <MobileGate />
      </div>
    );
  }

  // Day 36 fix — auto-load-most-recent-project on boot was removed.
  // Refresh now ALWAYS lands on the empty state (Figma / Photoshop
  // model). Auto-save still runs in the background; users resume via
  // FileMenu → "Open project…" (or Cmd+O). Boot-time auto-load made
  // stuck states (BG-remove worker hangs, infinite loops, broken
  // model URL) sticky across refresh — the user couldn't escape
  // without manual cleanup. Empty-state-first removes that trap.
  //
  // What stays: auth subscription (so user / Pro tier resolves),
  // startAutoSave() (so the project is still saved as the user
  // edits). What's gone: listProjects() + openProject(rows[0]!.id)
  // + loadDraftIfPresent() at boot.
  useEffect(() => {
    const ui = useUiStore.getState();
    const stop = startAutoSave();

    if (!supabase) return stop;

    // Day 57b cleanup — drop a stale session BEFORE getSession() so
    // we don't trigger a background refresh against an expired token.
    // supabase-js will keep the cached row in localStorage even after
    // an access_token expires; refresh-on-load fires a network call
    // that may fail (CORS / Cloudflare / aborted), leaving the editor
    // in a half-signed-in state. Reading expires_at directly is the
    // cheapest way to detect this without a round-trip.
    try {
      const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
      const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (ref) {
        const key = `sb-${ref}-auth-token`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { expires_at?: number };
          const now = Math.floor(Date.now() / 1000);
          // expires_at is seconds-epoch. Treat anything that already
          // expired (or expires within 30s) as stale and wipe it.
          if (typeof parsed.expires_at === "number" && parsed.expires_at < now + 30) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch { /* best-effort; don't block boot on parse errors */ }

    // Resolve initial auth session so the TopBar avatar + Pro flag
    // are populated. We do NOT load a project here.
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      if (u) {
        ui.setUser({
          id: u.id,
          email: u.email ?? null,
          avatarUrl: (u.user_metadata as { avatar_url?: string } | null)?.avatar_url ?? null,
        });
        // Day 38 — resolve Stripe-backed tier from profiles row.
        void resolveUserTier(u.email ?? null);
      }
    }).catch((err) => {
      // Don't let an auth failure block the editor from booting.
      console.warn("[Auth] getSession() failed; treating as signed-out:", err);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      ui.setUser(u ? {
        id: u.id,
        email: u.email ?? null,
        avatarUrl: (u.user_metadata as { avatar_url?: string } | null)?.avatar_url ?? null,
      } : null);
      if (u?.email) void resolveUserTier(u.email);
    });
    return () => {
      sub.subscription.unsubscribe();
      stop();
    };
  }, []);

  return (
    <div style={shell}>
      {/* Day 53 a11y — skip-to-editor link. Hidden until Tab focus,
          jumps focus past the toolbar to the canvas main element. */}
      <a href="#tf-canvas" className="tf-skip-link">Skip to editor</a>
      {/* Day 57b — Nebula component removed. Body bg + body::before
          star field own the atmosphere now (see tokens.css). Keeping
          two parallel atmospheric layers stacked one redundantly
          obscured the new body atmosphere entirely. */}
      <ShipComingAlive
        hasEntered={hasEntered}
        empty={<EmptyState />}
        editor={<EditorShell />}
      />
      {dragActive && <DropZone />}
      <CommandPalette />
      <Suspense fallback={null}>
        <ExportPanel />
        <AuthPanel />
        <ProjectsPanel />
        <BrandKitPanel />
        <ImageGenPanel />
        <UpgradePanel />
        <ShortcutsPanel />
        <HelpPanel />
      </Suspense>
      <ToastHost />
    </div>
  );
}

function EditorShell() {
  const cursor = useUiStore(deriveCursor);
  // Day 21 / 39: right slot is mutually exclusive — ThumbFriend ▸
  // PreviewRack ▸ ContextPanel (default). Cmd+/ wins over Cmd+Shift+P.
  const previewOpen = useUiStore((s) => s.previewRackOpen);
  const thumbfriendOpen = useUiStore((s) => s.thumbfriendPanelOpen);
  return (
    <div style={editorGrid}>
      <PastDueBanner />
      <TopBar />
      <div style={editorRow}>
        <ToolPalette />
        <main
          id="tf-canvas"
          tabIndex={-1}
          aria-label="Editor canvas"
          style={{ ...canvasSurface, cursor }}
          data-alive="canvas"
        >
          <CompositorHost />
          <TextEditor />
          <BgRemoveOverlay />
          <ZoomIndicator />
        </main>
        {thumbfriendOpen ? (
          <Suspense fallback={<aside style={{ width: 320, background: "var(--bg-space-1)", borderLeft: "1px solid var(--border-ghost)" }} />}>
            <ThumbFriendPanel />
          </Suspense>
        ) : previewOpen ? <PreviewRack /> : <ContextPanel />}
      </div>
      <LayerPanel />
    </div>
  );
}

type CursorShape = {
  activeTool: "select" | "hand" | "rect" | "ellipse" | "text";
  isHandMode: boolean;
  isPanActive: boolean;
  hoveredLayerId: string | null;
};

function deriveCursor(s: CursorShape): string {
  if (s.isHandMode || s.activeTool === "hand") {
    return s.isPanActive ? "grabbing" : "grab";
  }
  if (s.activeTool === "rect" || s.activeTool === "ellipse") return "crosshair";
  if (s.activeTool === "text") return "text";
  if (s.activeTool === "select" && s.hoveredLayerId) return "move";
  return "default";
}

// ── styles ──────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Day 57b — transparent shell so body atmosphere shows through.
  // The editor grid still has opaque panels; only the EmptyState +
  // gaps around the editor reveal the bg.
  background: "transparent",
  overflow: "hidden",
};

const editorGrid: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "grid",
  // Day 54: extra `auto` row at the top for the past-due banner.
  // Row collapses to 0 when PastDueBanner returns null so healthy
  // subscriptions get the prior 3-row layout unchanged.
  gridTemplateRows: "auto 48px 1fr 200px",
};

const editorRow: React.CSSProperties = {
  display: "flex",
  minHeight: 0,
  // Constrain the row to the viewport so flex children with
  // explicit widths can't overflow past the right edge.
  width: "100%",
  minWidth: 0,
  overflow: "hidden",
};

const canvasSurface: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "stretch",
  // Day 57b — keep a soft solid base so the canvas surface still
  // reads as "stage" but layer the body atmosphere on top via a
  // semi-transparent radial gradient. Pixi paints its own dark
  // canvasFill inside the working area; everything around the Pixi
  // canvas now picks up a subtle atmospheric tint.
  background:
    "radial-gradient(ellipse at center, rgba(96, 56, 180, 0.10), transparent 70%), " +
    "var(--bg-space-0)",
  overflow: "hidden",
  position: "relative",
};
