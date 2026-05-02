import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { handleUploadedFile } from "@/lib/uploadFlow";
import { runCommand } from "@/lib/commands";
import { getCurrentCompositor } from "./compositorRef";

// Per CLAUDE.md: exactly ONE global keydown listener for the whole editor.
// Hotkeys dispatch via runCommand(id) where possible so the keyboard
// and the command palette share a single source of truth.

let installed = false;

export function installHotkeys() {
  if (installed) return () => {};
  installed = true;
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("keyup", handleKeyup);
  window.addEventListener("paste", handlePaste as EventListener);
  return () => {
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("keyup", handleKeyup);
    window.removeEventListener("paste", handlePaste as EventListener);
    installed = false;
  };
}

function handleKeydown(e: KeyboardEvent) {
  const meta = e.metaKey || e.ctrlKey;

  // Undo / redo run BEFORE the editable-target gate so they reach
  // the document even when a value input (number/color/range/etc.)
  // has focus — those inputs have no useful native undo stack and
  // would otherwise swallow Cmd+Z, leaving stroke / shadow / glow
  // edits effectively unundoable. We still defer to the browser
  // when focus sits on a real text input (textarea / contentEditable
  // / type=text etc.) — the user is mid-typing and probably wants
  // to undo their typing.
  if (meta && e.key.toLowerCase() === "z" && !hasNativeUndo(e.target)) {
    e.preventDefault();
    // Blur the value input so subsequent keystrokes don't keep
    // bouncing off it with stale focus.
    if (e.target instanceof HTMLElement) e.target.blur();
    if (e.shiftKey) runCommand("edit.redo");
    else runCommand("edit.undo");
    return;
  }
  if (meta && e.key.toLowerCase() === "y" && !hasNativeUndo(e.target)) {
    e.preventDefault();
    if (e.target instanceof HTMLElement) e.target.blur();
    runCommand("edit.redo");
    return;
  }

  if (isEditableTarget(e.target)) return;

  const ui = useUiStore.getState();

  // Cmd+K / Ctrl+K → command palette (toggle). Works whether palette
  // is open or closed.
  if (meta && e.key.toLowerCase() === "k") {
    e.preventDefault();
    ui.setCommandPaletteOpen(!ui.commandPaletteOpen);
    return;
  }
  // When the palette is open, let cmdk own the keyboard.
  if (ui.commandPaletteOpen) return;

  // Day 18 — Cmd+E opens the export panel ("Ship it"). Toggle.
  // Day 19 — Cmd+Shift+E re-ships with last-used settings (no panel).
  if (meta && e.key.toLowerCase() === "e") {
    e.preventDefault();
    if (e.shiftKey) runCommand("file.export-last");
    else ui.setExportPanelOpen(!ui.exportPanelOpen);
    return;
  }
  // When the export panel is open, let it own the keyboard (Esc closes).
  if (ui.exportPanelOpen) return;

  // Day 20 — Cmd+S manual save, Cmd+N new project.
  if (meta && e.key.toLowerCase() === "s") {
    e.preventDefault();
    runCommand("file.save");
    return;
  }
  if (meta && e.key.toLowerCase() === "n") {
    e.preventDefault();
    runCommand("file.new");
    return;
  }

  // Day 21 — Cmd+Shift+P toggles the multi-surface preview rack.
  if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
    e.preventDefault();
    runCommand("view.toggle-preview-rack");
    return;
  }

  // Day 31 — Cmd+B opens the Brand Kit panel.
  if (meta && !e.shiftKey && e.key.toLowerCase() === "b") {
    e.preventDefault();
    runCommand("file.brand-kit");
    return;
  }
  if (ui.brandKitPanelOpen) return;

  // Day 37 — Cmd+G opens the Image Generation panel.
  if (meta && !e.shiftKey && e.key.toLowerCase() === "g") {
    e.preventDefault();
    runCommand("file.image-gen");
    return;
  }
  if (ui.imageGenPanelOpen) return;

  // Day 38 — Cmd+U opens the Upgrade-to-Pro panel.
  if (meta && !e.shiftKey && e.key.toLowerCase() === "u") {
    e.preventDefault();
    runCommand("file.upgrade");
    return;
  }
  if (ui.upgradePanelOpen) return;

  // Day 39 — Cmd+/ toggles ThumbFriend chat. Different from Cmd+K
  // (command palette) — both reachable while typing isn't, the
  // editable-target gate already runs above.
  if (meta && !e.shiftKey && e.key === "/") {
    e.preventDefault();
    runCommand("view.thumbfriend");
    return;
  }

  // Cmd+I — open file picker for image upload. Mirrors the toolbar
  // upload button + Cmd+K "Upload image…" command. Same code path
  // as drag-drop and clipboard paste downstream of file.upload.
  if (meta && !e.shiftKey && e.key.toLowerCase() === "i") {
    e.preventDefault();
    runCommand("file.upload");
    return;
  }

  // Day 53 — Cmd+? opens the keyboard-shortcuts reference. Most
  // browsers report "?" on Shift+/, so this fires on either Cmd+?
  // or Cmd+Shift+/ — covers both common keyboard layouts.
  if (meta && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
    e.preventDefault();
    runCommand("help.shortcuts");
    return;
  }
  if (ui.shortcutsPanelOpen) return;

  // Zoom shortcuts.
  if (meta && (e.key === "=" || e.key === "+")) {
    e.preventDefault();
    runCommand("view.zoom-in");
    return;
  }
  if (meta && e.key === "-") {
    e.preventDefault();
    runCommand("view.zoom-out");
    return;
  }
  if (meta && e.key === "0") {
    e.preventDefault();
    runCommand("view.fit");
    return;
  }
  if (meta && e.key === "1") {
    e.preventDefault();
    runCommand("view.100");
    return;
  }

  // Tool shortcuts — V/H/R. Skip when modifier keys are held
  // (Cmd+V is paste) or when an editable target has focus.
  if (!meta && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === "v") {
      e.preventDefault();
      runCommand("tool.select");
      return;
    }
    if (k === "h") {
      e.preventDefault();
      runCommand("tool.hand");
      return;
    }
    if (k === "r") {
      e.preventDefault();
      runCommand("tool.rect");
      return;
    }
    if (k === "o") {
      e.preventDefault();
      runCommand("tool.ellipse");
      return;
    }
    if (k === "t") {
      e.preventDefault();
      runCommand("tool.text");
      return;
    }
  }

  // Duplicate: Cmd+D.
  if (meta && !e.shiftKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    runCommand("edit.duplicate");
    return;
  }

  // (Undo / redo handled above the editable-target gate so value
  // inputs don't swallow Cmd+Z / Cmd+Shift+Z / Cmd+Y.)

  // Day 14: Cmd+\ toggles smart guides. Backslash is harmless in
  // every other input context (no native default action across
  // browsers / OSes), so it's safe to bind globally.
  if (meta && e.key === "\\") {
    e.preventDefault();
    runCommand("toggle.smart-guides");
    return;
  }

  // Layer reorder: [ / ] (and Shift variants).
  if (!meta && e.key === "[") {
    e.preventDefault();
    runCommand(e.shiftKey ? "layer.send-to-back" : "layer.send-backward");
    return;
  }
  if (!meta && e.key === "]") {
    e.preventDefault();
    runCommand(e.shiftKey ? "layer.bring-to-front" : "layer.bring-forward");
    return;
  }

  // Space-hold → temporary hand mode.
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    useUiStore.getState().setHandMode(true);
    return;
  }

  // Delete / Backspace.
  if (e.key === "Delete" || e.key === "Backspace") {
    const ids = useUiStore.getState().selectedLayerIds;
    if (ids.length === 0) return;
    e.preventDefault();
    runCommand("edit.delete");
    return;
  }

  // Arrow nudge. One history entry per keypress (even with multi-
  // select) via a wrapping stroke; holding produces one entry per
  // auto-repeat keydown per spec.
  if (
    !meta &&
    (e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight")
  ) {
    const ids = useUiStore.getState().selectedLayerIds;
    if (ids.length === 0) return;
    e.preventDefault();
    nudgeLayers(ids, e.key, e.shiftKey ? 10 : 1);
    return;
  }

  // Escape — cancel active tool drag, else clear selection.
  if (e.key === "Escape") {
    if (getCurrentCompositor()?.cancelTool()) {
      e.preventDefault();
      return;
    }
    if (useUiStore.getState().selectedLayerIds.length > 0) {
      e.preventDefault();
      runCommand("edit.deselect");
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
    return;
  }
}

function handleKeyup(e: KeyboardEvent) {
  if (e.code === "Space") {
    useUiStore.getState().setHandMode(false);
  }
}

function handlePaste(e: ClipboardEvent) {
  const data = e.clipboardData;
  if (!data) return;

  // Day 28: YouTube URL paste → reference layer. Check text first
  // (cheap pattern match) before falling through to image-file
  // upload. Skip if focus is on a real text input — typing a URL
  // into a layer name shouldn't yank the editor into a fetch.
  const target = e.target;
  const isTextInput =
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA");
  if (!isTextInput) {
    const text = data.getData("text/plain");
    if (text) {
      void import("@/lib/youtubeReference").then(({ parseYouTubeUrl, importYouTubeReference }) => {
        if (parseYouTubeUrl(text)) {
          void importYouTubeReference(text);
        }
      });
      // We can't preventDefault asynchronously, but the bare-paste
      // case (no input focused) has no native default to suppress.
      // If the URL parse fails, fall through to image-file checks below.
    }
  }

  const items = data.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    if (item.kind !== "file") continue;
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    e.preventDefault();
    void handleUploadedFile(file);
    return;
  }
}

function nudgeLayers(ids: readonly string[], arrow: string, step: number) {
  const dx = arrow === "ArrowLeft" ? -step : arrow === "ArrowRight" ? step : 0;
  const dy = arrow === "ArrowUp" ? -step : arrow === "ArrowDown" ? step : 0;
  history.beginStroke(step === 1 ? "Nudge" : "Nudge (10px)");
  const layers = useDocStore.getState().layers;
  for (const id of ids) {
    const layer = layers.find((l) => l.id === id);
    if (!layer || layer.locked) continue;
    history.moveLayer(id, layer.x + dx, layer.y + dy);
  }
  history.endStroke();
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** True when the focused input is hosting EDITABLE TEXT and would
 * benefit from the browser's native undo stack — text-style <input>,
 * <textarea>, contentEditable. Returns false for value inputs
 * (number/color/range/checkbox/etc.) and <select>, where there's no
 * useful native undo and document Cmd+Z should still pass through. */
function hasNativeUndo(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA") return true;
  if (target.tagName !== "INPUT") return false;
  const type = (target as HTMLInputElement).type.toLowerCase();
  return (
    type === "text" ||
    type === "search" ||
    type === "url" ||
    type === "tel" ||
    type === "email" ||
    type === "password"
  );
}
