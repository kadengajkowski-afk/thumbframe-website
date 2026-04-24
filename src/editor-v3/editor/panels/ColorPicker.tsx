import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { HexColorPicker } from "react-colorful";
import {
  hexToPixi,
  hexToRgb,
  isHex,
  normalizeHex,
  pixiToHex,
  rgbToHex,
  type Rgb,
} from "@/lib/color";
import { useUiStore } from "@/state/uiStore";
import "./color-picker.css";

/** Brand-safe presets per spec. Sailship orange, cream, navy, pure
 * black, pure white, YouTube red. */
const PRESETS: string[] = [
  "#F97316",
  "#F9F0E1",
  "#1B2430",
  "#000000",
  "#FFFFFF",
  "#FF0033",
];

type Props = {
  color: number; // 0xRRGGBB
  alpha: number; // 0..1
  onColorChange: (next: number) => void;
  onAlphaChange: (next: number) => void;
};

export function ColorPicker({
  color,
  alpha,
  onColorChange,
  onAlphaChange,
}: Props) {
  const hex = pixiToHex(color);
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const recentColors = useUiStore((s) => s.recentColors);

  const pick = (next: string) => {
    const n = normalizeHex(next);
    if (n) onColorChange(hexToPixi(n));
  };

  return (
    <div className="color-picker" onMouseDown={(e) => e.stopPropagation()}>
      <HexColorPicker color={hex} onChange={pick} />

      <div className="color-picker__row color-picker__row--hex">
        <HexField value={hex} onCommit={pick} />
        <EyedropperButton onPick={pick} />
      </div>

      <div className="color-picker__row color-picker__row--rgb">
        <RgbField label="R" value={rgb.r} onCommit={(v) => pick(rgbToHex({ ...rgb, r: v }))} />
        <RgbField label="G" value={rgb.g} onCommit={(v) => pick(rgbToHex({ ...rgb, g: v }))} />
        <RgbField label="B" value={rgb.b} onCommit={(v) => pick(rgbToHex({ ...rgb, b: v }))} />
        <AlphaField value={alpha} onCommit={onAlphaChange} />
      </div>

      {recentColors.length > 0 && (
        <SwatchRow
          label="Recent"
          colors={recentColors}
          onPick={pick}
          current={hex}
        />
      )}
      <SwatchRow label="Presets" colors={PRESETS} onPick={pick} current={hex} />
    </div>
  );
}

// ── subfields ────────────────────────────────────────────────────────

function HexField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (hex: string) => void;
}) {
  const [text, setText] = useState(value.slice(1));
  useEffect(() => setText(value.slice(1)), [value]);

  const tryCommit = () => {
    if (isHex(text)) onCommit(text);
    else setText(value.slice(1));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryCommit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setText(value.slice(1));
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <label className="color-picker__hex">
      <span className="color-picker__hash">#</span>
      <input
        className="color-picker__hex-input"
        value={text}
        maxLength={8}
        onChange={(e) => setText(e.target.value.replace(/[^0-9a-fA-F]/g, ""))}
        onBlur={tryCommit}
        onKeyDown={onKey}
        spellCheck={false}
        aria-label="Hex color"
      />
    </label>
  );
}

function RgbField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const tryCommit = () => {
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n)) {
      const c = Math.max(0, Math.min(255, n));
      onCommit(c);
      setText(String(c));
    } else setText(String(value));
  };

  return (
    <label className="color-picker__channel">
      <span className="color-picker__channel-label">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setText(e.target.value.replace(/[^0-9]/g, ""))
        }
        onBlur={tryCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            tryCommit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`${label} channel`}
      />
    </label>
  );
}

function AlphaField({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (next: number) => void;
}) {
  const pct = Math.round(value * 100);
  const [text, setText] = useState(String(pct));
  useEffect(() => setText(String(pct)), [pct]);

  const tryCommit = () => {
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n)) {
      const c = Math.max(0, Math.min(100, n));
      onCommit(c / 100);
      setText(String(c));
    } else setText(String(pct));
  };

  return (
    <label className="color-picker__channel">
      <span className="color-picker__channel-label">A</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setText(e.target.value.replace(/[^0-9]/g, ""))
        }
        onBlur={tryCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            tryCommit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Alpha percent"
      />
    </label>
  );
}

function EyedropperButton({ onPick }: { onPick: (hex: string) => void }) {
  const available = typeof window !== "undefined" && "EyeDropper" in window;
  if (!available) return null;
  return (
    <button
      type="button"
      className="color-picker__eyedropper"
      aria-label="Pick color from screen"
      title="Eyedropper"
      onClick={async () => {
        try {
          const Dropper = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
          const dropper = new Dropper();
          const res = await dropper.open();
          onPick(res.sRGBHex);
        } catch {
          /* user cancelled */
        }
      }}
    >
      ◎
    </button>
  );
}

function SwatchRow({
  label,
  colors,
  onPick,
  current,
}: {
  label: string;
  colors: string[];
  onPick: (hex: string) => void;
  current: string;
}) {
  return (
    <div className="color-picker__swatches">
      <div className="color-picker__swatches-label">{label}</div>
      <div className="color-picker__swatches-row">
        {colors.map((c, i) => {
          const active = normalizeHex(c) === current;
          return (
            <button
              key={`${c}-${i}`}
              type="button"
              className={
                "color-picker__swatch" +
                (active ? " color-picker__swatch--active" : "")
              }
              style={{ background: c }}
              onClick={() => onPick(c)}
              aria-label={`Pick ${c}`}
              title={c}
            />
          );
        })}
      </div>
    </div>
  );
}

type Props_ = Props;
export type ColorPickerProps = Props_;
export type { Rgb };
