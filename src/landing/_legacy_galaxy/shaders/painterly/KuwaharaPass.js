// Anisotropic Kuwahara filter with inline structure tensor computation.
// Single-pass version: computes local edge orientation per-pixel, then
// applies the anisotropic Kuwahara kernel aligned to edges.
//
// This avoids the separate structure tensor render target for Phase B.
// Can be split into multi-pass for performance optimization later.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uKernelSize;
  uniform float uSharpness;

  varying vec2 vUv;

  #define PI 3.14159265
  #define N 8

  // Luminance
  float lum(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  // Compute local structure tensor and return (angle, anisotropy)
  vec2 getStructure(vec2 uv, vec2 texel) {
    // Sobel 3x3
    float tl = lum(texture2D(tDiffuse, uv + vec2(-1, 1) * texel).rgb);
    float t  = lum(texture2D(tDiffuse, uv + vec2( 0, 1) * texel).rgb);
    float tr = lum(texture2D(tDiffuse, uv + vec2( 1, 1) * texel).rgb);
    float ml = lum(texture2D(tDiffuse, uv + vec2(-1, 0) * texel).rgb);
    float mr = lum(texture2D(tDiffuse, uv + vec2( 1, 0) * texel).rgb);
    float bl = lum(texture2D(tDiffuse, uv + vec2(-1,-1) * texel).rgb);
    float b  = lum(texture2D(tDiffuse, uv + vec2( 0,-1) * texel).rgb);
    float br = lum(texture2D(tDiffuse, uv + vec2( 1,-1) * texel).rgb);

    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*t  - tr + bl + 2.0*b  + br;

    // Structure tensor: accumulate over a small neighborhood for stability
    float sxx = 0.0, sxy = 0.0, syy = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec2 off = vec2(float(i), float(j)) * texel * 2.0;
        float ltl = lum(texture2D(tDiffuse, uv + off + vec2(-1, 1)*texel).rgb);
        float lt  = lum(texture2D(tDiffuse, uv + off + vec2( 0, 1)*texel).rgb);
        float ltr = lum(texture2D(tDiffuse, uv + off + vec2( 1, 1)*texel).rgb);
        float lml = lum(texture2D(tDiffuse, uv + off + vec2(-1, 0)*texel).rgb);
        float lmr = lum(texture2D(tDiffuse, uv + off + vec2( 1, 0)*texel).rgb);
        float lbl = lum(texture2D(tDiffuse, uv + off + vec2(-1,-1)*texel).rgb);
        float lb  = lum(texture2D(tDiffuse, uv + off + vec2( 0,-1)*texel).rgb);
        float lbr = lum(texture2D(tDiffuse, uv + off + vec2( 1,-1)*texel).rgb);
        float lgx = -ltl - 2.0*lml - lbl + ltr + 2.0*lmr + lbr;
        float lgy = -ltl - 2.0*lt  - ltr + lbl + 2.0*lb  + lbr;
        sxx += lgx * lgx;
        sxy += lgx * lgy;
        syy += lgy * lgy;
      }
    }
    sxx /= 9.0; sxy /= 9.0; syy /= 9.0;

    // Eigendecomposition
    float disc = sqrt(max(0.0, (sxx - syy) * (sxx - syy) + 4.0 * sxy * sxy));
    float l1 = 0.5 * (sxx + syy + disc);
    float l2 = 0.5 * (sxx + syy - disc);

    vec2 dir = vec2(sxy, l1 - sxx);
    float angle = length(dir) > 0.001 ? atan(dir.y, dir.x) : 0.0;
    float anisotropy = (l1 + l2 > 0.001) ? (l1 - l2) / (l1 + l2) : 0.0;

    return vec2(angle, anisotropy);
  }

  void main() {
    vec2 texel = 1.0 / uResolution;

    // Get local edge orientation
    vec2 st = getStructure(vUv, texel);
    float angle = st.x;
    float aniso = st.y;

    float cosA = cos(angle);
    float sinA = sin(angle);

    float radius = uKernelSize;

    // Elliptical kernel stretching along edge direction
    float stretch = 1.0 + aniso * 2.5;

    // Accumulate per-sector statistics
    vec3 means[N];
    float vars[N];
    float weights[N];

    for (int s = 0; s < N; s++) {
      means[s] = vec3(0.0);
      vars[s] = 0.0;
      weights[s] = 0.0;
    }

    int r = int(radius);
    for (int i = -6; i <= 6; i++) {
      for (int j = -6; j <= 6; j++) {
        if (abs(i) > r || abs(j) > r) continue;

        vec2 p = vec2(float(i), float(j));
        float dist = length(p) / radius;
        if (dist > 1.0) continue;

        // Rotate sample into structure-aligned space
        vec2 rotP = vec2(
          cosA * p.x + sinA * p.y,
          -sinA * p.x + cosA * p.y
        );
        rotP.x /= stretch;

        vec2 sampleUv = vUv + p * texel;
        vec3 col = texture2D(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;

        // Sector assignment from angle of rotated position
        float sAngle = atan(rotP.y, rotP.x) + PI;
        int sector = int(floor(sAngle / (2.0 * PI) * float(N)));
        sector = clamp(sector, 0, N - 1);

        float w = exp(-dist * dist * 2.0);

        means[sector] += col * w;
        float l = lum(col);
        vars[sector] += l * l * w;
        weights[sector] += w;
      }
    }

    // Select sector with minimum variance (Kuwahara criterion)
    vec3 result = texture2D(tDiffuse, vUv).rgb;
    float minVar = 1e10;

    for (int s = 0; s < N; s++) {
      if (weights[s] < 0.01) continue;
      vec3 mean = means[s] / weights[s];
      float meanLum = lum(mean);
      float variance = vars[s] / weights[s] - meanLum * meanLum;

      if (variance < minVar) {
        minVar = variance;
        result = mean;
      }
    }

    gl_FragColor = vec4(result, 1.0);
  }
`;

export function createKuwaharaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uKernelSize: { value: 5.0 },
      uSharpness: { value: 10.0 },
    },
    vertexShader,
    fragmentShader,
  });
}
