import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { handleUploadedFile } from "@/lib/uploadFlow";
import { getCurrentCompositor } from "./compositorRef";

// Per CLAUDE.md: exactly ONE global keydown listener for the whole editor.
// v1 had four overlapping listeners; that was a steady source of bugs.
// keyup + paste are separate event types, registered alongside so all
// OS-input wiring lives in this one module.

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
  if (isEditableTarget(e.target)) return;

  const meta = e.metaKey || e.ctrlKey;

  // Zoom shortcuts. Cmd+= / Cmd+- / Cmd+0 / Cmd+1. Cmd+= also fires as
  // "+" on some keyboards; accept both.
  if (meta && (e.key === "=" || e.key === "+")) {
    e.preventDefault();
    getCurrentCompositor()?.zoomBy(1.2);
    return;
  }
  if (meta && e.key === "-") {
    e.preventDefault();
    getCurrentCompositor()?.zoomBy(1 / 1.2);
    return;
  }
  if (meta && e.key === "0") {
    e.preventDefault();
    getCurrentCompositor()?.fit(true);
    return;
  }
  if (meta && e.key === "1") {
    e.preventDefault();
    getCurrentCompositor()?.setZoomPercent(100, true);
    return;
  }

  // Undo / redo.
  if (meta && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) history.redo();
    else history.undo();
    return;
  }
  if (meta && e.key.toLowerCase() === "y") {
    e.preventDefault();
    history.redo();
    return;
  }

  // Space-hold → temporary hand mode. Skip key-repeat so we don't thrash
  // the viewport plugin on every auto-repeat tick.
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    useUiStore.getState().setHandMode(true);
    return;
  }

  // Delete / Backspace — drop the selected layer.
  if (e.key === "Delete" || e.key === "Backspace") {
    const id = useUiStore.getState().selectedLayerId;
    if (!id) return;
    e.preventDefault();
    history.deleteLayer(id);
    useUiStore.getState().setSelectedLayerId(null);
    return;
  }

  // Escape clears selection. Also blur the focused element — otherwise
  // the LayerPanel row that originally received the click keeps its
  // native :focus ring, which reads as a lingering "highlight" after
  // the canvas outline is gone. (Day 2 bug.)
  if (e.key === "Escape") {
    if (useUiStore.getState().selectedLayerId) {
      e.preventDefault();
      useUiStore.getState().setSelectedLayerId(null);
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
    return;
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
