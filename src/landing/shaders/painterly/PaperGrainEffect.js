// Paper grain Effect — procedural noise multiply for printed-on-paper feel.

import { Uniform } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform float uStrength;
  uniform float uScale;
  uniform float uTime;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float grain = noise(uv * uScale);
    grain += noise(uv * uScale * 2.0 + uTime * 0.01) * 0.5;
    grain = grain / 1.5;
    grain = 1.0 - (grain - 0.5) * uStrength * 2.0;

    outputColor = vec4(inputColor.rgb * grain, inputColor.a);
  }
`;

export class PaperGrainEffect extends Effect {
  constructor({ strength = 0.12, scale = 800.0 } = {}) {
    super('PaperGrainEffect', fragmentShader, {
      uniforms: new Map([
        ['uStrength', new Uniform(strength)],
        ['uScale', new Uniform(scale)],
        ['uTime', new Uniform(0.0)],
      ]),
    });
  }

  update(renderer, inputBuffer, deltaTime) {
    this.uniforms.get('uTime').value += deltaTime;
  }
}
