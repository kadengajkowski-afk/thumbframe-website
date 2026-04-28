import { useEffect } from "react";
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
import { ExportPanel } from "@/editor/panels/ExportPanel";
import { AuthPanel } from "@/editor/panels/AuthPanel";
import { ProjectsPanel } from "@/editor/panels/ProjectsPanel";
import { PreviewRack } from "@/editor/panels/PreviewRack";
import { installHotkeys } from "@/editor/hotkeys";
import { ToastHost } from "@/toasts/Toast";
import { supabase } from "@/lib/supabase";
import { startAutoSave, loadDraftIfPresent } from "@/lib/autoSave";
import { listProjects, openProject } from "@/lib/projects";
import { useDocStore } from "@/state/docStore";

/** Module-scope flag so React 19 StrictMode's double-mount doesn't
 * fire bootLoad twice — the duplication-on-load bug in DEFERRED
 * traced back to two in-flight openProject calls racing setState. */
let bootLoadStarted = false;

/** Cycle 1 shell: empty state until hasEntered, then the editor grid.
 * The ShipComingAlive wrapper owns the first-visit transition. */
export function App() {
  const hasEntered = useUiStore((s) => s.hasEntered);
  const dragActive = useDropTarget();

  useEffect(() => installHotkeys(), []);

  // Day 20 — auth subscription + boot-time project / draft recovery
  // + auto-save. Boot order matters:
  //   1. Resolve session (Supabase getSession).
  //   2. If signed-in → fetch most-recent project + open it. The
  //      empty-canvas-on-refresh bug came from skipping this load.
  //   3. If signed-out → restore the localStorage draft.
  // onAuthStateChange handles future flips (sign-in / sign-out).
  useEffect(() => {
    const ui = useUiStore.getState();
    const stop = startAutoSave();

    // React 19 StrictMode dev-mounts this effect twice. The async
    // bootLoad below races itself if both invocations call openProject
    // before the first finishes — same row deserialized twice into the
    // same docStore. The module-scope guard makes bootLoad run once
    // per page load.
    async function bootLoad() {
      if (bootLoadStarted) return;
      bootLoadStarted = true;
      if (!supabase) {
        await loadDraftIfPresent();
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
          await openProject(rows[0]!.id);
        }
      } else {
        await loadDraftIfPresent();
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
      <ExportPanel />
      <AuthPanel />
      <ProjectsPanel />
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
