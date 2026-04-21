// Aurora lives on its own three.js layer so the EffectComposer's
// RenderPass (which runs against the camera's active layer mask) doesn't
// see it, and the painterly Kuwahara/Outline/Grain pipeline never
// touches it. The AuroraOverlay renderer flips camera.layers to this
// value AFTER the composer finishes, draws the aurora mesh, then flips
// back.
export const AURORA_LAYER = 1;
