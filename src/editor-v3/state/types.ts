/** Layer schema per docs/spikes/react-pixi-wiring.md. Cycle 1 = rect only. */
export type Layer = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: number; // 0xRRGGBB
  opacity: number; // 0..1
  name: string; // shown in LayerPanel
  hidden: boolean; // visibility toggle (eye icon in LayerPanel)
  locked: boolean; // lock toggle (padlock icon in LayerPanel). Cosmetic
  // for Cycle 1 — tools don't honor `locked` yet.
};
