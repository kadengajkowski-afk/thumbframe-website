import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { deleteProject } from "@/lib/projects";
import { saveNow } from "@/lib/autoSave";
import { toast } from "@/toasts/toastStore";

/** Day 20 — TopBar File menu. Replaces the bare project-name span:
 *   click = open dropdown
 *   double-click = rename (existing inline-edit behavior)
 *
 * Items mirror the Cmd+K command palette's File section so the
 * keyboard hotkey (Cmd+N / Cmd+S / etc.) and this menu trigger
 * the same code paths. */

type Props = {
  /** Inline-edit mode flag, owned by parent so the rename input
   * can replace the menu trigger when active. */
  onStartRename: () => void;
};

export function FileMenu({ onStartRename }: Props) {
  const projectName = useUiStore((s) => s.projectName);
  const setProjectsPanelOpen = useUiStore((s) => s.setProjectsPanelOpen);
  const currentProjectId = useUiStore((s) => s.currentProjectId);
  const user = useUiStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function newProject() {
    setOpen(false);
    const ui = useUiStore.getState();
    useDocStore.setState({ layers: [] });
    ui.setSelectedLayerIds([]);
    ui.setCurrentProjectId(null);
    ui.setProjectName("Untitled");
    ui.setSaveStatus({ kind: "idle" });
  }

  function openProjectsList() {
    setOpen(false);
    if (!user) {
      toast("Sign in to access saved projects");
      return;
    }
    setProjectsPanelOpen(true);
  }

  function startRename() {
    setOpen(false);
    onStartRename();
  }

  async function save() {
    setOpen(false);
    await saveNow();
  }

  async function del() {
    setOpen(false);
    if (!currentProjectId) {
      toast("Nothing to delete — project hasn't been saved yet");
      return;
    }
    const ok = window.confirm(`Delete "${projectName}"? This can't be undone.`);
    if (!ok) return;
    const removed = await deleteProject(currentProjectId);
    if (removed) toast("Project deleted");
  }

  return (
    <div ref={wrapRef} style={wrap}>
      <button
        type="button"
        style={trigger}
        onClick={() => setOpen((o) => !o)}
        onDoubleClick={onStartRename}
        title="File menu — double-click to rename"
        data-testid="project-name"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {projectName}
        <span style={chev} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div role="menu" style={menu} data-testid="file-menu">
          <Item label="New project" hint="Cmd+N" onClick={newProject} />
          <Item label="Open project…" onClick={openProjectsList} />
          <Item label="Rename project" onClick={startRename} />
          <Item label="Save" hint="Cmd+S" onClick={save} />
          <Divider />
          <Item
            label="Delete project"
            danger
            onClick={del}
            disabled={!currentProjectId}
          />
        </div>
      )}
    </div>
  );
}

function Item(props: {
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      style={{
        ...item,
        ...(props.danger ? itemDanger : null),
        ...(props.disabled ? itemDisabled : null),
      }}
      onClick={() => { if (!props.disabled) props.onClick(); }}
      disabled={props.disabled}
      data-testid={`file-menu-${props.label.toLowerCase().split(" ")[0]}`}
    >
      <span>{props.label}</span>
      {props.hint && <span style={hint}>{props.hint}</span>}
    </button>
  );
}

function Divider() {
  return <div style={divider} aria-hidden="true" />;
}

const wrap: CSSProperties = { position: "relative", display: "inline-flex" };
const trigger: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  fontSize: 13, color: "var(--text-secondary)", letterSpacing: "0.01em",
  background: "transparent", border: "1px solid transparent",
  padding: "2px 8px", borderRadius: 4, cursor: "pointer",
  fontFamily: "inherit",
};
const chev: CSSProperties = { fontSize: 9, opacity: 0.6, marginLeft: 2 };
const menu: CSSProperties = {
  position: "absolute", left: "50%", top: "calc(100% + 6px)",
  transform: "translateX(-50%)",
  minWidth: 220,
  background: "var(--bg-space-2)", border: "1px solid var(--border-ghost)",
  borderRadius: 6, padding: 4, zIndex: 60,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
};
const item: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  width: "100%", padding: "6px 10px",
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 12, cursor: "pointer",
  borderRadius: 4, textAlign: "left",
};
const itemDanger: CSSProperties = { color: "var(--accent-orange)" };
const itemDisabled: CSSProperties = { opacity: 0.4, cursor: "not-allowed" };
const hint: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.04em",
};
const divider: CSSProperties = {
  height: 1, background: "var(--border-ghost)", margin: "4px 0",
};
