import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import { nanoid } from "nanoid";
import { hexToPixi } from "@/lib/color";

/**
 * Command registry. Every user-invokable action the editor exposes
 * lives here. Both the CommandPalette and hotkeys.ts dispatch through
 * runCommand(id) — single source of truth so a hotkey and a palette
 * click literally execute the same code path. No window globals.
 */

export type CommandSection =
  | "Tools"
  | "Edit"
  | "Layer"
  | "View"
  | "File"
  | "Canvas";

export type Command = {
  id: string;
  label: string;
  aliases?: string[];
  section: CommandSection;
  /** Keystroke pretty-printed for display — e.g. "Cmd+Z". */
  hotkey?: string;
  run: () => void;
};

const selectedIds = () => useUiStore.getState().selectedLayerIds;
const primaryId = () => selectedIds()[0] ?? null;

function withSelected(run: (id: string) => void) {
  return () => {
    const id = primaryId();
    if (id) run(id);
  };
}

function reorderSelected(target: "forward" | "backward" | "front" | "back") {
  const id = primaryId();
  if (!id) return;
  const layers = useDocStore.getState().layers;
  const idx = layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  let to = idx;
  if (target === "forward") to = Math.min(layers.length - 1, idx + 1);
  else if (target === "backward") to = Math.max(0, idx - 1);
  else if (target === "front") to = layers.length - 1;
  else to = 0;
  if (to !== idx) history.reorderLayer(id, to);
}

function openFilePicker() {
  if (typeof document === "undefined") return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif";
  input.style.display = "none";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (file) {
      const { handleUploadedFile } = await import("@/lib/uploadFlow");
      await handleUploadedFile(file);
    }
    input.remove();
  });
  document.body.appendChild(input);
  input.click();
}

function addRectAtCenter() {
  // Spawn a 160×100 rect centered on the canvas, picking up the
  // last-used fill color from uiStore (set by the Day 9 color picker).
  const id = nanoid();
  const CANVAS_W = 1280;
  const CANVAS_H = 720;
  const w = 160;
  const h = 100;
  const ui = useUiStore.getState();
  const color = hexToPixi(ui.lastFillColor || "#F97316") || 0xf97316;
  history.addLayer({
    id,
    type: "rect",
    x: (CANVAS_W - w) / 2,
    y: (CANVAS_H - h) / 2,
    width: w,
    height: h,
    color,
    opacity: 1,
    name: "Rectangle",
    hidden: false,
    locked: false,
    blendMode: "normal",
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeWidth: 0,
    strokeAlpha: 1,
  });
  ui.setSelectedLayerIds([id]);
}

const COMMANDS: Command[] = [
  // Tools
  { id: "tool.select", label: "Select tool", section: "Tools", hotkey: "V", aliases: ["pointer"], run: () => useUiStore.getState().setTool("select") },
  { id: "tool.hand", label: "Hand tool", section: "Tools", hotkey: "H", aliases: ["pan"], run: () => useUiStore.getState().setTool("hand") },
  { id: "tool.rect", label: "Rectangle tool", section: "Tools", hotkey: "R", aliases: ["square"], run: () => useUiStore.getState().setTool("rect") },
  { id: "tool.ellipse", label: "Ellipse tool", section: "Tools", hotkey: "O", aliases: ["circle", "oval"], run: () => useUiStore.getState().setTool("ellipse") },
  { id: "tool.text", label: "Text tool", section: "Tools", hotkey: "T", aliases: ["text", "type", "letter"], run: () => useUiStore.getState().setTool("text") },

  // Edit
  { id: "edit.undo", label: "Undo", section: "Edit", hotkey: "Cmd+Z", run: () => history.undo() },
  { id: "edit.redo", label: "Redo", section: "Edit", hotkey: "Cmd+Shift+Z", run: () => history.redo() },
  { id: "edit.delete", label: "Delete selected", section: "Edit", hotkey: "Del", aliases: ["remove"], run: () => { for (const id of selectedIds()) history.deleteLayer(id); } },
  { id: "edit.duplicate", label: "Duplicate selected", section: "Edit", hotkey: "Cmd+D", aliases: ["clone"], run: withSelected((id) => void history.duplicateLayer(id)) },
  { id: "edit.deselect", label: "Deselect all", section: "Edit", hotkey: "Esc", run: () => useUiStore.getState().setSelectedLayerIds([]) },

  // Layer
  { id: "layer.add-rect", label: "Add rectangle", section: "Layer", aliases: ["new rectangle", "create rect"], run: addRectAtCenter },
  { id: "layer.bring-forward", label: "Bring forward", section: "Layer", hotkey: "]", run: () => reorderSelected("forward") },
  { id: "layer.send-backward", label: "Send backward", section: "Layer", hotkey: "[", run: () => reorderSelected("backward") },
  { id: "layer.bring-to-front", label: "Bring to front", section: "Layer", hotkey: "Shift+]", run: () => reorderSelected("front") },
  { id: "layer.send-to-back", label: "Send to back", section: "Layer", hotkey: "Shift+[", run: () => reorderSelected("back") },
  { id: "layer.toggle-visibility", label: "Toggle visibility", section: "Layer", run: withSelected((id) => history.toggleLayerVisibility(id)) },
  { id: "layer.toggle-lock", label: "Toggle lock", section: "Layer", run: withSelected((id) => history.toggleLayerLock(id)) },

  // View
  { id: "view.zoom-in", label: "Zoom in", section: "View", hotkey: "Cmd++", run: () => getCurrentCompositor()?.zoomBy(1.2) },
  { id: "view.zoom-out", label: "Zoom out", section: "View", hotkey: "Cmd+-", run: () => getCurrentCompositor()?.zoomBy(1 / 1.2) },
  { id: "view.fit", label: "Fit to screen", section: "View", hotkey: "Cmd+0", run: () => getCurrentCompositor()?.fit(true) },
  { id: "view.100", label: "Zoom 100%", section: "View", hotkey: "Cmd+1", run: () => getCurrentCompositor()?.setZoomPercent(100, true) },
  { id: "view.50", label: "Zoom 50%", section: "View", run: () => getCurrentCompositor()?.setZoomPercent(50, true) },
  { id: "view.200", label: "Zoom 200%", section: "View", run: () => getCurrentCompositor()?.setZoomPercent(200, true) },
  { id: "view.400", label: "Zoom 400%", section: "View", run: () => getCurrentCompositor()?.setZoomPercent(400, true) },

  // File
  { id: "file.upload", label: "Upload image…", section: "File", aliases: ["open", "pick"], run: openFilePicker },

  // Canvas
  { id: "canvas.deselect", label: "Deselect all", section: "Canvas", run: () => useUiStore.getState().setSelectedLayerIds([]) },
];

export function listCommands(): readonly Command[] {
  return COMMANDS;
}

export function runCommand(id: string): void {
  const cmd = COMMANDS.find((c) => c.id === id);
  if (!cmd) return;
  cmd.run();
}
