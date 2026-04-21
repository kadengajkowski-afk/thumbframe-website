// Full-screen pass-through. drei's <ScreenQuad> supplies a 2-triangle
// geometry whose positions already live in NDC [-1, 1], so no projection
// matrix is applied.
const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export default vertexShader;
