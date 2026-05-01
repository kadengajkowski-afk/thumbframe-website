import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock supabase: signed-in session, profiles RLS read returns nothing
// (we don't exercise tier resolution in this file). Auth getSession
// returns FAKE token so the chat client doesn't bail with AUTH_REQUIRED
// before fetch runs.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: "FAKE" } }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          gte: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
  isSupabaseConfigured: () => true,
}));

import { tryRunSlash, suggestSlash, SLASH_COMMANDS } from "@/lib/slashCommands";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { runCommand } from "@/lib/commands";
import { hexToPixi } from "@/lib/color";
import { nanoid } from "nanoid";
import type { Layer } from "@/state/types";

function makeRect(id: string, color = 0xff0000): Layer {
  return {
    id, type: "rect",
    x: 100, y: 100, width: 200, height: 100,
    color, opacity: 1,
    name: `rect-${id}`,
    hidden: false, locked: false,
    blendMode: "normal",
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

function makeText(id: string): Layer {
  // Full TextLayer shape — matches state/types.ts. Cast through unknown
  // because vitest's transformer is more lenient than tsc on union
  // assignment, but we want strict type-checking via npm run build.
  return {
    id, type: "text",
    x: 100, y: 100, width: 200, height: 60,
    color: 0xffffff, opacity: 1,
    name: `text-${id}`,
    hidden: false, locked: false,
    blendMode: "normal",
    text: "Hello",
    fontFamily: "Inter",
    fontSize: 48, fontWeight: 700, fontStyle: "normal",
    align: "left",
    lineHeight: 1.2, letterSpacing: 0,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
    strokes: [], strokesEnabled: true,
    shadowEnabled: false, shadowColor: 0, shadowAlpha: 0.5,
    shadowBlur: 4, shadowOffsetX: 0, shadowOffsetY: 0,
    glowEnabled: false, glowColor: 0xffffff, glowAlpha: 0.5, glowBlur: 6,
  } as unknown as Layer;
}

beforeEach(() => {
  history._reset();
  useUiStore.setState({
    selectedLayerIds: [],
    thumbfriendPanelOpen: false,
    upgradePanelOpen: false,
    authPanelOpen: false,
    userTier: "free",
    user: null,
  });
});

// ── slashCommands: parser ─────────────────────────────────────────────────────

describe("Day 39 — slash command parser", () => {
  it("non-slash text returns miss", () => {
    expect(tryRunSlash("hello there").kind).toBe("miss");
  });

  it("unknown slash returns miss (falls through to AI)", () => {
    expect(tryRunSlash("/nonsense foo").kind).toBe("miss");
  });

  it("/center with no selection falls back", () => {
    expect(tryRunSlash("/center").kind).toBe("fallback");
  });

  it("/center moves a selected rect to canvas center", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    useUiStore.getState().setSelectedLayerIds([id]);
    const out = tryRunSlash("/center");
    expect(out.kind).toBe("handled");
    const stored = useDocStore.getState().layers[0]!;
    // 1280×720 canvas, 200×100 rect → x=540, y=310
    expect(stored.x).toBe(540);
    expect(stored.y).toBe(310);
  });

  it("/color with hex sets a rect's fill", () => {
    const id = nanoid();
    history.addLayer(makeRect(id, 0xff0000));
    useUiStore.getState().setSelectedLayerIds([id]);
    const out = tryRunSlash("/color #00ff00");
    expect(out.kind).toBe("handled");
    const stored = useDocStore.getState().layers[0] as Layer & { color: number };
    expect(stored.color).toBe(hexToPixi("#00ff00"));
  });

  it("/color with no selection saves as lastFillColor", () => {
    const out = tryRunSlash("/color #abcdef");
    expect(out.kind).toBe("handled");
    // normalizeHex canonicalizes to uppercase.
    expect(useUiStore.getState().lastFillColor.toLowerCase()).toBe("#abcdef");
  });

  it("/color with bad hex falls back", () => {
    expect(tryRunSlash("/color rainbow").kind).toBe("fallback");
  });

  it("/align left works on a text layer", () => {
    const id = nanoid();
    history.addLayer(makeText(id));
    useUiStore.getState().setSelectedLayerIds([id]);
    const out = tryRunSlash("/align center");
    expect(out.kind).toBe("handled");
    const stored = useDocStore.getState().layers[0] as Layer & { align: string };
    expect(stored.align).toBe("center");
  });

  it("/align garbage falls back", () => {
    const id = nanoid();
    history.addLayer(makeText(id));
    useUiStore.getState().setSelectedLayerIds([id]);
    expect(tryRunSlash("/align sideways").kind).toBe("fallback");
  });

  it("/shadow turns on drop shadow on a text layer", () => {
    const id = nanoid();
    history.addLayer(makeText(id));
    useUiStore.getState().setSelectedLayerIds([id]);
    const out = tryRunSlash("/shadow");
    expect(out.kind).toBe("handled");
    const stored = useDocStore.getState().layers[0] as Layer & { shadowEnabled: boolean };
    expect(stored.shadowEnabled).toBe(true);
  });

  it("/shadow on a rect falls back (text-only)", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    useUiStore.getState().setSelectedLayerIds([id]);
    expect(tryRunSlash("/shadow").kind).toBe("fallback");
  });

  it("/font without selected text saves as lastFontFamily", () => {
    const out = tryRunSlash("/font Anton");
    expect(out.kind).toBe("handled");
    expect(useUiStore.getState().lastFontFamily).toBe("Anton");
  });

  it("/text always falls back to AI (no client-side handler)", () => {
    expect(tryRunSlash("/text suggest a thumbnail title").kind).toBe("fallback");
  });
});

