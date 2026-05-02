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
  // Day-12 bug. display:none inputs are silently rejected by Chrome
  // for programmatic .click() — the OS picker doesn't open. Use the
  // visually-hidden pattern instead. This path works today via the
  // command palette, but use the same shape as EmptyState so a future
  // browser update doesn't break this too.
  input.style.position = "absolute";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.padding = "0";
  input.style.margin = "-1px";
  input.style.overflow = "hidden";
  input.style.clip = "rect(0, 0, 0, 0)";
  input.style.whiteSpace = "nowrap";
  input.style.border = "0";
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
  { id: "edit.delete", label: "Delete selected", section: "Edit", hotkey: "Del", aliases: ["remove"], run: () => history.deleteLayers(selectedIds()) },
  { id: "edit.duplicate", label: "Duplicate selected", section: "Edit", hotkey: "Cmd+D", aliases: ["clone"], run: () => { void history.duplicateLayers(selectedIds()); } },
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
  { id: "file.upload", label: "Upload image…", section: "File", hotkey: "Cmd+I", aliases: ["open", "pick", "image", "add image", "import"], run: openFilePicker },

  // Canvas
  { id: "canvas.deselect", label: "Deselect all", section: "Canvas", run: () => useUiStore.getState().setSelectedLayerIds([]) },

  // Day 14: smart-guides master toggle.
  {
    id: "toggle.smart-guides",
    label: "Toggle smart guides",
    section: "View",
    hotkey: "Cmd+\\",
    aliases: ["snap", "guides"],
    run: () => {
      const ui = useUiStore.getState();
      ui.setSmartGuidesEnabled(!ui.smartGuidesEnabled);
      // Clear any active guides immediately on disable so a stale
      // snap line from an in-progress drag doesn't linger.
      if (ui.smartGuidesEnabled) getCurrentCompositor()?.clearGuides();
    },
  },

  // Day 19: export.
  {
    id: "file.export",
    label: "Ship it… (Export)",
    section: "File",
    hotkey: "Cmd+E",
    aliases: ["export", "save", "download"],
    run: () => useUiStore.getState().setExportPanelOpen(true),
  },
  {
    id: "file.export-last",
    label: "Re-ship with last settings",
    section: "File",
    hotkey: "Cmd+Shift+E",
    aliases: ["re-export", "ship again"],
    run: () => { void import("./exportFlow").then((m) => m.shipWithLastSettings()); },
  },
  {
    id: "file.export-selection",
    label: "Export selection",
    section: "File",
    aliases: ["ship selection", "export selected"],
    run: () => {
      const last = useUiStore.getState().lastExport;
      void import("./exportFlow").then((m) =>
        m.shipSelection({
          format: last?.format ?? "png",
          jpegQuality: last?.quality ?? 90,
        }),
      );
    },
  },
  {
    id: "dev.toggle-pro-tier",
    label: "Toggle Pro tier (dev)",
    section: "File",
    aliases: ["pro", "tier", "upgrade"],
    run: () => {
      const ui = useUiStore.getState();
      const next = ui.userTier === "pro" ? "free" : "pro";
      ui.setUserTier(next);
      void import("@/toasts/toastStore").then((m) =>
        m.toast(next === "pro" ? "Pro tier ON (dev)" : "Free tier"),
      );
    },
  },

  // Day 20: file actions + auth.
  {
    id: "file.save",
    label: "Save",
    section: "File",
    hotkey: "Cmd+S",
    aliases: ["save now"],
    run: () => { void import("./autoSave").then((m) => m.saveNow()); },
  },
  {
    id: "file.new",
    label: "New project",
    section: "File",
    hotkey: "Cmd+N",
    aliases: ["new"],
    run: () => {
      const ui = useUiStore.getState();
      useDocStore.setState({ layers: [] });
      ui.setSelectedLayerIds([]);
      ui.setCurrentProjectId(null);
      ui.setProjectName("Untitled");
      ui.setSaveStatus({ kind: "idle" });
    },
  },
  {
    id: "file.open-projects",
    label: "Open project…",
    section: "File",
    aliases: ["projects", "open"],
    run: () => useUiStore.getState().setProjectsPanelOpen(true),
  },
  {
    id: "auth.signin",
    label: "Sign in",
    section: "File",
    aliases: ["login", "sign in"],
    run: () => useUiStore.getState().setAuthPanelOpen(true),
  },
  {
    id: "auth.signout",
    label: "Sign out",
    section: "File",
    aliases: ["logout", "sign out"],
    run: () => {
      void import("./supabase").then(({ supabase }) => supabase?.auth.signOut());
    },
  },

  // Day 21 — multi-surface preview rack toggle.
  {
    id: "view.toggle-preview-rack",
    label: "Toggle preview rack",
    section: "View",
    hotkey: "Cmd+Shift+P",
    aliases: ["preview", "surfaces", "multi-surface"],
    run: () => {
      const ui = useUiStore.getState();
      ui.setPreviewRackOpen(!ui.previewRackOpen);
    },
  },

  // Day 31 — Brand Kit panel.
  {
    id: "file.brand-kit",
    label: "Brand Kit…",
    section: "File",
    hotkey: "Cmd+B",
    aliases: ["brand", "channel", "youtube", "palette"],
    run: () => useUiStore.getState().setBrandKitPanelOpen(true),
  },

  // Day 37 — Image generation panel.
  {
    id: "file.image-gen",
    label: "Generate image…",
    section: "File",
    hotkey: "Cmd+G",
    aliases: ["generate", "ai image", "fal", "thumbnail bg", "midjourney"],
    run: () => useUiStore.getState().setImageGenPanelOpen(true),
  },

  // Day 38 — Upgrade-to-Pro panel.
  {
    id: "file.upgrade",
    label: "Upgrade to Pro…",
    section: "File",
    hotkey: "Cmd+U",
    aliases: ["pro", "upgrade", "billing", "subscription", "plan", "stripe"],
    run: () => useUiStore.getState().setUpgradePanelOpen(true),
  },

  // Day 39 — ThumbFriend chat panel.
  {
    id: "view.thumbfriend",
    label: "Toggle ThumbFriend chat",
    section: "View",
    hotkey: "Cmd+/",
    aliases: ["chat", "ai", "thumbfriend", "ask", "assistant"],
    run: () => {
      const ui = useUiStore.getState();
      ui.setThumbfriendPanelOpen(!ui.thumbfriendPanelOpen);
    },
  },

  // Day 34 dev — smoke-test the Railway AI proxy end-to-end. The
  // bundled aiClient can't be reached via console `import()` since
  // Vite hashes its path, so this command is the only way to verify
  // the stream from a real signed-in browser session. Remove once
  // ThumbFriend lands Day 39+ (the real chat input replaces it).
  {
    id: "dev.ai-test",
    label: "AI: Send test message (dev)",
    section: "File",
    aliases: ["ai", "test", "stream", "chat", "thumbfriend"],
    run: () => { void runAiSmokeTest(); },
  },
];

async function runAiSmokeTest() {
  const { streamChat, AiError } = await import("./aiClient");
  const { toast } = await import("@/toasts/toastStore");
  console.group("[ai-test] streamChat smoke");
  console.log("starting…");
  try {
    let chunkCount = 0;
    for await (const event of streamChat({
      messages: [
        { role: "user", content: "Reply in one short sentence: pick a single thumbnail color for a tech review video." },
      ],
      intent: "edit",
    })) {
      console.log(event);
      if (event.type === "chunk") chunkCount += 1;
    }
    console.log(`done — ${chunkCount} chunk(s)`);
    console.groupEnd();
    toast(`AI response in console (${chunkCount} chunks)`);
  } catch (err) {
    console.error("[ai-test] failed:", err);
    console.groupEnd();
    if (err instanceof AiError) {
      toast(`AI failed (${err.code}) — see console`);
    } else {
      toast("AI failed — see console");
    }
  }
}

export function listCommands(): readonly Command[] {
  return COMMANDS;
}

export function runCommand(id: string): void {
  const cmd = COMMANDS.find((c) => c.id === id);
  if (!cmd) return;
  cmd.run();
}
