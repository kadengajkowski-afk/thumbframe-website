import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock supabase singleton + signed-in session for the panel render
// tests; the streamChat path is mocked at the wire level.
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

import { CREW, CREW_BY_ID, DEFAULT_CREW_ID, getCrew, isCrewId } from "@/lib/crew";
import { useUiStore } from "@/state/uiStore";

beforeEach(() => {
  useUiStore.setState({
    activeCrewMember: "captain",
    crewIntroDismissed: false,
    thumbfriendPanelOpen: false,
  });
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("thumbframe-crew");
    window.localStorage.removeItem("thumbframe-crew-intro-dismissed");
  }
});

// ── CREW data shape ──────────────────────────────────────────────────────────

describe("Days 41-42 — CREW data", () => {
  it("ships exactly 6 crew members", () => {
    expect(CREW).toHaveLength(6);
  });

  it("default is the Captain", () => {
    expect(DEFAULT_CREW_ID).toBe("captain");
  });

  it("every crew member has the required fields", () => {
    for (const m of CREW) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.role).toBeTruthy();
      expect(m.tagline).toBeTruthy();
      expect(m.useCase).toBeTruthy();
      expect(m.systemPrompt.length).toBeGreaterThan(300);
      // Banned-words guard — every prompt explicitly forbids these.
      for (const banned of ["oops", "sorry", "welcome back", "AI-powered"]) {
        expect(m.systemPrompt).toContain(banned);
      }
      expect(Array.isArray(m.catchphrases)).toBe(true);
      expect(m.catchphrases.length).toBeGreaterThan(0);
    }
  });

  it("CREW_BY_ID covers every member", () => {
    for (const m of CREW) {
      expect(CREW_BY_ID[m.id]).toBe(m);
    }
  });

  it("isCrewId narrows valid ids and rejects unknowns", () => {
    expect(isCrewId("captain")).toBe(true);
    expect(isCrewId("first-mate")).toBe(true);
    expect(isCrewId("nope")).toBe(false);
  });

  it("getCrew falls back to Captain for unknown / null ids", () => {
    expect(getCrew("nope").id).toBe("captain");
    expect(getCrew(null).id).toBe("captain");
    expect(getCrew(undefined).id).toBe("captain");
  });

  it("First Mate prompt explicitly tells the AI to flex specialties", () => {
    const fm = CREW_BY_ID["first-mate"];
    expect(fm.systemPrompt.toLowerCase()).toContain("flex");
    // Mentions every other crew member by archetype.
    expect(fm.systemPrompt).toContain("Captain");
    expect(fm.systemPrompt).toContain("Cook");
    expect(fm.systemPrompt).toContain("Navigator");
    expect(fm.systemPrompt).toContain("Doctor");
    expect(fm.systemPrompt).toContain("Lookout");
  });
});

// ── uiStore: persistence + intro flag ────────────────────────────────────────

describe("Days 41-42 — activeCrewMember persistence", () => {
  it("setActiveCrewMember persists to localStorage and updates store", () => {
    useUiStore.getState().setActiveCrewMember("cook");
    expect(useUiStore.getState().activeCrewMember).toBe("cook");
    expect(window.localStorage.getItem("thumbframe-crew")).toBe("cook");
  });

  it("setCrewIntroDismissed(true) persists '1'", () => {
    useUiStore.getState().setCrewIntroDismissed(true);
    expect(useUiStore.getState().crewIntroDismissed).toBe(true);
    expect(window.localStorage.getItem("thumbframe-crew-intro-dismissed")).toBe("1");
  });
});

// ── aiClient: crewId on the wire ────────────────────────────────────────────

describe("Days 41-42 — streamChat sends crew_id", () => {
  it("body carries crew_id when option passed", async () => {
    let captured: { body?: unknown } = {};
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      captured.body = init?.body;
      // Return a minimal valid SSE stream so the iterator finishes.
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return Promise.resolve(new Response(stream, {
        status: 200, headers: { "Content-Type": "text/event-stream" },
      }));
    });
    const { streamChat } = await import("@/lib/aiClient");
    const it = streamChat({
      messages: [{ role: "user", content: "hi" }],
      intent: "edit",
      crewId: "navigator",
    });
    // Drain
    while (!(await it.next()).done) { /* drain */ }
    const body = JSON.parse(captured.body as string);
    expect(body.crew_id).toBe("navigator");
  });
});

// ── Panel render: crew picker visible + dropdown lists all 6 ────────────────

describe("Days 41-42 — ThumbFriendCrewPicker", () => {
  it("trigger button shows the active crew member's name", async () => {
    useUiStore.setState({ thumbfriendPanelOpen: true, activeCrewMember: "doctor" });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ThumbFriendPanel } = await import("@/editor/panels/ThumbFriendPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ThumbFriendPanel)));

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="thumbfriend-crew-trigger"]')!;
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain("The Doctor");

    act(() => root.unmount());
    container.remove();
  });

  it("clicking trigger shows all 6 crew cards; clicking a card switches store", async () => {
    useUiStore.setState({ thumbfriendPanelOpen: true, activeCrewMember: "captain" });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ThumbFriendPanel } = await import("@/editor/panels/ThumbFriendPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ThumbFriendPanel)));

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="thumbfriend-crew-trigger"]')!;
    act(() => trigger.click());

    const cards = container.querySelectorAll('[data-testid^="thumbfriend-crew-"]');
    // 1 trigger + 1 dropdown wrapper + 6 cards = 8 with the prefix, but
    // we want exactly the 6 cards. They have data-testid="thumbfriend-crew-<id>"
    const cardIds = Array.from(cards)
      .map((el) => el.getAttribute("data-testid"))
      .filter((t): t is string => !!t && /^thumbfriend-crew-(captain|first-mate|cook|navigator|doctor|lookout)$/.test(t));
    expect(cardIds.length).toBe(6);

    const cookCard = container.querySelector<HTMLButtonElement>('[data-testid="thumbfriend-crew-cook"]')!;
    act(() => cookCard.click());
    expect(useUiStore.getState().activeCrewMember).toBe("cook");
    // Dropdown closes after pick
    expect(container.querySelector('[data-testid="thumbfriend-crew-dropdown"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it("first-run intro card shows when crewIntroDismissed=false; dismiss persists", async () => {
    useUiStore.setState({
      thumbfriendPanelOpen: true,
      crewIntroDismissed: false,
      activeCrewMember: "captain",
    });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ThumbFriendPanel } = await import("@/editor/panels/ThumbFriendPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ThumbFriendPanel)));

    const intro = container.querySelector('[data-testid="thumbfriend-crew-intro"]');
    expect(intro).not.toBeNull();

    const dismiss = container.querySelector<HTMLButtonElement>('[data-testid="thumbfriend-crew-intro-dismiss"]')!;
    act(() => dismiss.click());
    expect(useUiStore.getState().crewIntroDismissed).toBe(true);
    expect(container.querySelector('[data-testid="thumbfriend-crew-intro"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
