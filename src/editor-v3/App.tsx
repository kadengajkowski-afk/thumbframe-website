import { lazy, Suspense, useEffect, useRef } from "react";
import { useUiStore } from "@/state/uiStore";
import { CompositorHost } from "@/editor/CompositorHost";
import { TextEditor } from "@/editor/TextEditor";
import { TopBar } from "@/editor/panels/TopBar";
import { LayerPanel } from "@/editor/panels/LayerPanel";
import { ContextPanel } from "@/editor/panels/ContextPanel";
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
import { installHotkeys } from "@/editor/hotkeys";
import { ToastHost } from "@/toasts/Toast";
import { supabase } from "@/lib/supabase";
import { startAutoSave, loadDraftIfPresent } from "@/lib/autoSave";
import { listProjects, openProject } from "@/lib/projects";
import { useDocStore } from "@/state/docStore";

/** Cycle 1 shell: empty state until hasEntered, then the editor grid.
 * The ShipComingAlive wrapper owns the first-visit transition. */
export function App() {
  const hasEntered = useUiStore((s) => s.hasEntered);
  const dragActive = useDropTarget();

  // React 19 StrictMode dev-mounts this effect twice. The async
  // bootLoad below races itself if both invocations call openProject
  // before the first finishes. useRef guards against the double-mount
  // without leaking module-level state across (hypothetical) future
  // remounts (e.g. when client-side routing lands). Day 30 deferred
  // this from a module flag; Day 32 fix-up swaps it in.
  const bootLoadStarted = useRef(false);

  useEffect(() => installHotkeys(), []);

  // Day 20 — auth subscription + boot-time project / draft recovery
  // + auto-save. Boot order matters:
  //   1. Resolve session (Supabase getSession).
  //   2. If signed-in → fetch most-recent project + open it. The
  //      empty-canvas-on-refresh bug came from skipping this load.
  //   3. If signed-out → restore the localStorage draft.
  // onAuthStateChange handles future flips (sign-in / sign-out).
  //
  // Day 32 fix-up: after a project / draft loads with content, flip
  // hasEntered=true so EditorShell renders. Without this, refresh
  // restored the layers into docStore but EmptyState kept rendering
  // because nothing pointed hasEntered at the loaded state, forcing
  // the user to upload a stub image just to enter the editor.
  useEffect(() => {
    const ui = useUiStore.getState();
    const stop = startAutoSave();

    async function bootLoad() {
      if (bootLoadStarted.current) return;
      bootLoadStarted.current = true;
      if (!supabase) {
        const restored = await loadDraftIfPresent();
        if (restored && useDocStore.getState().layers.length > 0) {
          useUiStore.getState().setHasEntered(true);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (u) {
        ui.setUser({
          id: u.id,
          email: u.email ?? null,
          avatarUrl: (u.user_metadata as { avatar_url?: string } | null)?.avatar_url ?? null,
        });
        // Reopen the most-recent project so refresh doesn't reset
        // the user to the empty state.
        const rows = await listProjects();
        if (rows.length > 0 && useDocStore.getState().layers.length === 0) {
          const ok = await openProject(rows[0]!.id);
          if (ok && useDocStore.getState().layers.length > 0) {
            useUiStore.getState().setHasEntered(true);
          }
        } else if (useDocStore.getState().layers.length > 0) {
          // openProject already ran via some other path (e.g. URL deep
          // link); just flip hasEntered to skip the empty state.
          useUiStore.getState().setHasEntered(true);
        }
      } else {
        const restored = await loadDraftIfPresent();
        if (restored && useDocStore.getState().layers.length > 0) {
          useUiStore.getState().setHasEntered(true);
        }
      }
    }
    void bootLoad();

    if (!supabase) return stop;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      ui.setUser(u ? {
        id: u.id,
        email: u.email ?? null,
        avatarUrl: (u.user_metadata as { avatar_url?: string } | null)?.avatar_url ?? null,
      } : null);
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
      </Suspense>
      <ToastHost />
    </div>
  );
}

function EditorShell() {
  const cursor = useUiStore(deriveCursor);
  // Day 21: PreviewRack replaces the ContextPanel slot when open.
  // Single right-side panel — never both at once.
  const previewOpen = useUiStore((s) => s.previewRackOpen);
  return (
    <div style={editorGrid}>
      <TopBar />
      <div style={editorRow}>
        <ToolPalette />
        <main style={{ ...canvasSurface, cursor }} data-alive="canvas">
          <CompositorHost />
          <TextEditor />
          <ZoomIndicator />
        </main>
        {previewOpen ? <PreviewRack /> : <ContextPanel />}
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
