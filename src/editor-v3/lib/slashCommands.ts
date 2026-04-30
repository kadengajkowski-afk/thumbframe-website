import { history } from "./history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { hexToPixi, normalizeHex } from "./color";
import type { TextAlign } from "@/state/types";

/** Day 39 — client-side slash commands for ThumbFriend Ask mode.
 *
 * Typed `/cmd args` runs locally without an AI round-trip. Falls
 * through to the AI when the slash isn't a registered command, or
 * when the command needs context the user didn't provide (e.g.
 * `/color` with no selected layer). The fallthrough lets users
 * keep typing slash-y phrasing without the panel grading them. */

export type SlashSpec = {
  id: string;
  label: string;
  /** Pretty-printed syntax shown in the autocomplete list. */
  syntax: string;
  /** Short hint shown next to the syntax. */
  hint: string;
};

export const SLASH_COMMANDS: SlashSpec[] = [
  { id: "color",  label: "/color",  syntax: "/color <hex>",         hint: "Change selected layer fill" },
  { id: "text",   label: "/text",   syntax: "/text <prompt>",       hint: "Generate a title suggestion" },
  { id: "shadow", label: "/shadow", syntax: "/shadow",              hint: "Add drop shadow to selected text" },
  { id: "center", label: "/center", syntax: "/center",              hint: "Center selected layer on canvas" },
  { id: "align",  label: "/align",  syntax: "/align left|center|right", hint: "Text alignment" },
  { id: "font",   label: "/font",   syntax: "/font <name>",         hint: "Change selected text font" },
];

export type SlashOutcome =
  /** Command ran locally; nothing more to do. */
  | { kind: "handled"; message: string }
  /** Command was recognized but couldn't run; surface a hint AND
   * forward the original prompt to the AI as a fallback. */
  | { kind: "fallback"; message: string }
  /** No slash match at all — caller should send to AI as a normal
   * message. */
  | { kind: "miss" };

const CANVAS_W = 1280;
const CANVAS_H = 720;

/** Try to run a slash command. Returns `miss` if `text` doesn't
 * start with `/<known>`. */
export function tryRunSlash(text: string): SlashOutcome {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return { kind: "miss" };

  const space = trimmed.indexOf(" ");
  const cmd = (space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)).toLowerCase();
  const args = space === -1 ? "" : trimmed.slice(space + 1).trim();

  const known = SLASH_COMMANDS.some((c) => c.id === cmd);
  if (!known) return { kind: "miss" };

  const selected = primarySelection();

  switch (cmd) {
    case "color":   return runColor(args, selected);
    case "shadow":  return runShadow(selected);
    case "center":  return runCenter(selected);
    case "align":   return runAlign(args, selected);
    case "font":    return runFont(args, selected);
    case "text":    return { kind: "fallback", message: "Asking the AI for a title…" };
    default:        return { kind: "miss" };
  }
}

function primarySelection() {
  const ids = useUiStore.getState().selectedLayerIds;
  const id = ids[0] ?? null;
  if (!id) return null;
  const layer = useDocStore.getState().layers.find((l) => l.id === id);
  return layer ?? null;
}

function runColor(args: string, selected: ReturnType<typeof primarySelection>): SlashOutcome {
  const hex = normalizeHex(args);
  if (!hex) return { kind: "fallback", message: "Couldn't parse hex color — passing to AI." };
  const pixi = hexToPixi(hex);
  if (pixi === null) return { kind: "fallback", message: "Bad color — passing to AI." };
  if (!selected) {
    useUiStore.getState().setLastFillColor(hex);
    return { kind: "handled", message: `Saved ${hex} as the next fill color.` };
  }
  if (selected.type === "rect" || selected.type === "ellipse" || selected.type === "text") {
    // setLayerFillColor handles all three layer types — see history.ts.
    history.setLayerFillColor(selected.id, pixi);
    return { kind: "handled", message: `Set ${selected.name} to ${hex}.` };
  }
  return { kind: "fallback", message: "That layer doesn't take a fill color — passing to AI." };
}

function runShadow(selected: ReturnType<typeof primarySelection>): SlashOutcome {
  if (!selected) return { kind: "fallback", message: "Select a text layer first — or describe what you want." };
  if (selected.type !== "text") return { kind: "fallback", message: "Drop shadow is text-only today." };
  history.setShadowEnabled(selected.id, true);
  history.setShadowColor(selected.id, 0x000000);
  history.setShadowAlpha(selected.id, 0.6);
  history.setShadowBlur(selected.id, 6);
  history.setShadowOffset(selected.id, 2, 2);
  return { kind: "handled", message: `Added drop shadow to ${selected.name}.` };
}

function runCenter(selected: ReturnType<typeof primarySelection>): SlashOutcome {
  if (!selected) return { kind: "fallback", message: "Select a layer to center first." };
  const x = Math.round((CANVAS_W - selected.width) / 2);
  const y = Math.round((CANVAS_H - selected.height) / 2);
  history.moveLayer(selected.id, x, y);
  return { kind: "handled", message: `Centered ${selected.name}.` };
}

function runAlign(args: string, selected: ReturnType<typeof primarySelection>): SlashOutcome {
  const value = args.toLowerCase();
  if (value !== "left" && value !== "center" && value !== "right") {
    return { kind: "fallback", message: "Use /align left, /align center, or /align right." };
  }
  if (!selected || selected.type !== "text") {
    return { kind: "fallback", message: "Select a text layer to align." };
  }
  history.setTextAlign(selected.id, value as TextAlign);
  return { kind: "handled", message: `Aligned ${selected.name} ${value}.` };
}

function runFont(args: string, selected: ReturnType<typeof primarySelection>): SlashOutcome {
  const name = args.trim();
  if (!name) return { kind: "fallback", message: "Tell me a font name (e.g. /font Anton)." };
  if (!selected || selected.type !== "text") {
    useUiStore.getState().setLastFontFamily(name);
    return { kind: "handled", message: `Saved ${name} as the next text font.` };
  }
  history.setFontFamily(selected.id, name);
  return { kind: "handled", message: `Set ${selected.name} to ${name}.` };
}

/** Filter for the autocomplete dropdown when the user has typed
 * `/<partial>`. Returns matches ordered by prefix-first, then
 * substring. */
export function suggestSlash(partial: string): SlashSpec[] {
  const q = partial.replace(/^\//, "").toLowerCase();
  if (!q) return SLASH_COMMANDS;
  const prefix = SLASH_COMMANDS.filter((c) => c.id.startsWith(q));
  const substring = SLASH_COMMANDS.filter(
    (c) => !c.id.startsWith(q) && c.id.includes(q),
  );
  return [...prefix, ...substring];
}
