import { history } from "@/lib/history";
import { runCommand } from "@/lib/commands";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { toast } from "@/toasts/toastStore";
import { getCurrentCompositor } from "@/editor/compositorRef";

/** Day 64c — Photopea-style top menu bar data.
 *
 * Each menu lists items in display order. Items are either action
 * rows (label + optional hotkey + onSelect) or dividers. onSelect
 * either calls into the existing command registry / history / store,
 * or falls back to a `comingSoon` toast for items we haven't built
 * yet (per spec — never remove the menu item, just stub click).
 *
 * The hotkey strings here are DISPLAY-ONLY. The actual hotkeys live
 * in editor/hotkeys.ts and lib/commands.ts. When the labels diverge
 * (e.g. spec calls Deselect "Cmd+D" while existing duplicate is
 * Cmd+D), we follow the spec for the menu label and the click
 * handler does the spec'd action — physical Cmd+D still does its
 * existing thing. */

export type MenuItem =
  | { kind: "item"; label: string; hotkey?: string; onSelect: () => void; disabled?: boolean }
  | { kind: "divider" };

export type Menu = {
  id: string;
  label: string;
  items: MenuItem[];
};

function comingSoon(name: string) {
  toast(`${name} — coming soon`);
}

function selectAll() {
  const ids = useDocStore.getState().layers.map((l) => l.id);
  useUiStore.getState().setSelectedLayerIds(ids);
}

function deselectAll() {
  useUiStore.getState().setSelectedLayerIds([]);
}

function deleteSelected() {
  const ids = useUiStore.getState().selectedLayerIds;
  if (ids.length === 0) return;
  history.deleteLayers(ids);
}

function duplicateSelected() {
  const ids = useUiStore.getState().selectedLayerIds;
  if (ids.length === 0) return;
  void history.duplicateLayers(ids);
}

function bringToFront() {
  runCommand("layer.bring-to-front");
}

function sendToBack() {
  runCommand("layer.send-to-back");
}

function focusBgRemove() {
  // Mirror the lib/commands.ts ai.bg-remove-focus run path: requires
  // an image layer to be selected.
  const sel = useUiStore.getState().selectedLayerIds;
  const layers = useDocStore.getState().layers;
  const target = layers.find((l) => sel.includes(l.id) && l.type === "image");
  if (!target) {
    toast("Select an image layer first to remove its background");
    return;
  }
  useUiStore.getState().setSelectedLayerIds([target.id]);
  toast("Background remove — use the right-side controls when image selected");
}

function toggleSmartGuides() {
  runCommand("toggle.smart-guides");
}

