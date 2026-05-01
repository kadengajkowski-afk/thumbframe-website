import { lazy, Suspense, useEffect } from "react";
import { useUiStore } from "@/state/uiStore";
import { CompositorHost } from "@/editor/CompositorHost";
import { TextEditor } from "@/editor/TextEditor";
import { BgRemoveOverlay } from "@/editor/BgRemoveOverlay";
import { TopBar } from "@/editor/panels/TopBar";
import { LayerPanel } from "@/editor/panels/LayerPanel";
import { ContextPanel } from "@/editor/panels/ContextPanel";
import { ThumbFriendPanel } from "@/editor/panels/ThumbFriendPanel";
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
import { installHotkeys } from "@/editor/hotkeys";
import { ToastHost } from "@/toasts/Toast";
import { supabase } from "@/lib/supabase";
import { startAutoSave } from "@/lib/autoSave";
import { resolveUserTier } from "@/lib/userTier";
import { useNudgeWatcher } from "@/editor/hooks/useNudgeWatcher";
import { useOnboardingStore } from "@/state/onboardingStore";

// Day 51 — onboarding flow is lazy-loaded. Returning users (the
// vast majority after the first wave) never pay for it on boot.
const OnboardingFlow = lazy(() =>
  import("@/editor/onboarding/OnboardingFlow").then((m) => ({ default: m.OnboardingFlow })),
);

/** Cycle 1 shell: empty state until hasEntered, then the editor grid.
 * The ShipComingAlive wrapper owns the first-visit transition. */
export function App() {
  const hasEntered = useUiStore((s) => s.hasEntered);
  const dragActive = useDropTarget();

  useEffect(() => installHotkeys(), []);

  // Day 44 — ThumbFriend Nudge watcher. Fires Haiku-backed nudge
  // requests after 8s of layer idle. Costs only when signed-in users
  // are actively editing; cheap (~$0.001/call, 20/day free cap).
  useNudgeWatcher();

  // Day 52 — Onboarding first-run detection + existing-user
  // migration. On boot:
  //   1. If localStorage already says completed → idle, never show
  //      onboarding.
  //   2. Else if the user is signed in AND has any v3_projects rows,
  //      mark completed (they're not new) and stay idle.
  //   3. Else fire startOnboarding().
  // Step 2 runs asynchronously after auth resolves; until then,
  // step 3 may have already fired — that's fine, the migration path
  // calls completeOnboarding() which transitions back to idle and
  // unmounts the overlay. The user might briefly see Step A before
  // it dismisses; acceptable for the rare existing-user-on-new-
  // device case.
  useEffect(() => {
    const ob = useOnboardingStore.getState();
    if (!ob.completed && ob.step === "idle") {
      ob.startOnboarding();
    }
  }, []);

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
        // Day 52 — existing-user onboarding migration. If this user
        // has any saved projects, they're not new; mark onboarding
        // completed so the overlay dismisses.
        void migrateExistingUser(u.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      ui.setUser(u ? {
        id: u.id,
        email: u.email ?? null,
        avatarUrl: (u.user_metadata as { avatar_url?: string } | null)?.avatar_url ?? null,
      } : null);
      if (u?.email) void resolveUserTier(u.email);
      if (u?.id) void migrateExistingUser(u.id);
    });
    return () => {
      sub.subscription.unsubscribe();
      stop();
    };
  }, []);

  return (
    <div style={shell}>
      <Nebula />
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
        <OnboardingFlow />
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
      <TopBar />
      <div style={editorRow}>
        <ToolPalette />
        <main style={{ ...canvasSurface, cursor }} data-alive="canvas">
          <CompositorHost />
          <TextEditor />
          <BgRemoveOverlay />
          <ZoomIndicator />
        </main>
        {thumbfriendOpen ? <ThumbFriendPanel /> : previewOpen ? <PreviewRack /> : <ContextPanel />}
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

/** Day 52 — existing-user migration helper. If a signed-in user has
 * any saved projects, they're not new — mark onboarding completed
 * silently so the overlay dismisses. Best-effort: a Supabase error
 * leaves the user in the onboarding flow, which is recoverable. */
async function migrateExistingUser(userId: string): Promise<void> {
  const ob = useOnboardingStore.getState();
  if (ob.completed) return;
  const [{ countProjectsForUser }] = await Promise.all([
    import("@/lib/projects"),
  ]);
  const count = await countProjectsForUser(userId);
  if (count > 0) {
    // Returning user — quietly mark complete without firing the
    // analytics "completed" or "skipped" events (they didn't go
    // through the flow).
    useOnboardingStore.getState().markCompletedSilent();
  }
}

function deriveCursor(s: CursorShape): string {
  if (s.isHandMode || s.activeTool === "hand") {
    return s.isPanActive ? "grabbing" : "grab";
  }
  if (s.activeTool === "rect" || s.activeTool === "ellipse") return "crosshair";
  if (s.activeTool === "text") return "text";
  if (s.activeTool === "select" && s.hoveredLayerId) return "move";
  return "default";
}

function Nebula() {
  return <div style={nebula} aria-hidden="true" />;
}

// ── styles ──────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-space-1)",
  overflow: "hidden",
};

const nebula: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(1100px 700px at 18% 22%, rgba(96, 56, 180, 0.28), transparent 70%), " +
    "radial-gradient(900px 620px at 82% 78%, rgba(208, 112, 64, 0.18), transparent 70%), " +
    "radial-gradient(600px 420px at 50% 50%, rgba(120, 90, 200, 0.10), transparent 80%), " +
    "var(--bg-space-1)",
  pointerEvents: "none",
  zIndex: 0,
};

const editorGrid: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "grid",
  gridTemplateRows: "48px 1fr 200px",
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
  background: "var(--bg-space-0)",
  overflow: "hidden",
  position: "relative",
};
