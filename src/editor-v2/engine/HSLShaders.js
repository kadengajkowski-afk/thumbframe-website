// src/editor-v2/engine/HSLShaders.js
// -----------------------------------------------------------------------------
// Purpose:  Fragment-shader sources for the HSL blend quartet — hue,
//           saturation, color, luminosity. WebGL has no built-in
//           equation for these (unlike multiply/screen/darken etc.
//           which are GL_CONSTANT_ALPHA tricks), so each gets a real
//           compositing shader that samples the destination, blends in
//           HSL space, and returns the final RGBA.
//
// Exports:  HSL_FRAGMENT_SHADERS, buildHSLFilter, HSL_VERTEX_SHADER
// Depends:  nothing at runtime (pixi.js consumed lazily by
//           buildHSLFilter so unit tests can import without dragging
//           pixi into the jsdom module graph).
//
// Why a quartet and not one shader? The RGB↔HSL conversion is shared,
// so each shader is ~40 lines that differ only in a 3-line selector.
// Sharing a single übershader with a uniform mode would work; we keep
// four to match the Phase 1.a blend-mode id surface and make each a
// standalone asset for Phase 1.d's visual test harness.
//
// Algorithm: clip-space HSL per Adobe spec (ISO 32000-1):
//     hue:        base luma, blend chroma, blend hue
//     saturation: base luma, blend chroma,  base hue
//     color:      base luma, blend chroma, blend hue (same as hue up here
//                 in definition; differs from `hue` only in how alpha
//                 blending unwinds — spec requires separate IDs)
//     luminosity: blend luma, base chroma, base hue
// -----------------------------------------------------------------------------

/** Pass-through vertex shader for full-quad filter passes. */
export const HSL_VERTEX_SHADER = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

/**
 * Shared preamble: RGB/HSL utilities used by all four fragment shaders.
 * Per Adobe Blend Modes spec — Lum/Sat/ClipColor/SetLum/SetSat routines.
 */
const _HSL_PREAMBLE = /* glsl */ `
precision highp float;

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uTexture;   // the layer (blend)
uniform sampler2D uBase;      // what is underneath (base)

float lum(vec3 c) {
  return dot(c, vec3(0.3, 0.59, 0.11));
}

float sat(vec3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}

vec3 clipColor(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + ((c - l) * l) / (l - n);
  if (x > 1.0) c = l + ((c - l) * (1.0 - l)) / (x - l);
  return c;
}

vec3 setLum(vec3 c, float l) {
  float d = l - lum(c);
  return clipColor(c + d);
}

vec3 setSat(vec3 c, float s) {
  float cmax = max(max(c.r, c.g), c.b);
  float cmin = min(min(c.r, c.g), c.b);
  if (cmax - cmin <= 0.0) return vec3(0.0);
  vec3 r = (c - cmin) / (cmax - cmin);
  return r * s;
}
`;

/**
 * One fragment shader per HSL mode. The only difference between them is
 * the last three lines — which components come from base vs blend.
 */
export const HSL_FRAGMENT_SHADERS = Object.freeze({
  hue: _HSL_PREAMBLE + /* glsl */ `
    void main() {
      vec4 blend = texture(uTexture, vTextureCoord);
      vec4 base  = texture(uBase,    vTextureCoord);
      vec3 result = setLum(setSat(blend.rgb, sat(base.rgb)), lum(base.rgb));
      fragColor = vec4(mix(base.rgb, result, blend.a), max(base.a, blend.a));
    }
  `,

  saturation: _HSL_PREAMBLE + /* glsl */ `
    void main() {
      vec4 blend = texture(uTexture, vTextureCoord);
      vec4 base  = texture(uBase,    vTextureCoord);
      vec3 result = setLum(setSat(base.rgb, sat(blend.rgb)), lum(base.rgb));
      fragColor = vec4(mix(base.rgb, result, blend.a), max(base.a, blend.a));
    }
  `,

  color: _HSL_PREAMBLE + /* glsl */ `
    void main() {
      vec4 blend = texture(uTexture, vTextureCoord);
      vec4 base  = texture(uBase,    vTextureCoord);
      vec3 result = setLum(blend.rgb, lum(base.rgb));
      fragColor = vec4(mix(base.rgb, result, blend.a), max(base.a, blend.a));
    }
  `,

  luminosity: _HSL_PREAMBLE + /* glsl */ `
    void main() {
      vec4 blend = texture(uTexture, vTextureCoord);
      vec4 base  = texture(uBase,    vTextureCoord);
      vec3 result = setLum(base.rgb, lum(blend.rgb));
      fragColor = vec4(mix(base.rgb, result, blend.a), max(base.a, blend.a));
    }
  `,
});

/**
 * Build a Pixi v8 Filter for one of the HSL modes. Lazily requires
 * pixi.js so test files that only want to check the shader strings
 * don't drag the renderer into their module graph.
 *
 * @param {'hue'|'saturation'|'color'|'luminosity'} mode
 * @returns {Promise<import('pixi.js').Filter>}
 */
export async function buildHSLFilter(mode) {
  if (!HSL_FRAGMENT_SHADERS[mode]) throw new Error(`[HSLShaders] unknown mode: ${mode}`);
  const { Filter, GlProgram } = await import('pixi.js');
  const glProgram = GlProgram.from({
    vertex:   HSL_VERTEX_SHADER,
    fragment: HSL_FRAGMENT_SHADERS[mode],
    name:     `hsl-${mode}`,
  });
  return new Filter({ glProgram });
}
