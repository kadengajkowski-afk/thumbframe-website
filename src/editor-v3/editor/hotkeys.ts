import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { handleUploadedFile } from "@/lib/uploadFlow";

// Per CLAUDE.md: exactly ONE global keydown listener for the whole editor.
// v1 had four overlapping listeners; that was a steady source of bugs.
// Paste is a separate event type (`paste`), registered alongside so all
// OS-input wiring lives in one file.

let installed = false;

export function installHotkeys() {
  if (installed) return () => {};
  installed = true;
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("paste", handlePaste as EventListener);
  return () => {
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("paste", handlePaste as EventListener);
    installed = false;
  };
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

function handleKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return;

  const meta = e.metaKey || e.ctrlKey;

  // Undo / redo — Cmd+Z, Cmd+Shift+Z. Cmd+Y also redoes on Windows habit.
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