// ── slashCommands: autocomplete ───────────────────────────────────────────────

describe("Day 39 — suggestSlash autocomplete", () => {
  it("empty query returns all commands", () => {
    expect(suggestSlash("/").length).toBe(SLASH_COMMANDS.length);
  });

  it("'/c' returns color + center first (prefix match)", () => {
    const matches = suggestSlash("/c").map((s) => s.id);
    expect(matches.slice(0, 2).sort()).toEqual(["center", "color"]);
  });

  it("'/al' filters to align", () => {
    const matches = suggestSlash("/al").map((s) => s.id);
    expect(matches[0]).toBe("align");
  });
});

// ── uiStore + Cmd+/ command ───────────────────────────────────────────────────

describe("Day 39 — view.thumbfriend command toggles uiStore", () => {
  it("running view.thumbfriend toggles open → closed", () => {
    expect(useUiStore.getState().thumbfriendPanelOpen).toBe(false);
    runCommand("view.thumbfriend");
    expect(useUiStore.getState().thumbfriendPanelOpen).toBe(true);
    runCommand("view.thumbfriend");
    expect(useUiStore.getState().thumbfriendPanelOpen).toBe(false);
  });
});

// ── ThumbFriendPanel render ───────────────────────────────────────────────────

describe("Day 39 — ThumbFriendPanel renders", () => {
  it("renders Ask tab content + suggestion chips when no messages", async () => {
    useUiStore.setState({ thumbfriendPanelOpen: true });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ThumbFriendPanel } = await import("@/editor/panels/ThumbFriendPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ThumbFriendPanel)));

    expect(container.querySelector('[data-testid="thumbfriend-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="thumbfriend-tab-ask"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="thumbfriend-empty"]')).not.toBeNull();
    // 5 suggestion chips
    expect(container.querySelectorAll('[data-testid^="thumbfriend-chip-"]').length).toBe(5);

    act(() => root.unmount());
    container.remove();
  });

  it("Nudge tab renders the Day 44 NudgeMode (replaces the prior stub)", async () => {
    useUiStore.setState({ thumbfriendPanelOpen: true });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ThumbFriendPanel } = await import("@/editor/panels/ThumbFriendPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ThumbFriendPanel)));
    const nudgeBtn = container.querySelector<HTMLButtonElement>('[data-testid="thumbfriend-tab-nudge"]')!;
    act(() => nudgeBtn.click());
    // Day 44 — Nudge tab now shows the real NudgeMode component, not
    // a Coming-soon stub. Verify the mount + status indicator render.
    expect(container.querySelector('[data-testid="thumbfriend-nudge-mode"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="thumbfriend-nudge-status"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="thumbfriend-stub-nudge"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it("submitting a /center slash command appends a synthetic exchange", async () => {
    useUiStore.setState({ thumbfriendPanelOpen: true });
    const id = nanoid();
    history.addLayer(makeRect(id));
    useUiStore.getState().setSelectedLayerIds([id]);

    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ThumbFriendPanel } = await import("@/editor/panels/ThumbFriendPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ThumbFriendPanel)));

    const ta = container.querySelector<HTMLTextAreaElement>('[data-testid="thumbfriend-input"]')!;
    const send = container.querySelector<HTMLButtonElement>('[data-testid="thumbfriend-send"]')!;
    // React's controlled-input setter must be called via the prototype
    // descriptor so React's synthetic onChange picks up the value.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, "value",
    )!.set!;
    act(() => {
      setter.call(ta, "/center");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => send.click());

    // After the slash runs, the layer is centered AND the bubbles render.
    const layer = useDocStore.getState().layers[0]!;
    expect(layer.x).toBe(540);
    expect(layer.y).toBe(310);
    expect(container.querySelectorAll('[data-testid="thumbfriend-msg-user"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="thumbfriend-msg-assistant"]').length).toBe(1);

    act(() => root.unmount());
    container.remove();
  });
});
