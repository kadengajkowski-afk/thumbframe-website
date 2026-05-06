// Warm color grade Effect — violet shadows, amber mids, cool highlights.

import { Uniform, Vector3 } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform float uStrength;
  uniform vec3 uShadowTint;
  uniform vec3 uMidTint;
  uniform vec3 uHighTint;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;
    float lumVal = dot(color, vec3(0.299, 0.587, 0.114));

    float shadowW = smoothstep(0.4, 0.0, lumVal);
    float highW   = smoothstep(0.6, 1.0, lumVal);
    float midW    = 1.0 - shadowW - highW;

    vec3 graded = color;
    graded = mix(graded, graded * uShadowTint, shadowW * 0.3);
    graded = mix(graded, graded * uMidTint,    midW    * 0.15);
    graded = mix(graded, graded * uHighTint,   highW   * 0.1);

    graded = (graded - 0.5) * 1.08 + 0.5;
    float gray = dot(graded, vec3(0.299, 0.587, 0.114));
    // Tone-masked saturation — midtones desaturated (0.9×) so the
    // nebula's rose-violet reads dusty instead of electric magenta.
    // Shadow/highlight protection: shadows and highlights keep the
    // previous 1.15× saturation so they don't flatten.
    float sat = mix(1.15, 0.9, midW);
    graded = mix(vec3(gray), graded, sat);

    color = mix(color, graded, uStrength);
    outputColor = vec4(clamp(color, 0.0, 1.0), inputColor.a);
  }
`;

export class ColorGradeEffect extends Effect {
  constructor({ strength = 0.7 } = {}) {
    super('ColorGradeEffect', fragmentShader, {
      uniforms: new Map([
        ['uStrength', new Uniform(strength)],
        ['uShadowTint', new Uniform(new Vector3(0.7, 0.5, 1.0))],
        ['uMidTint',    new Uniform(new Vector3(1.1, 0.95, 0.85))],
        ['uHighTint',   new Uniform(new Vector3(0.95, 0.95, 1.05))],
      ]),
    });
  }
}
