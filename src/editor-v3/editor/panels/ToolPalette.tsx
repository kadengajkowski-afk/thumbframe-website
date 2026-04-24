import { useEffect, useRef } from "react";
import { useUiStore } from "@/state/uiStore";
import { TOOLS, type Tool } from "@/editor/tools/tools";
import { ToolIcon } from "./ToolPalette.icons";
import "./tool-palette.css";

const DROP_SESSION_KEY = "thumbframe:tool-drop:played";

/**
 * Left-rail tool palette. Renders TOOLS in order, selects via click
 * or V/H/R shortcut (wired in hotkeys.ts). On first mount per tab,
 * tool buttons sail-drop in from above — aligns with the tail of
 * the ship-alive left-rail reveal.
 */
export function ToolPalette() {
  const activeTool = useUiStore((s) => s.activeTool);
  const setTool = useUiStore((s) => s.setTool);
  // Compute once per mount. Subsequent mounts (e.g. tab refresh) skip
  // the animation because the session gate is set.
  const shouldDrop = useRef(!hasSessionGate(DROP_SESSION_KEY));

  useEffect(() => {
    if (shouldDrop.current) setSessionGate(DROP_SESSION_KEY);
  }, []);

  const palCls = shouldDrop.current
    ? "tool-palette tool-palette--drop"
    : "tool-palette";

  return (
    <aside
      className={palCls}
      aria-label="Tool palette"
      data-alive="leftrail"
    >
      {TOOLS.map((tool, i) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          index={i}
          active={tool.id === activeTool}
          onClick={() => setTool(tool.id)}
        />
      ))}
    </aside>
  );
}

type ButtonProps = {
  tool: Tool;
  index: number;
  active: boolean;
  onClick: () => void;
};

function ToolButton({ tool, index, active, onClick }: ButtonProps) {
  const cls = active ? "tool-button tool-button--active" : "tool-button";
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${tool.label} (${tool.shortcut})`}
      style={{ ["--tool-index" as string]: index }}
    >
      <ToolIcon id={tool.id} />
      <span className="tool-button__tooltip" role="tooltip">
        {tool.label}
        <span className="tool-button__tooltip-kbd">{tool.shortcut}</span>
      </span>
    </button>
  );
}

function hasSessionGate(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setSessionGate(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Private mode or quota — skip silently.
  }
}
