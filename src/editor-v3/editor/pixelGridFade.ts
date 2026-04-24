import type { Graphics } from "pixi.js";

/** Smoothly transitions a Graphics alpha to `target` over `ms`. Uses a
 * monotonic token to cancel in-flight animations when a newer one
 * starts (e.g. user ratchets zoom across the grid threshold quickly). */

let token = 0;

export function fadeAlphaTo(node: Graphics, target: number, ms: number): void {
  if (node.alpha === target) return;
  const from = node.alpha;
  const mine = ++token;
  const start = performance.now();
  const step = () => {
    if (mine !== token) return;
    const t = Math.min(1, (performance.now() - start) / ms);
    node.alpha = from + (target - from) * t;
    if (t < 1) requestAnimationFrame(step);
    else node.alpha = target;
  };
  requestAnimationFrame(step);
}
