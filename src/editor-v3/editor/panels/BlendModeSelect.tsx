import { useEffect, useRef, useState } from "react";
import type { BlendMode } from "@/state/types";

/**
 * Custom dropdown for picking a layer's blend mode. Native <select>
 * with <optgroup> renders with OS-default look — this matches the
 * Observatory aesthetic and stays under our control.
 *
 * 12 modes today in five groups. The rest of PIXI v8's 27 land in
 * Cycle 2 Day 17 (tracked in DEFERRED).
 */

type Group = { title: string; modes: BlendMode[] };

const GROUPS: Group[] = [
  { title: "Normal", modes: ["normal"] },
  { title: "Darken", modes: ["darken", "multiply", "color-burn"] },
  { title: "Lighten", modes: ["lighten", "screen", "color-dodge", "add"] },
  { title: "Contrast", modes: ["overlay", "soft-light", "hard-light"] },
  { title: "Inversion", modes: ["difference"] },
];

const LABEL: Record<BlendMode, string> = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  "soft-light": "Soft Light",
  "hard-light": "Hard Light",
  darken: "Darken",
  lighten: "Lighten",
  difference: "Difference",
  "color-dodge": "Color Dodge",
  "color-burn": "Color Burn",
  add: "Add",
};

type Props = {
  value: BlendMode;
  onChange: (next: BlendMode) => void;
};

export function BlendModeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

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
        <span className="blend-select__chev" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="blend-select__menu" role="listbox">
          {GROUPS.map((group) => (
            <div key={group.title} className="blend-select__group">
              <div className="blend-select__group-header">{group.title}</div>
              {group.modes.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={m === value}
                  className={
                    "blend-select__item" +
                    (m === value ? " blend-select__item--active" : "")
                  }
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                >
                  {LABEL[m]}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
