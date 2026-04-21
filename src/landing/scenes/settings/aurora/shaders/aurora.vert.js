// Full-screen pass-through. drei's <ScreenQuad> supplies a 2-triangle
// geometry whose positions already live in NDC [-1, 1], so no projection
// matrix is applied.
// drei's <ScreenQuad> geometry only exposes a 2-D `position` attribute
// (3-vertex big-triangle covering NDC). No `uv` attribute is written,
// so reading it in the shader returns garbage/zero. Compute vUv from
// position instead: NDC [-1, +1] maps to UV [0, 1].
const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export default vertexShader;
