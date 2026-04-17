// Dark outline pass — Sobel edge detection on depth + color.
// Overlays subtle dark contour lines like Moebius ink work.
// Not anime-thick — watercolor ink bleed level.

import { Uniform, Vector2 } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uStrength;
  uniform vec3 uLineColor;

  float lum(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texel = 1.0 / uResolution;

    // Sobel on luminance
    float tl = lum(texture2D(inputBuffer, uv + vec2(-texel.x, texel.y)).rgb);
    float t  = lum(texture2D(inputBuffer, uv + vec2(0.0, texel.y)).rgb);
    float tr = lum(texture2D(inputBuffer, uv + vec2(texel.x, texel.y)).rgb);
    float ml = lum(texture2D(inputBuffer, uv + vec2(-texel.x, 0.0)).rgb);
    float mr = lum(texture2D(inputBuffer, uv + vec2(texel.x, 0.0)).rgb);
    float bl = lum(texture2D(inputBuffer, uv + vec2(-texel.x, -texel.y)).rgb);
    float b  = lum(texture2D(inputBuffer, uv + vec2(0.0, -texel.y)).rgb);
    float br = lum(texture2D(inputBuffer, uv + vec2(texel.x, -texel.y)).rgb);

    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*t  - tr + bl + 2.0*b  + br;
    float edge = sqrt(gx*gx + gy*gy);

    // Depth-based edges (catch silhouettes that luminance misses)
    float dc  = texture2D(depthBuffer, uv).r;
    float dl  = texture2D(depthBuffer, uv + vec2(-texel.x, 0.0)).r;
    float dr  = texture2D(depthBuffer, uv + vec2(texel.x, 0.0)).r;
    float dt  = texture2D(depthBuffer, uv + vec2(0.0, texel.y)).r;
    float db  = texture2D(depthBuffer, uv + vec2(0.0, -texel.y)).r;
    float depthEdge = abs(dl-dc) + abs(dr-dc) + abs(dt-dc) + abs(db-dc);
    depthEdge = smoothstep(0.001, 0.015, depthEdge);

    // Combine luminance + depth edges
    float combined = max(smoothstep(0.15, 0.5, edge), depthEdge);

    // Darken along edges — subtle ink line effect
    vec3 result = mix(inputColor.rgb, uLineColor, combined * uStrength);

    outputColor = vec4(result, inputColor.a);
  }
`;

export class OutlineEffect extends Effect {
  constructor({ strength = 0.6, resolution = new Vector2(1, 1) } = {}) {
    super('OutlineEffect', fragmentShader, {
      uniforms: new Map([
        ['uResolution', new Uniform(resolution)],
        ['uStrength', new Uniform(strength)],
        ['uLineColor', new Uniform({ x: 0.10, y: 0.03, z: 0.13 })], // #1a0820 ish
      ]),
      attributes: 1, // EffectAttribute.DEPTH
    });
  }

  setSize(width, height) {
    this.uniforms.get('uResolution').value.set(width, height);
  }
}
