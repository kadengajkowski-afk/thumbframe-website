import { type ComponentType } from "react";

export type NebulaPalette = {
  core: string;
  mid: string;
  highlight: string;
  accent: string;
};

export type NebulaProps = {
  radius?: number;
  palette?: NebulaPalette;
  animate?: boolean;
  cycle?: boolean;
  driftSpeed?: number;
};

declare const Nebula: ComponentType<NebulaProps>;
export default Nebula;

export const NEBULA_PALETTES: Record<"purple" | "teal" | "fire", NebulaPalette>;
