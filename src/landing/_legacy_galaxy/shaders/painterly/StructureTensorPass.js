// Structure Tensor pass — computes local edge orientation.
// Output: RG = dominant eigenvector direction, B = anisotropy (0 = isotropic, 1 = strong edge)
//
// Algorithm:
// 1. Sobel gradients (Gx, Gy) per pixel
// 2. Structure tensor: Sxx = Gx*Gx, Sxy = Gx*Gy, Syy = Gy*Gy
// 3. Gaussian blur the tensor (5-tap separable)
// 4. Eigendecomposition → dominant direction + anisotropy

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
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / uResolution;

    // Sobel gradients
    float tl = dot(texture2D(tDiffuse, vUv + vec2(-texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float t  = dot(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(tDiffuse, vUv + vec2(texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float l  = dot(texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float r  = dot(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(tDiffuse, vUv + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float b  = dot(texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(tDiffuse, vUv + vec2(texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));

    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

    // Structure tensor components (blurred via 5-tap box in this simplified version)
    float sxx = gx * gx;
    float sxy = gx * gy;
    float syy = gy * gy;

    // Simple 5x5 box blur of the tensor for stability
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        if (i == 0 && j == 0) continue;
        vec2 offset = vec2(float(i), float(j)) * texel;
        float lum_tl = dot(texture2D(tDiffuse, vUv + offset + vec2(-texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
        float lum_t  = dot(texture2D(tDiffuse, vUv + offset + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
        float lum_tr = dot(texture2D(tDiffuse, vUv + offset + vec2(texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
        float lum_l  = dot(texture2D(tDiffuse, vUv + offset + vec2(-texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
        float lum_r  = dot(texture2D(tDiffuse, vUv + offset + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
        float lum_bl = dot(texture2D(tDiffuse, vUv + offset + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
        float lum_b  = dot(texture2D(tDiffuse, vUv + offset + vec2(0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
        float lum_br = dot(texture2D(tDiffuse, vUv + offset + vec2(texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
        float lgx = -lum_tl - 2.0*lum_l - lum_bl + lum_tr + 2.0*lum_r + lum_br;
        float lgy = -lum_tl - 2.0*lum_t - lum_tr + lum_bl + 2.0*lum_b + lum_br;
        sxx += lgx * lgx;
        sxy += lgx * lgy;
        syy += lgy * lgy;
      }
    }
    sxx /= 25.0;
    sxy /= 25.0;
    syy /= 25.0;

    // Eigendecomposition of 2x2 structure tensor
    float disc = sqrt(max(0.0, (sxx - syy) * (sxx - syy) + 4.0 * sxy * sxy));
    float lambda1 = 0.5 * (sxx + syy + disc);
    float lambda2 = 0.5 * (sxx + syy - disc);

    // Dominant eigenvector (perpendicular to gradient = along edge)
    vec2 dir = vec2(sxy, lambda1 - sxx);
    if (length(dir) > 0.001) dir = normalize(dir);
    else dir = vec2(1.0, 0.0);

    // Anisotropy: 0 = isotropic, 1 = strong directional edge
    float anisotropy = (lambda1 + lambda2 > 0.001)
      ? (lambda1 - lambda2) / (lambda1 + lambda2)
      : 0.0;

    // Pack: RG = direction (remapped 0-1), B = anisotropy
    gl_FragColor = vec4(dir * 0.5 + 0.5, anisotropy, 1.0);
  }
`;

export const StructureTensorMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader,
  fragmentShader,
});
