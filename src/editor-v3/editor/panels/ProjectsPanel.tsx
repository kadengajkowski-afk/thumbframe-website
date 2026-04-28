import { useEffect, useState, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import {
  listProjects,
  openProject,
  renameProject,
  duplicateProject,
  deleteProject,
  createNewProject,
  type ProjectRow,
} from "@/lib/projects";
import { toast } from "@/toasts/toastStore";

/** Day 20 — projects list modal. Opens via Cmd+K → "Open project…"
 * or programmatically via uiStore.setProjectsPanelOpen(true). Lists
 * the user's most-recent v3_projects rows, click to open. Right-
 * click row → menu (Rename / Duplicate / Delete). */

export function ProjectsPanel() {
  const open = useUiStore((s) => s.projectsPanelOpen);
  const close = useUiStore((s) => s.setProjectsPanelOpen);
  const user = useUiStore((s) => s.user);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuFor, setMenuFor] = useState<ProjectRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listProjects().then((data) => {
      setRows(data);
      setLoading(false);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  async function onOpen(row: ProjectRow) {
    const ok = await openProject(row.id);
    if (ok) close(false);
  }

  async function onNew() {
    const id = await createNewProject("Untitled");
    if (id) {
      toast("New project created");
      close(false);
    }
  }

  async function onDuplicate(row: ProjectRow) {
    setMenuFor(null);
    const newId = await duplicateProject(row.id);
    if (newId) {
      toast("Project duplicated");
      const next = await listProjects();
      setRows(next);
    }
  }

  async function onRename(row: ProjectRow) {
    setMenuFor(null);
    const next = window.prompt("Rename project", row.name);
    if (!next || next.trim() === row.name) return;
    await renameProject(row.id, next.trim());
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, name: next.trim() } : r)));
  }

  async function onDelete(row: ProjectRow) {
    setMenuFor(null);
    const ok = window.confirm(`Delete "${row.name}"? This can't be undone.`);
    if (!ok) return;
    const removed = await deleteProject(row.id);
    if (removed) {
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      toast("Project deleted");
    }
  }

  return (
    <div role="dialog" aria-label="Projects" style={backdrop} onClick={() => close(false)} data-testid="projects-panel">
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <header style={cardHeader}>Projects</header>
        {!user ? (
          <div style={empty}>
            Sign in to save and access your projects across devices.
          </div>
        ) : (
          <>
            <button type="button" style={newBtn} onClick={onNew} data-testid="projects-new">
              + New project
            </button>
            {loading ? (
              <div style={empty}>Loading…</div>
            ) : rows.length === 0 ? (
              <div style={empty}>
                No projects yet — your work auto-saves once you start editing.
              </div>
            ) : (
              <div style={list} data-testid="projects-list">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    style={listRow}
                    onClick={() => onOpen(row)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenuFor(menuFor?.id === row.id ? null : row);
                    }}
                  >
                    <div style={thumbBox}>
                      {row.thumbnail_url ? (
                        <img src={row.thumbnail_url} alt="" style={thumb} />
                      ) : (
                        <div style={thumbPlaceholder}>—</div>
                      )}
                    </div>
                    <div style={rowText}>
                      <div style={rowName}>{row.name || "Untitled"}</div>
                      <div style={rowTime}>{relativeTime(row.updated_at)}</div>
                    </div>
                    {menuFor?.id === row.id && (
                      <div style={menu} onClick={(e) => e.stopPropagation()}>
                        <button type="button" style={menuItem} onClick={() => onRename(row)}>Rename</button>
                        <button type="button" style={menuItem} onClick={() => onDuplicate(row)}>Duplicate</button>
                        <button type="button" style={{ ...menuItem, color: "var(--accent-orange)" }} onClick={() => onDelete(row)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <button type="button" style={cancelBtn} onClick={() => close(false)}>
          Close
        </button>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const backdrop: CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100,
};
const card: CSSProperties = {
  width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column",
  background: "var(--bg-space-2)", border: "1px solid var(--border-ghost)",
  borderRadius: 10, padding: "20px 22px", color: "var(--text-primary)",
  boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
};
const cardHeader: CSSProperties = {
  fontSize: 16, fontWeight: 600,
  color: "var(--accent-cream)", marginBottom: 14,
};
const newBtn: CSSProperties = {
  width: "100%", padding: "10px 14px", marginBottom: 12,
  background: "var(--accent-orange)", border: "none", borderRadius: 6,
  color: "var(--bg-space-0)", fontWeight: 600, fontSize: 13,
  cursor: "pointer",
};
const list: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  maxHeight: "55vh", overflowY: "auto",
};
const listRow: CSSProperties = {
  position: "relative",
  display: "flex", alignItems: "center", gap: 12,
  padding: 8, background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  cursor: "pointer",
};
const thumbBox: CSSProperties = {
  width: 80, height: 45, flexShrink: 0,
  background: "#000", borderRadius: 4, overflow: "hidden",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const thumb: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const thumbPlaceholder: CSSProperties = {
  fontSize: 14, color: "var(--text-secondary)",
};
const rowText: CSSProperties = { flex: 1, minWidth: 0 };
const rowName: CSSProperties = {
  fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const rowTime: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)", marginTop: 2,
};
const menu: CSSProperties = {
  position: "absolute", right: 8, top: "100%",
  background: "var(--bg-space-2)", border: "1px solid var(--border-ghost)",
  borderRadius: 6, padding: 4, zIndex: 1,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
};
const menuItem: CSSProperties = {
  display: "block", width: "100%", textAlign: "left",
  padding: "6px 12px", background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 12, cursor: "pointer", borderRadius: 4,
};
const empty: CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)",
  padding: "24px 8px", textAlign: "center", lineHeight: 1.5,
};
const cancelBtn: CSSProperties = {
  marginTop: 14, width: "100%", padding: "8px 14px",
  background: "transparent", border: "1px solid var(--border-ghost)",
  borderRadius: 6, color: "var(--text-secondary)", fontSize: 12,
  cursor: "pointer",
};
