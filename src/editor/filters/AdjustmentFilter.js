// src/editor/filters/AdjustmentFilter.js
// Single PixiJS v8 Filter — ALL tonal/color adjustments in one GPU pass.
// WebGL2 / GLSL ES 3.00. Premultiplied-alpha aware.

import { Filter, GlProgram, UniformGroup, defaultFilterVert } from 'pixi.js';

// ── Fragment shader ──────────────────────────────────────────────────────────
const FRAG = `
precision mediump float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;

uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uVibrance;
uniform float uHue;
uniform float uExposure;
uniform float uTemperature;
uniform float uTint;
uniform float uHighlights;
uniform float uShadows;

// ── HSL helpers ──────────────────────────────────────────────────────────────
vec3 rgb2hsl(vec3 c) {
  float maxC = max(max(c.r, c.g), c.b);
  float minC = min(min(c.r, c.g), c.b);
  float l    = (maxC + minC) * 0.5;
  float d    = maxC - minC;
  float h    = 0.0;
  float s    = 0.0;
  if (d > 0.001) {
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if      (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else                  h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 0.1667) return p + (q - p) * 6.0 * t;
  if (t < 0.5)    return q;
  if (t < 0.6667) return p + (q - p) * (0.6667 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  if (hsl.y < 0.001) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(
    hue2rgb(p, q, hsl.x + 0.3333),
    hue2rgb(p, q, hsl.x),
    hue2rgb(p, q, hsl.x - 0.3333)
  );
}

void main() {
  vec4 px  = texture(uTexture, vTextureCoord);
  float a  = px.a;
  vec3 rgb = px.rgb;

  // Unpremultiply alpha
  if (a > 0.001) rgb /= a;

  // 1. Exposure — multiplicative (measured in EV stops)
  rgb *= pow(2.0, uExposure);

  // 2. Brightness — simple additive lift
  rgb += uBrightness;

  // 3. Contrast — pivot around 0.5
  rgb = (rgb - 0.5) * (1.0 + uContrast) + 0.5;

  // 4. Temperature (+warm: shift toward red/yellow) & Tint (+: push toward green)
  rgb.r += uTemperature *  0.10;
  rgb.b += uTemperature * -0.10;
  rgb.g += uTint         *  0.05;

  // 5. Highlights & Shadows (luminance-weighted)
  float lum = dot(clamp(rgb, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
  rgb += uHighlights * smoothstep(0.4, 1.0, lum);
  rgb += uShadows    * smoothstep(0.6, 0.0, lum);

  rgb = clamp(rgb, 0.0, 1.0);

  // 6. Saturation — mix with luminance-weighted gray
  float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(gray), rgb, 1.0 + uSaturation);

  // 7. Vibrance — protects already-saturated colours
  float satRGB = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));
  float vib    = uVibrance * (1.0 - satRGB);
  gray         = dot(clamp(rgb, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(gray), rgb, 1.0 + vib);

  rgb = clamp(rgb, 0.0, 1.0);

  // 8. Hue rotation (via HSL)
  if (abs(uHue) > 0.5) {
    vec3 hsl  = rgb2hsl(rgb);
    hsl.x     = fract(hsl.x + uHue / 360.0);
    rgb       = hsl2rgb(hsl);
  }

  rgb = clamp(rgb, 0.0, 1.0);

  // Restore premultiplied alpha
  finalColor = vec4(rgb * a, a);
}
`;

// ── AdjustmentFilter ─────────────────────────────────────────────────────────
export class AdjustmentFilter extends Filter {
  constructor() {
    const glProgram = GlProgram.from({
      vertex:   defaultFilterVert,
      fragment: FRAG,
      name:     'adjustment-filter',
    });

    const adjustmentUniforms = new UniformGroup({
      uBrightness:  { value: 0, type: 'f32' },
      uContrast:    { value: 0, type: 'f32' },
      uSaturation:  { value: 0, type: 'f32' },
      uVibrance:    { value: 0, type: 'f32' },
      uHue:         { value: 0, type: 'f32' },
      uExposure:    { value: 0, type: 'f32' },
      uTemperature: { value: 0, type: 'f32' },
      uTint:        { value: 0, type: 'f32' },
      uHighlights:  { value: 0, type: 'f32' },
      uShadows:     { value: 0, type: 'f32' },
    });

    super({ glProgram, resources: { adjustmentUniforms } });
  }

  /** Update all uniforms in one call. Missing keys default to 0. */
  updateAdjustments(adj) {
    const u = this.resources.adjustmentUniforms.uniforms;
    u.uBrightness  = adj.brightness  ?? 0;
    u.uContrast    = adj.contrast    ?? 0;
    u.uSaturation  = adj.saturation  ?? 0;
    u.uVibrance    = adj.vibrance    ?? 0;
    u.uHue         = adj.hue         ?? 0;
    u.uExposure    = adj.exposure    ?? 0;
    u.uTemperature = adj.temperature ?? 0;
    u.uTint        = adj.tint        ?? 0;
    u.uHighlights  = adj.highlights  ?? 0;
    u.uShadows     = adj.shadows     ?? 0;
    this.resources.adjustmentUniforms.update();
  }
}
