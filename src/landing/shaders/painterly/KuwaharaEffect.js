// Anisotropic Kuwahara Effect — visible brush-stroke artifacts.
// Kernel loop ±12 to support large kernel sizes.

import { Uniform, Vector2 } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform float uKernelSize;
  uniform vec2 uResolution;

  #define KUWAHARA_N 8

  float lum(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  vec2 getStructure(vec2 uv, vec2 texel) {
    float sxx = 0.0, sxy = 0.0, syy = 0.0;
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        vec2 off = vec2(float(i), float(j)) * texel;
        float c  = lum(texture2D(inputBuffer, uv + off).rgb);
        float cx = lum(texture2D(inputBuffer, uv + off + vec2(texel.x, 0.0)).rgb) -
                   lum(texture2D(inputBuffer, uv + off - vec2(texel.x, 0.0)).rgb);
        float cy = lum(texture2D(inputBuffer, uv + off + vec2(0.0, texel.y)).rgb) -
                   lum(texture2D(inputBuffer, uv + off - vec2(0.0, texel.y)).rgb);
        sxx += cx * cx;
        sxy += cx * cy;
        syy += cy * cy;
      }
    }
    sxx /= 25.0; sxy /= 25.0; syy /= 25.0;

    float disc = sqrt(max(0.0, (sxx-syy)*(sxx-syy) + 4.0*sxy*sxy));
    float l1 = 0.5 * (sxx + syy + disc);
    float l2 = 0.5 * (sxx + syy - disc);

    vec2 dir = vec2(sxy, l1 - sxx);
    float angle = length(dir) > 0.0001 ? atan(dir.y, dir.x) : 0.0;
    float anisotropy = (l1+l2 > 0.0001) ? (l1-l2)/(l1+l2) : 0.0;
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
    float stretch = 1.0 + aniso * 3.0;

    // Per-sector accumulators
    vec3 sectorSum[KUWAHARA_N];
    float sectorLumSum[KUWAHARA_N];
    float sectorLum2Sum[KUWAHARA_N];
    float sectorW[KUWAHARA_N];
    for (int s = 0; s < KUWAHARA_N; s++) {
      sectorSum[s] = vec3(0.0);
      sectorLumSum[s] = 0.0;
      sectorLum2Sum[s] = 0.0;
      sectorW[s] = 0.0;
    }

    // Sample the kernel — loop ±12 to support large kernels
    for (int i = -12; i <= 12; i++) {
      for (int j = -12; j <= 12; j++) {
        vec2 p = vec2(float(i), float(j));
        float dist = length(p);
        if (dist > radius) continue;

        // Rotate into structure-aligned space for sector assignment
        vec2 rotP = vec2(cosA*p.x + sinA*p.y, -sinA*p.x + cosA*p.y);
        rotP.x /= max(stretch, 1.0);

        vec2 sampleUv = uv + p * texel;
        vec3 col = texture2D(inputBuffer, clamp(sampleUv, vec2(0.0), vec2(1.0))).rgb;
        float l = lum(col);

        // Assign to sector based on angle of the rotated offset
        float sAngle = atan(rotP.y, rotP.x) + PI;
        int sector = int(floor(sAngle / (2.0 * PI) * float(KUWAHARA_N)));
        sector = clamp(sector, 0, KUWAHARA_N - 1);

        // Gaussian-ish weight — stronger near center
        float nDist = dist / radius;
        float w = 1.0 - nDist * nDist;
        w = w * w; // sharper falloff

        sectorSum[sector] += col * w;
        sectorLumSum[sector] += l * w;
        sectorLum2Sum[sector] += l * l * w;
        sectorW[sector] += w;
      }
    }

    // Pick the sector with minimum variance (the "most uniform" region)
    vec3 result = inputColor.rgb;
    float minVar = 1e10;
    for (int s = 0; s < KUWAHARA_N; s++) {
      if (sectorW[s] < 0.001) continue;
      vec3 mean = sectorSum[s] / sectorW[s];
      float meanL = sectorLumSum[s] / sectorW[s];
      float var2 = sectorLum2Sum[s] / sectorW[s] - meanL * meanL;
      if (var2 < minVar) {
        minVar = var2;
        result = mean;
      }
    }

    outputColor = vec4(result, inputColor.a);
  }
`;

export class KuwaharaEffect extends Effect {
  constructor({ kernelSize = 12.0, resolution = new Vector2(1, 1) } = {}) {
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
