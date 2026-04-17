// Anisotropic Kuwahara Effect for @react-three/postprocessing.
// Computes structure tensor inline, applies 8-sector elliptical kernel
// aligned to local edge direction.

import { Uniform, Vector2 } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform float uKernelSize;
  uniform vec2 uResolution;

  #define PI 3.14159265
  #define N 8

  float lum(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  vec2 getStructure(vec2 uv, vec2 texel) {
    float tl = lum(texture2D(inputBuffer, uv + vec2(-1, 1) * texel).rgb);
    float t  = lum(texture2D(inputBuffer, uv + vec2( 0, 1) * texel).rgb);
    float tr = lum(texture2D(inputBuffer, uv + vec2( 1, 1) * texel).rgb);
    float ml = lum(texture2D(inputBuffer, uv + vec2(-1, 0) * texel).rgb);
    float mr = lum(texture2D(inputBuffer, uv + vec2( 1, 0) * texel).rgb);
    float bl = lum(texture2D(inputBuffer, uv + vec2(-1,-1) * texel).rgb);
    float b  = lum(texture2D(inputBuffer, uv + vec2( 0,-1) * texel).rgb);
    float br = lum(texture2D(inputBuffer, uv + vec2( 1,-1) * texel).rgb);

    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*t  - tr + bl + 2.0*b  + br;

    float sxx = 0.0, sxy = 0.0, syy = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec2 off = vec2(float(i), float(j)) * texel * 2.0;
        float ltl = lum(texture2D(inputBuffer, uv+off+vec2(-1, 1)*texel).rgb);
        float lt  = lum(texture2D(inputBuffer, uv+off+vec2( 0, 1)*texel).rgb);
        float ltr = lum(texture2D(inputBuffer, uv+off+vec2( 1, 1)*texel).rgb);
        float lml = lum(texture2D(inputBuffer, uv+off+vec2(-1, 0)*texel).rgb);
        float lmr = lum(texture2D(inputBuffer, uv+off+vec2( 1, 0)*texel).rgb);
        float lbl = lum(texture2D(inputBuffer, uv+off+vec2(-1,-1)*texel).rgb);
        float lb  = lum(texture2D(inputBuffer, uv+off+vec2( 0,-1)*texel).rgb);
        float lbr = lum(texture2D(inputBuffer, uv+off+vec2( 1,-1)*texel).rgb);
        float lgx = -ltl - 2.0*lml - lbl + ltr + 2.0*lmr + lbr;
        float lgy = -ltl - 2.0*lt  - ltr + lbl + 2.0*lb  + lbr;
        sxx += lgx * lgx;
        sxy += lgx * lgy;
        syy += lgy * lgy;
      }
    }
    sxx /= 9.0; sxy /= 9.0; syy /= 9.0;

    float disc = sqrt(max(0.0, (sxx-syy)*(sxx-syy) + 4.0*sxy*sxy));
    float l1 = 0.5 * (sxx + syy + disc);
    float l2 = 0.5 * (sxx + syy - disc);

    vec2 dir = vec2(sxy, l1 - sxx);
    float angle = length(dir) > 0.001 ? atan(dir.y, dir.x) : 0.0;
    float anisotropy = (l1+l2 > 0.001) ? (l1-l2)/(l1+l2) : 0.0;

    return vec2(angle, anisotropy);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texel = 1.0 / uResolution;

    vec2 st = getStructure(uv, texel);
    float angle = st.x;
    float aniso = st.y;
    float cosA = cos(angle);
    float sinA = sin(angle);
    float radius = uKernelSize;
    float stretch = 1.0 + aniso * 2.5;

    vec3 means[N];
    float lumMeans[N];
    float lumVars[N];
    float weights[N];

    for (int s = 0; s < N; s++) {
      means[s] = vec3(0.0);
      lumMeans[s] = 0.0;
      lumVars[s] = 0.0;
      weights[s] = 0.0;
    }

    int r = int(radius);
    for (int i = -6; i <= 6; i++) {
      for (int j = -6; j <= 6; j++) {
        if (abs(i) > r || abs(j) > r) continue;
        vec2 p = vec2(float(i), float(j));
        float dist = length(p) / radius;
        if (dist > 1.0) continue;

        vec2 rotP = vec2(cosA*p.x + sinA*p.y, -sinA*p.x + cosA*p.y);
        rotP.x /= stretch;

        vec2 sampleUv = uv + p * texel;
        vec3 col = texture2D(inputBuffer, clamp(sampleUv, 0.0, 1.0)).rgb;
        float l = lum(col);

        float sAngle = atan(rotP.y, rotP.x) + PI;
        int sector = int(floor(sAngle / (2.0*PI) * float(N)));
        sector = clamp(sector, 0, N-1);

        float w = exp(-dist * dist * 2.0);
        means[sector] += col * w;
        lumMeans[sector] += l * w;
        lumVars[sector] += l * l * w;
        weights[sector] += w;
      }
    }

    vec3 result = inputColor.rgb;
    float minVar = 1e10;

    for (int s = 0; s < N; s++) {
      if (weights[s] < 0.01) continue;
      vec3 mean = means[s] / weights[s];
      float meanL = lumMeans[s] / weights[s];
      float variance = lumVars[s] / weights[s] - meanL * meanL;
      if (variance < minVar) {
        minVar = variance;
        result = mean;
      }
    }

    outputColor = vec4(result, inputColor.a);
  }
`;

export class KuwaharaEffect extends Effect {
  constructor({ kernelSize = 6.0, resolution = new Vector2(1, 1) } = {}) {
    super('KuwaharaEffect', fragmentShader, {
      uniforms: new Map([
        ['uKernelSize', new Uniform(kernelSize)],
        ['uResolution', new Uniform(resolution)],
      ]),
    });
  }

  setSize(width, height) {
    this.uniforms.get('uResolution').value.set(width, height);
  }
}
