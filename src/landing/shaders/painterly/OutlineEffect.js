// Moebius ink outline — depth-only Sobel. Draws dark contour lines at
// depth discontinuities, i.e., planet silhouettes against the nebula
// (which has depthWrite=false, leaving clear depth on its pixels).
//
// Previous iteration mixed in luminance-based edges too — that drew ink
// lines across the painted nebula's internal brushstroke variations.
// Depth-only gives the Moebius "ink-over-watercolor" read: hard contour
// on planet edges, untouched soft wash behind.

import { Uniform, Vector2 } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform vec2  uResolution;
  uniform float uStrength;
  uniform vec3  uLineColor;
  uniform float uSampleStride; // texel stride — controls line thickness

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texel = uSampleStride / uResolution;

    // 3×3 Sobel on depth. Cross-pattern (5 taps) would suffice for
    // silhouette detection but full 3×3 avoids diagonal aliasing.
    float dtl = texture2D(depthBuffer, uv + vec2(-texel.x,  texel.y)).r;
    float dt  = texture2D(depthBuffer, uv + vec2(     0.0,  texel.y)).r;
    float dtr = texture2D(depthBuffer, uv + vec2( texel.x,  texel.y)).r;
    float dml = texture2D(depthBuffer, uv + vec2(-texel.x,      0.0)).r;
    float dmr = texture2D(depthBuffer, uv + vec2( texel.x,      0.0)).r;
    float dbl = texture2D(depthBuffer, uv + vec2(-texel.x, -texel.y)).r;
    float db  = texture2D(depthBuffer, uv + vec2(     0.0, -texel.y)).r;
    float dbr = texture2D(depthBuffer, uv + vec2( texel.x, -texel.y)).r;

    float gx = -dtl - 2.0 * dml - dbl + dtr + 2.0 * dmr + dbr;
    float gy = -dtl - 2.0 * dt  - dtr + dbl + 2.0 * db  + dbr;
    float depthGrad = sqrt(gx * gx + gy * gy);

    // Raw depth-buffer deltas are tiny — geometry vs clear depth differs
    // by ~0.003. Sobel-combined gradient sits in roughly [0, 0.02] at
    // silhouettes. Threshold chosen to reject noise from within a single
    // continuous mesh (where adjacent pixels differ by <0.0005 typically).
    float edge = smoothstep(0.0010, 0.0060, depthGrad);

    vec3 result = mix(inputColor.rgb, uLineColor, edge * uStrength);
    outputColor = vec4(result, inputColor.a);
  }
`;

export class OutlineEffect extends Effect {
  constructor({
    strength = 0.85,
    sampleStride = 1.4,
    resolution = new Vector2(1, 1),
  } = {}) {
    super('OutlineEffect', fragmentShader, {
      uniforms: new Map([
        ['uResolution',   new Uniform(resolution)],
        ['uStrength',     new Uniform(strength)],
        ['uSampleStride', new Uniform(sampleStride)],
        // #1a0820 — deep violet-black Moebius ink.
        ['uLineColor',    new Uniform({ x: 0.102, y: 0.031, z: 0.125 })],
      ]),
      attributes: 1, // EffectAttribute.DEPTH
    });
  }

  setSize(width, height) {
    this.uniforms.get('uResolution').value.set(width, height);
  }
}
