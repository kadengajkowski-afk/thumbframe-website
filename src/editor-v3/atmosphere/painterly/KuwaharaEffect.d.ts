import { Effect } from "postprocessing";

export class KuwaharaEffect extends Effect {
  constructor(opts?: { kernelNear?: number; kernelFar?: number });
  setSize(width: number, height: number): void;
}
