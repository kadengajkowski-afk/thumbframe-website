import { useEffect, useRef, useState } from "react";
import type { BlendMode } from "@/state/types";

/** Day 17 — full 25-mode picker. Search input narrows the list on
 * every keystroke; arrow keys move the highlight; Enter applies; Esc
 * closes. A "Common" section at the top surfaces the most-reached
 * modes (Normal, Multiply, Screen, Overlay, Add) followed by a
 * session-local "Recent" stack (last 3 chosen, dedup'd against
 * Common) and the full grouped list.
 *
 * Pixi v8 doesn't ship Hue / Darker Color / Lighter Color — see
 * DEFERRED. The 25 here are everything Pixi's advanced-blend-modes
 * actually exposes, in Photoshop's grouping order. */

type Group = { title: string; modes: BlendMode[] };

const COMMON: BlendMode[] = ["normal", "multiply", "screen", "overlay", "add"];

const GROUPS: Group[] = [
  { title: "Normal", modes: ["normal"] },
  { title: "Darken", modes: ["multiply", "darken", "color-burn", "linear-burn"] },
  {
    title: "Lighten",
    modes: ["screen", "lighten", "color-dodge", "linear-dodge", "add"],
  },
  {
    title: "Contrast",
    modes: [
      "overlay",
      "soft-light",
      "hard-light",
      "vivid-light",
      "linear-light",
      "pin-light",
      "hard-mix",
    ],
  },
  {
    title: "Inversion",
    modes: ["difference", "exclusion", "subtract", "divide", "negation"],
  },
  { title: "Component", modes: ["saturation", "color", "luminosity"] },
];

const LABEL: Record<BlendMode, string> = {
  normal: "Normal",
  multiply: "Multiply",
  darken: "Darken",
  "color-burn": "Color Burn",
  "linear-burn": "Linear Burn",
  screen: "Screen",
  lighten: "Lighten",
  "color-dodge": "Color Dodge",
  "linear-dodge": "Linear Dodge",
  add: "Add",
  overlay: "Overlay",
  "soft-light": "Soft Light",
  "hard-light": "Hard Light",
  "vivid-light": "Vivid Light",
  "linear-light": "Linear Light",
  "pin-light": "Pin Light",
  "hard-mix": "Hard Mix",
  difference: "Difference",
  exclusion: "Exclusion",
  subtract: "Subtract",
  divide: "Divide",
  negation: "Negation",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity",
};

/** Module-scope so "Recent" persists across tab switches within a
 * session but resets on reload. Capped at 3 to keep the list tight. */
const recentStack: BlendMode[] = [];
function pushRecent(mode: BlendMode) {
  const idx = recentStack.indexOf(mode);
  if (idx >= 0) recentStack.splice(idx, 1);
  recentStack.unshift(mode);
  if (recentStack.length > 3) recentStack.length = 3;
}
/** Test hook — clears the in-memory recents stack. */
export function _resetBlendRecents() {
  recentStack.length = 0;
}

type Props = {
  value: BlendMode;
  onChange: (next: BlendMode) => void;
};

export function BlendModeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the flat ordered list of modes that the dropdown shows
  // (Common → Recent → grouped). Recomputed every render — recentStack
  // is module-scope so a useMemo on `query` alone would cache stale.
  const sections = buildSections(query);
  const flatModes = sections.flatMap((s) => s.modes);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    // Defer focus so the click that opened the dropdown doesn't blur it.
    queueMicrotask(() => inputRef.current?.focus());
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Window-level Esc so closing works even if focus has drifted off
    // the search input (mouse-hover-then-Esc was a dead chord before).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset highlight to top of list when query changes.
  useEffect(() => setActiveIdx(0), [query]);

  function commit(mode: BlendMode) {
    pushRecent(mode);
    onChange(mode);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flatModes.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const m = flatModes[activeIdx];
      if (m) commit(m);
    }
  }

  return (
    <div ref={rootRef} className="blend-select">
      <button
        type="button"
        className="blend-select__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {LABEL[value]}
        <span className="blend-select__chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="blend-select__menu" role="listbox">
          <input
            ref={inputRef}
            type="text"
            className="blend-select__search"
            placeholder="Search blend modes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            data-testid="blend-search"
          />
          {sections.map((section) => (
            <div key={section.title} className="blend-select__group">
              <div className="blend-select__group-header">{section.title}</div>
              {section.modes.map((m) => {
                const idx = flatModes.indexOf(m);
                const active = idx === activeIdx;
                return (
                  <button
                    key={`${section.title}:${m}`}
                    type="button"
                    role="option"
                    aria-selected={m === value}
                    className={
                      "blend-select__item" +
                      (m === value ? " blend-select__item--active" : "") +
                      (active ? " blend-select__item--hover" : "")
                    }
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => commit(m)}
                  >
                    {LABEL[m]}
                  </button>
                );
              })}
            </div>
          ))}
          {sections.length === 0 && (
            <div className="blend-select__empty">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Build the dropdown's section list, narrowed by `query`. */
function buildSections(query: string): Group[] {
  const q = query.trim().toLowerCase();
  const matches = (m: BlendMode) =>
    !q || m.includes(q) || LABEL[m].toLowerCase().includes(q);

  const sections: Group[] = [];

  const common = COMMON.filter(matches);
  if (common.length > 0) sections.push({ title: "Common", modes: common });

  const recent = recentStack.filter(
    (m) => matches(m) && !COMMON.includes(m),
  );
  if (recent.length > 0) sections.push({ title: "Recent", modes: recent });

  for (const g of GROUPS) {
    const filtered = g.modes.filter(matches);
    if (filtered.length > 0) sections.push({ title: g.title, modes: filtered });
  }
  return sections;
}