export const MENUS: Menu[] = [
  {
    id: "file",
    label: "File",
    items: [
      { kind: "item", label: "New project", hotkey: "Cmd+N", onSelect: () => runCommand("file.new") },
      { kind: "item", label: "Open project…", hotkey: "Cmd+O", onSelect: () => runCommand("file.open-projects") },
      { kind: "divider" },
      { kind: "item", label: "Save", hotkey: "Cmd+S", onSelect: () => runCommand("file.save") },
      { kind: "item", label: "Save as…", hotkey: "Cmd+Shift+S", onSelect: () => comingSoon("Save as") },
      { kind: "divider" },
      { kind: "item", label: "Export thumbnail", hotkey: "Cmd+E", onSelect: () => runCommand("file.export") },
      { kind: "item", label: "Ship it", hotkey: "Cmd+Shift+E", onSelect: () => runCommand("file.export-last") },
      { kind: "divider" },
      { kind: "item", label: "Project settings…", onSelect: () => comingSoon("Project settings") },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { kind: "item", label: "Undo", hotkey: "Cmd+Z", onSelect: () => history.undo() },
      { kind: "item", label: "Redo", hotkey: "Cmd+Shift+Z", onSelect: () => history.redo() },
      { kind: "divider" },
      { kind: "item", label: "Cut", hotkey: "Cmd+X", onSelect: () => comingSoon("Cut") },
      { kind: "item", label: "Copy", hotkey: "Cmd+C", onSelect: () => comingSoon("Copy") },
      { kind: "item", label: "Paste", hotkey: "Cmd+V", onSelect: () => comingSoon("Paste") },
      { kind: "divider" },
      { kind: "item", label: "Select all", hotkey: "Cmd+A", onSelect: selectAll },
      { kind: "item", label: "Deselect", hotkey: "Cmd+D", onSelect: deselectAll },
    ],
  },
  {
    id: "image",
    label: "Image",
    items: [
      { kind: "item", label: "Image size…", onSelect: () => comingSoon("Image size") },
      { kind: "item", label: "Canvas size…", onSelect: () => comingSoon("Canvas size") },
      { kind: "divider" },
      { kind: "item", label: "Rotate 90° CW", onSelect: () => comingSoon("Rotate CW") },
      { kind: "item", label: "Rotate 90° CCW", onSelect: () => comingSoon("Rotate CCW") },
      { kind: "item", label: "Flip horizontal", onSelect: () => comingSoon("Flip horizontal") },
      { kind: "item", label: "Flip vertical", onSelect: () => comingSoon("Flip vertical") },
    ],
  },
  {
    id: "layer",
    label: "Layer",
    items: [
      { kind: "item", label: "New layer", hotkey: "Cmd+Shift+N", onSelect: () => runCommand("layer.add-rect") },
      { kind: "item", label: "Duplicate layer", hotkey: "Cmd+J", onSelect: duplicateSelected },
      { kind: "item", label: "Delete layer", hotkey: "Delete", onSelect: deleteSelected },
      { kind: "divider" },
      { kind: "item", label: "Group layers", hotkey: "Cmd+G", onSelect: () => comingSoon("Group layers") },
      { kind: "item", label: "Ungroup", hotkey: "Cmd+Shift+G", onSelect: () => comingSoon("Ungroup") },
      { kind: "divider" },
      { kind: "item", label: "Bring to front", hotkey: "Cmd+]", onSelect: bringToFront },
      { kind: "item", label: "Send to back", hotkey: "Cmd+[", onSelect: sendToBack },
    ],
  },
  {
    id: "effects",
    label: "Effects",
    items: [
      { kind: "item", label: "Drop shadow…", onSelect: () => comingSoon("Drop shadow") },
      { kind: "item", label: "Outer glow…", onSelect: () => comingSoon("Outer glow") },
      { kind: "item", label: "Inner glow…", onSelect: () => comingSoon("Inner glow") },
      { kind: "divider" },
      { kind: "item", label: "Stroke…", onSelect: () => comingSoon("Stroke") },
      { kind: "divider" },
      { kind: "item", label: "Clear effects", onSelect: () => comingSoon("Clear effects") },
    ],
  },
  {
    id: "filter",
    label: "Filter",
    items: [
      { kind: "item", label: "Background remove", onSelect: focusBgRemove },
      { kind: "item", label: "Generate image…", onSelect: () => runCommand("file.image-gen") },
      { kind: "divider" },
      { kind: "item", label: "Color grade…", onSelect: () => comingSoon("Color grade") },
      { kind: "item", label: "Sharpen", onSelect: () => comingSoon("Sharpen") },
      { kind: "item", label: "Blur", onSelect: () => comingSoon("Blur") },
    ],
  },
  {
    id: "brand",
    label: "Brand Kit",
    items: [
      { kind: "item", label: "Open brand kit…", onSelect: () => runCommand("file.brand-kit") },
      { kind: "item", label: "Apply brand kit", onSelect: () => comingSoon("Apply brand kit") },
      { kind: "divider" },
      { kind: "item", label: "Extract from URL…", onSelect: () => comingSoon("Extract from URL") },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      { kind: "item", label: "Zoom in", hotkey: "Cmd+=", onSelect: () => getCurrentCompositor()?.zoomBy(1.2) },
      { kind: "item", label: "Zoom out", hotkey: "Cmd+-", onSelect: () => getCurrentCompositor()?.zoomBy(1 / 1.2) },
      { kind: "item", label: "Fit to screen", hotkey: "Cmd+0", onSelect: () => getCurrentCompositor()?.fit(true) },
      { kind: "item", label: "100%", hotkey: "Cmd+1", onSelect: () => getCurrentCompositor()?.setZoomPercent(100, true) },
      { kind: "divider" },
      { kind: "item", label: "Show grid", hotkey: "Cmd+'", onSelect: () => comingSoon("Show grid") },
      { kind: "item", label: "Show rulers", hotkey: "Cmd+R", onSelect: () => comingSoon("Show rulers") },
      { kind: "item", label: "Show smart guides", onSelect: toggleSmartGuides },
    ],
  },
  {
    id: "help",
    label: "Help",
    items: [
      { kind: "item", label: "Keyboard shortcuts", hotkey: "Cmd+?", onSelect: () => runCommand("help.shortcuts") },
      { kind: "item", label: "Documentation", onSelect: () => comingSoon("Documentation") },
      { kind: "item", label: "Support…", onSelect: () => runCommand("help.open") },
      { kind: "divider" },
      { kind: "item", label: "About ThumbFrame", onSelect: () => comingSoon("About ThumbFrame") },
    ],
  },
];
