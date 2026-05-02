import { useEffect, useRef } from "react";
import { useUiStore } from "@/state/uiStore";
import { TOOLS, type Tool } from "@/editor/tools/tools";
import { ToolIcon, UploadIcon } from "./ToolPalette.icons";
import { runCommand } from "@/lib/commands";
import { Tooltip } from "./Tooltip";
import { ThumbFriendToolbarButton } from "./ThumbFriendToolbarButton";
import { AiToolsMenu } from "./AiToolsMenu";
import "./tool-palette.css";

const DROP_SESSION_KEY = "thumbframe:tool-drop:played";

/**
 * Left-rail tool palette. Day 53 reorganized into two groups:
 *
 *   Drawing tools (top)
 *     Select, Hand, Rect, Ellipse, Text, Upload image
 *   ── divider ──
 *   AI features
 *     ThumbFriend (animated ship + crew peek)
 *     AI tools (dropdown: Generate / Brand Kit / Preview / BG remove)
 *
 * Tooltips come from the shared <Tooltip> component (Day 53 Part 3) —
 * 400ms hover delay, also surface on keyboard focus.
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
      role="region"
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
      <UploadActionButton index={TOOLS.length} />
      <span className="tool-palette__divider" aria-hidden="true" />
      <span className="tool-palette__group" data-testid="tool-palette-ai-group">
        <ThumbFriendToolbarButton />
        <AiToolsMenu />
      </span>
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
    <Tooltip label={tool.label} shortcut={tool.shortcut}>
      <button
        type="button"
        className={cls}
        onClick={onClick}
        aria-pressed={active}
        aria-label={`${tool.label} (${tool.shortcut})`}
        style={{ ["--tool-index" as string]: index }}
      >
        <ToolIcon id={tool.id} />
      </button>
    </Tooltip>
  );
}

function UploadActionButton({ index }: { index: number }) {
  return (
    <Tooltip label="Upload image" shortcut="⌘I">
      <button
        type="button"
        className="tool-button"
        onClick={() => runCommand("file.upload")}
        aria-label="Upload image (Cmd+I)"
        data-testid="tool-palette-upload"
        style={{ ["--tool-index" as string]: index }}
      >
        <UploadIcon />
      </button>
    </Tooltip>
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
